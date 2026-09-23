use super::sync_content_files::project_type_for_file;
use crate::State;
use crate::state::instances::adapters::sqlite::{self, external_source_rows};
use crate::state::{
    CachedEntry, DetectedExternalFile, ExternalDetectionCandidate,
    ExternalPlatform, Settings,
};
use std::collections::HashSet;
use std::path::PathBuf;

/// How long a file that matched nothing is left alone before it is looked up again.
const RECHECK_AFTER_SECS: i64 = 7 * 24 * 60 * 60;

/// Files in an instance worth looking up on `platform`, with their fingerprints.
///
/// Files installed from a platform are skipped, as are files already looked up recently. Unless
/// `platform` is the preferred platform, files Modrinth already recognises are skipped too.
pub(crate) async fn get_external_detection_candidates(
    instance_id: &str,
    platform: ExternalPlatform,
    state: &State,
) -> crate::Result<Vec<ExternalDetectionCandidate>> {
    let instance =
        sqlite::instance_rows::get_instance_by_id(instance_id, &state.pool)
            .await?
            .ok_or_else(|| {
                crate::ErrorKind::InputError("Unknown instance".to_string())
            })?;
    let entries = match sqlite::content_rows::get_applied_content_set(
        instance_id,
        &state.pool,
    )
    .await?
    {
        Some(content_set) => {
            sqlite::content_rows::get_content_entries(
                &content_set.id,
                &state.pool,
            )
            .await?
        }
        None => Vec::new(),
    };
    let installed_from_modrinth = entries
        .iter()
        .filter(|entry| entry.project_id.is_some())
        .filter_map(|entry| entry.file_id.as_deref())
        .collect::<HashSet<_>>();

    let mut seen = HashSet::new();
    let files =
        sqlite::content_rows::get_instance_files(instance_id, &state.pool)
            .await?
            .into_iter()
            .filter(|file| {
                !file.missing
                    && project_type_for_file(file).is_some()
                    && !installed_from_modrinth.contains(file.id.as_str())
                    && seen.insert(file.sha1.clone())
            })
            .collect::<Vec<_>>();
    let hashes = files
        .iter()
        .map(|file| file.sha1.as_str())
        .collect::<Vec<_>>();

    let stored =
        external_source_rows::get_external_sources(&hashes, &state.pool)
            .await?;
    let checked = external_source_rows::get_checked_hashes(
        platform,
        &hashes,
        chrono::Utc::now().timestamp() - RECHECK_AFTER_SECS,
        &state.pool,
    )
    .await?;
    let preferred = Settings::get(&state.pool)
        .await?
        .default_content_platform
        .external()
        == Some(platform);
    let on_modrinth = if preferred {
        HashSet::new()
    } else {
        CachedEntry::get_file_many(
            &hashes,
            None,
            &state.pool,
            &state.api_semaphore,
        )
        .await?
        .into_iter()
        .map(|file| file.hash)
        .collect()
    };

    let pending = files
        .iter()
        .filter(|file| {
            let known = stored.get(&file.sha1).is_some_and(|stored| {
                !stored.detected || stored.source.platform == platform
            });
            !known
                && !checked.contains(&file.sha1)
                && !on_modrinth.contains(&file.sha1)
        })
        .map(|file| (file.sha1.clone(), file.relative_path.clone()))
        .collect::<Vec<_>>();
    if pending.is_empty() {
        return Ok(Vec::new());
    }

    let instance_path = state.directories.instances_dir().join(&instance.path);
    match platform {
        ExternalPlatform::CurseForge => {
            curseforge_candidates(instance_path, pending, state).await
        }
    }
}

