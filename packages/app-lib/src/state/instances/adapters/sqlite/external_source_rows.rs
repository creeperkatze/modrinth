use crate::state::instances::{ExternalContentSource, ExternalPlatform};
use sqlx::{Executor, Sqlite, SqlitePool};
use std::collections::{HashMap, HashSet};

#[derive(Debug, sqlx::FromRow)]
struct ExternalContentSourceRow {
    sha1: String,
    platform: String,
    project_id: String,
    file_id: String,
    project_slug: Option<String>,
    project_title: String,
    project_icon_url: Option<String>,
    project_url: Option<String>,
    author_id: Option<String>,
    author_name: Option<String>,
    author_url: Option<String>,
    file_display_name: Option<String>,
    file_date: Option<String>,
    detected: bool,
}

/// An external source recorded for a file, either from installing it or from identifying it later.
#[derive(Clone, Debug)]
pub(crate) struct StoredExternalSource {
    pub source: ExternalContentSource,
    /// Whether the file was identified by its fingerprint rather than installed from the platform.
    pub detected: bool,
}

impl TryFrom<ExternalContentSourceRow> for StoredExternalSource {
    type Error = crate::Error;

    fn try_from(row: ExternalContentSourceRow) -> crate::Result<Self> {
        Ok(Self {
            source: ExternalContentSource {
                platform: ExternalPlatform::from_stored_str(&row.platform)?,
                project_id: row.project_id,
                file_id: row.file_id,
                project_slug: row.project_slug,
                project_title: row.project_title,
                project_icon_url: row.project_icon_url,
                project_url: row.project_url,
                author_id: row.author_id,
                author_name: row.author_name,
                author_url: row.author_url,
                file_display_name: row.file_display_name,
                file_date: row.file_date,
            },
            detected: row.detected,
        })
    }
}

/// Records where a file came from. A detected source never replaces one recorded by an install.
pub(crate) async fn upsert_external_source(
    sha1: &str,
    source: &ExternalContentSource,
    detected: bool,
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<()> {
    sqlx::query(
        "
		INSERT INTO external_content_sources (
			sha1, platform, project_id, file_id, project_slug, project_title,
			project_icon_url, project_url, author_id, author_name, author_url,
			file_display_name, file_date, detected, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (sha1) DO UPDATE SET
			platform = excluded.platform,
			project_id = excluded.project_id,
			file_id = excluded.file_id,
			project_slug = excluded.project_slug,
			project_title = excluded.project_title,
			project_icon_url = excluded.project_icon_url,
			project_url = excluded.project_url,
			author_id = excluded.author_id,
			author_name = excluded.author_name,
			author_url = excluded.author_url,
			file_display_name = excluded.file_display_name,
			file_date = excluded.file_date,
			detected = excluded.detected,
			updated_at = excluded.updated_at
		WHERE excluded.detected = 0 OR external_content_sources.detected = 1
		",
    )
    .bind(sha1)
    .bind(source.platform.as_str())
    .bind(&source.project_id)
    .bind(&source.file_id)
    .bind(&source.project_slug)
    .bind(&source.project_title)
    .bind(&source.project_icon_url)
    .bind(&source.project_url)
    .bind(&source.author_id)
    .bind(&source.author_name)
    .bind(&source.author_url)
    .bind(&source.file_display_name)
    .bind(&source.file_date)
    .bind(detected)
    .bind(chrono::Utc::now().timestamp())
    .execute(exec)
    .await?;

    Ok(())
}

/// Returns the ids of instances that contain a file from the given project on an external platform.
pub(crate) async fn get_instances_with_external_project(
    platform: ExternalPlatform,
    project_id: &str,
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<Vec<String>> {
    Ok(sqlx::query_scalar::<_, String>(
        "
		SELECT DISTINCT files.instance_id
		FROM instance_files files
		INNER JOIN external_content_sources sources ON sources.sha1 = files.sha1
		WHERE sources.platform = ? AND sources.project_id = ? AND files.missing = 0
		",
    )
    .bind(platform.as_str())
    .bind(project_id)
    .fetch_all(exec)
    .await?)
}

/// Returns the recorded external sources for the given SHA-1 hashes, keyed by hash.
pub(crate) async fn get_external_sources(
    hashes: &[&str],
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<HashMap<String, StoredExternalSource>> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    let hashes = serde_json::to_string(hashes)?;
    let rows = sqlx::query_as::<_, ExternalContentSourceRow>(
        "
		SELECT
			sha1, platform, project_id, file_id, project_slug, project_title,
			project_icon_url, project_url, author_id, author_name, author_url,
			file_display_name, file_date, detected
		FROM external_content_sources
		WHERE sha1 IN (SELECT value FROM json_each(?))
		",
    )
    .bind(hashes)
    .fetch_all(exec)
    .await?;

    rows.into_iter()
        .map(|row| {
            let sha1 = row.sha1.clone();
            Ok((sha1, StoredExternalSource::try_from(row)?))
        })
        .collect()
}

/// Returns which of the given hashes were looked up on `platform` at or after `since`.
pub(crate) async fn get_checked_hashes(
    platform: ExternalPlatform,
    hashes: &[&str],
    since: i64,
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<HashSet<String>> {
    if hashes.is_empty() {
        return Ok(HashSet::new());
    }
    let hashes = serde_json::to_string(hashes)?;
    Ok(sqlx::query_scalar::<_, String>(
        "
		SELECT sha1
		FROM external_content_checks
		WHERE platform = ? AND checked_at >= ? AND sha1 IN (SELECT value FROM json_each(?))
		",
    )
    .bind(platform.as_str())
    .bind(since)
    .bind(hashes)
    .fetch_all(exec)
    .await?
    .into_iter()
    .collect())
}

/// Remembers that the given hashes were looked up on `platform`, whether or not they matched.
pub(crate) async fn record_checked_hashes(
    platform: ExternalPlatform,
    hashes: &[String],
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<()> {
    if hashes.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "
		INSERT INTO external_content_checks (sha1, platform, checked_at)
		SELECT value, ?, ? FROM json_each(?)
		ON CONFLICT (sha1, platform) DO UPDATE SET checked_at = excluded.checked_at
		",
    )
    .bind(platform.as_str())
    .bind(chrono::Utc::now().timestamp())
    .bind(serde_json::to_string(hashes)?)
    .execute(exec)
    .await?;

    Ok(())
}

/// Returns the cached CurseForge fingerprints for the given hashes, keyed by hash.
pub(crate) async fn get_curseforge_fingerprints(
    hashes: &[&str],
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<HashMap<String, u32>> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, (String, i64)>(
        "
		SELECT sha1, fingerprint
		FROM curseforge_fingerprints
		WHERE sha1 IN (SELECT value FROM json_each(?))
		",
    )
    .bind(serde_json::to_string(hashes)?)
    .fetch_all(exec)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(sha1, fingerprint)| (sha1, fingerprint as u32))
        .collect())
}

pub(crate) async fn insert_curseforge_fingerprints(
    fingerprints: &[(String, u32)],
    pool: &SqlitePool,
) -> crate::Result<()> {
    let mut transaction = pool.begin().await?;
    for (sha1, fingerprint) in fingerprints {
        sqlx::query(
            "
			INSERT INTO curseforge_fingerprints (sha1, fingerprint)
			VALUES (?, ?)
			ON CONFLICT (sha1) DO UPDATE SET fingerprint = excluded.fingerprint
			",
        )
        .bind(sha1)
        .bind(i64::from(*fingerprint))
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;

    Ok(())
}
