use crate::state::instances::adapters::sqlite::external_source_rows;
use crate::state::{
    CacheBehaviour, ContentFile, ContentItem, ContentSet, Dependency,
    DetectedExternalFile, ExternalDetectionCandidate, ExternalPlatform,
    InstanceInstallCandidate, InstanceInstallTarget, LinkedModpackInfo,
    ProjectType, State,
};
use dashmap::DashMap;

#[tracing::instrument]
pub async fn sync_content_files(
    instance_id: &str,
) -> crate::Result<Vec<crate::state::instances::InstanceFile>> {
    let state = State::get().await?;
    crate::state::sync_content_files(instance_id, &state).await
}

/// Returns the ids of instances that contain a file from `project_id` on `platform`.
#[tracing::instrument]
pub async fn get_external_project_instances(
    platform: ExternalPlatform,
    project_id: &str,
) -> crate::Result<Vec<String>> {
    let state = State::get().await?;
    external_source_rows::get_instances_with_external_project(
        platform,
        project_id,
        &state.pool,
    )
    .await
}

/// Returns the files in an instance that should be looked up on `platform`, with their fingerprints.
#[tracing::instrument]
pub async fn get_external_detection_candidates(
    instance_id: &str,
    platform: ExternalPlatform,
) -> crate::Result<Vec<ExternalDetectionCandidate>> {
    let state = State::get().await?;
    crate::state::get_external_detection_candidates(
        instance_id,
        platform,
        &state,
    )
    .await
}

/// Stores the files identified on `platform` and remembers every file that was looked up.
#[tracing::instrument(skip(checked, matches))]
pub async fn record_external_detection(
    platform: ExternalPlatform,
    checked: Vec<String>,
    matches: Vec<DetectedExternalFile>,
) -> crate::Result<()> {
    let state = State::get().await?;
    crate::state::record_external_detection(
        platform, &checked, &matches, &state,
    )
    .await
}

#[tracing::instrument]
pub async fn list_content_sets(
    instance_id: &str,
) -> crate::Result<Vec<ContentSet>> {
    let state = State::get().await?;
    crate::state::list_content_sets(instance_id, &state.pool).await
}

#[tracing::instrument]
pub async fn get_projects(
    instance_id: &str,
    cache_behaviour: Option<CacheBehaviour>,
) -> crate::Result<DashMap<String, ContentFile>> {
    let state = State::get().await?;
    crate::state::get_content_projects(
        instance_id,
        None,
        cache_behaviour,
        &state,
    )
    .await
}

#[tracing::instrument]
pub async fn get_installed_project_ids(
    instance_id: &str,
) -> crate::Result<Vec<String>> {
    let state = State::get().await?;
    crate::state::get_installed_project_ids_for_instance(
        instance_id,
        None,
        &state,
    )
    .await
}

#[tracing::instrument]
pub async fn get_install_candidates(
    project_id: &str,
    project_type: ProjectType,
    targets: Vec<InstanceInstallTarget>,
) -> crate::Result<Vec<InstanceInstallCandidate>> {
    let state = State::get().await?;
    crate::state::get_instance_install_candidates(
        project_id,
        project_type,
        &targets,
        &state.pool,
    )
    .await
}

#[tracing::instrument]
pub async fn get_content_items(
    instance_id: &str,
    cache_behaviour: Option<CacheBehaviour>,
) -> crate::Result<Vec<ContentItem>> {
    let state = State::get().await?;
    let mut items = crate::state::list_indexed_content(
        instance_id,
        cache_behaviour,
        &state,
    )
    .await?;
    super::synced_packs::decorate_content(instance_id, &mut items, &state)
        .await?;
    Ok(items)
}

#[tracing::instrument]
pub async fn refresh_content_updates(instance_id: &str) -> crate::Result<()> {
    let state = State::get().await?;
    crate::state::refresh_content_updates(instance_id, &state).await
}

#[tracing::instrument]
pub async fn get_linked_modpack_content(
    instance_id: &str,
    cache_behaviour: Option<CacheBehaviour>,
) -> crate::Result<Vec<ContentItem>> {
    let state = State::get().await?;
    crate::state::list_linked_modpack_content(
        instance_id,
        None,
        cache_behaviour,
        &state,
    )
    .await
}

#[tracing::instrument]
pub async fn get_dependencies_as_content_items(
    dependencies: Vec<Dependency>,
    cache_behaviour: Option<CacheBehaviour>,
) -> crate::Result<Vec<ContentItem>> {
    let state = State::get().await?;
    crate::state::dependencies_to_content_items(
        &dependencies,
        cache_behaviour,
        &state.pool,
        &state.api_semaphore,
    )
    .await
}

#[tracing::instrument]
pub async fn get_linked_modpack_info(
    instance_id: &str,
    cache_behaviour: Option<CacheBehaviour>,
) -> crate::Result<Option<LinkedModpackInfo>> {
    let state = State::get().await?;
    crate::state::get_linked_modpack_info(
        instance_id,
        None,
        cache_behaviour,
        &state,
    )
    .await
}
