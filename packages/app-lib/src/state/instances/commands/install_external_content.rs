use crate::state::State;
use crate::state::content_store::{input, validate_digest};
use crate::state::instances::adapters::sqlite::external_source_rows;
use crate::state::instances::{ContentSourceKind, InstallExternalFileRequest};
use crate::util::fetch::{self, FetchProgressFn};

use super::content_mutation::{InstallContent, install_stored_file};

/// Downloads a file from an external platform, records its source, and installs it into the
/// instance, replacing `request.replace_path` when set.
pub(crate) async fn install_external_file(
    instance_id: &str,
    request: &InstallExternalFileRequest,
    progress: Option<&mut FetchProgressFn<'_>>,
    state: &State,
) -> crate::Result<String> {
    if !path_util::is_safe_file_name(&request.file_name) {
        return Err(input("Invalid project filename"));
    }
    validate_digest(&request.sha1, 40)?;
    let url = url::Url::parse(&request.url)
        .map_err(|_| input("Invalid external download URL"))?;
    if url.scheme() != "https"
        || !url
            .host_str()
            .is_some_and(|host| request.source.platform.is_download_host(host))
    {
        return Err(input(format!(
            "Downloads from {} are not allowed for {}",
            url.host_str().unwrap_or_default(),
            request.source.platform.as_str(),
        )));
    }

    let downloaded = fetch::fetch_file_mirrors_in(
        &[url.as_str()],
        Some(&request.sha1),
        None,
        None,
        &state.fetch_semaphore,
        &state.pool,
        progress,
        None,
    )
    .await?;
    let stored_file = downloaded.store_file(state).await?;
    external_source_rows::upsert_external_source(
        &request.sha1,
        &request.source,
        &state.pool,
    )
    .await?;

    install_stored_file(
        instance_id,
        InstallContent {
            requested_path: &format!(
                "{}/{}",
                request.project_type.get_folder(),
                request.file_name
            ),
            stored_file: &stored_file,
            project_type: request.project_type,
            source_kind: ContentSourceKind::Local,
            origin: None,
            enabled_override: None,
            previous_path: request.replace_path.as_deref(),
        },
        state,
    )
    .await
}