/// Records the outcome of looking up files on `platform`: the files that matched and every file
/// that was checked, so unmatched files are not looked up again right away.
pub(crate) async fn record_external_detection(
    platform: ExternalPlatform,
    checked: &[String],
    matches: &[DetectedExternalFile],
    state: &State,
) -> crate::Result<()> {
    if let Some(file) =
        matches.iter().find(|file| file.source.platform != platform)
    {
        return Err(crate::ErrorKind::InputError(format!(
            "File {} was matched on {} while detecting on {}",
            file.sha1,
            file.source.platform.as_str(),
            platform.as_str(),
        ))
        .into());
    }

    let mut transaction = state.pool.begin().await?;
    for file in matches {
        external_source_rows::upsert_external_source(
            &file.sha1,
            &file.source,
            true,
            &mut *transaction,
        )
        .await?;
    }
    external_source_rows::record_checked_hashes(
        platform,
        checked,
        &mut *transaction,
    )
    .await?;
    transaction.commit().await?;

    Ok(())
}

async fn curseforge_candidates(
    instance_path: PathBuf,
    files: Vec<(String, String)>,
    state: &State,
) -> crate::Result<Vec<ExternalDetectionCandidate>> {
    let hashes = files
        .iter()
        .map(|(sha1, _)| sha1.as_str())
        .collect::<Vec<_>>();
    let mut fingerprints =
        external_source_rows::get_curseforge_fingerprints(&hashes, &state.pool)
            .await?;

    let uncached = files
        .iter()
        .filter(|(sha1, _)| !fingerprints.contains_key(sha1))
        .map(|(sha1, path)| (sha1.clone(), instance_path.join(path)))
        .collect::<Vec<_>>();
    let computed = tokio::task::spawn_blocking(move || {
        uncached
            .into_iter()
            .filter_map(|(sha1, path)| {
                std::fs::read(path)
                    .ok()
                    .map(|bytes| (sha1, curseforge_fingerprint(&bytes)))
            })
            .collect::<Vec<_>>()
    })
    .await?;
    external_source_rows::insert_curseforge_fingerprints(
        &computed,
        &state.pool,
    )
    .await?;
    fingerprints.extend(computed);

    Ok(files
        .into_iter()
        .filter_map(|(sha1, _)| {
            fingerprints.get(&sha1).map(|&fingerprint| {
                ExternalDetectionCandidate { sha1, fingerprint }
            })
        })
        .collect())
}

/// CurseForge's file fingerprint: Murmur2 with seed 1 over the file without whitespace bytes.
fn curseforge_fingerprint(bytes: &[u8]) -> u32 {
    let normalized = bytes
        .iter()
        .copied()
        .filter(|byte| !matches!(byte, 9 | 10 | 13 | 32))
        .collect::<Vec<_>>();
    murmur2(&normalized, 1)
}

fn murmur2(data: &[u8], seed: u32) -> u32 {
    const M: u32 = 0x5bd1_e995;
    const R: u32 = 24;

    let mut hash = seed ^ data.len() as u32;
    let mut chunks = data.chunks_exact(4);
    for chunk in &mut chunks {
        let mut k =
            u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        k = k.wrapping_mul(M);
        k ^= k >> R;
        k = k.wrapping_mul(M);
        hash = hash.wrapping_mul(M) ^ k;
    }

    let tail = chunks.remainder();
    if !tail.is_empty() {
        for (index, byte) in tail.iter().enumerate() {
            hash ^= u32::from(*byte) << (8 * index);
        }
        hash = hash.wrapping_mul(M);
    }

    hash ^= hash >> 13;
    hash = hash.wrapping_mul(M);
    hash ^ (hash >> 15)
}

#[cfg(test)]
mod tests {
    use super::{curseforge_fingerprint, murmur2};

    #[test]
    fn murmur2_of_empty_input() {
        assert_eq!(murmur2(b"", 1), 0x5bd1_5e36);
    }

    #[test]
    fn fingerprint_ignores_whitespace() {
        assert_eq!(
            curseforge_fingerprint(b"a b\tc\r\nd"),
            curseforge_fingerprint(b"abcd"),
        );
    }
}
