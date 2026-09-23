use crate::state::instances::{ExternalContentSource, ExternalPlatform};
use sqlx::{Executor, Sqlite};
use std::collections::HashMap;

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
    author_name: Option<String>,
    author_url: Option<String>,
    file_display_name: Option<String>,
    file_date: Option<String>,
}

impl TryFrom<ExternalContentSourceRow> for ExternalContentSource {
    type Error = crate::Error;

    fn try_from(row: ExternalContentSourceRow) -> crate::Result<Self> {
        Ok(Self {
            platform: ExternalPlatform::from_stored_str(&row.platform)?,
            project_id: row.project_id,
            file_id: row.file_id,
            project_slug: row.project_slug,
            project_title: row.project_title,
            project_icon_url: row.project_icon_url,
            project_url: row.project_url,
            author_name: row.author_name,
            author_url: row.author_url,
            file_display_name: row.file_display_name,
            file_date: row.file_date,
        })
    }
}

pub(crate) async fn upsert_external_source(
    sha1: &str,
    source: &ExternalContentSource,
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<()> {
    sqlx::query(
        "
		INSERT INTO external_content_sources (
			sha1, platform, project_id, file_id, project_slug, project_title,
			project_icon_url, project_url, author_name, author_url,
			file_display_name, file_date, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (sha1) DO UPDATE SET
			platform = excluded.platform,
			project_id = excluded.project_id,
			file_id = excluded.file_id,
			project_slug = excluded.project_slug,
			project_title = excluded.project_title,
			project_icon_url = excluded.project_icon_url,
			project_url = excluded.project_url,
			author_name = excluded.author_name,
			author_url = excluded.author_url,
			file_display_name = excluded.file_display_name,
			file_date = excluded.file_date,
			updated_at = excluded.updated_at
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
    .bind(&source.author_name)
    .bind(&source.author_url)
    .bind(&source.file_display_name)
    .bind(&source.file_date)
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

/// Returns the known external sources for the given SHA-1 hashes, keyed by hash.
pub(crate) async fn get_external_sources(
    hashes: &[&str],
    exec: impl Executor<'_, Database = Sqlite>,
) -> crate::Result<HashMap<String, ExternalContentSource>> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    let hashes = serde_json::to_string(hashes)?;
    let rows = sqlx::query_as::<_, ExternalContentSourceRow>(
        "
		SELECT
			sha1, platform, project_id, file_id, project_slug, project_title,
			project_icon_url, project_url, author_name, author_url,
			file_display_name, file_date
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
            Ok((sha1, ExternalContentSource::try_from(row)?))
        })
        .collect()
}
