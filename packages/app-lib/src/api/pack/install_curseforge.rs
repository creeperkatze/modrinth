//! Turns a CurseForge modpack into a [`CreatePack`] so it installs through the same pipeline as
//! Modrinth packs.

use super::install_from::{
    CreatePack, CreatePackDescription, CreatePackFile, PackDependency,
    PackFile, PackFileHash, PackFormat,
};
use super::install_mrpack::read_pack_entry;
use crate::State;
use crate::event::emit::emit_warning;
use crate::install::{
    InstallErrorContext, InstallPhaseDetails, InstallPhaseId, InstallProgress,
    InstallProgressReporter,
};
use crate::state::instances::adapters::sqlite::external_source_rows;
use crate::state::{AppliedContentSetPatch, EditInstance, InstanceLink};
use crate::util::curseforge::{self, CurseForgeFile, CurseForgeMod};
use crate::util::fetch::{FetchProgressFn, fetch, fetch_file_mirrors_in};
use path_util::SafeRelativeUtf8UnixPathBuf;
use serde::Deserialize;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

/// The folder CurseForge packs keep their overrides in. Packs using another folder aren't supported.
const OVERRIDES_FOLDER: &str = "overrides";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeManifest {
    minecraft: CurseForgeManifestMinecraft,
    name: String,
    #[serde(default)]
    version: String,
    #[serde(default)]
    files: Vec<CurseForgeManifestFile>,
    #[serde(default = "default_overrides")]
    overrides: String,
}

fn default_overrides() -> String {
    OVERRIDES_FOLDER.to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeManifestMinecraft {
    version: String,
    #[serde(default)]
    mod_loaders: Vec<CurseForgeManifestLoader>,
}

#[derive(Deserialize)]
struct CurseForgeManifestLoader {
    /// A loader and its version, such as `forge-47.2.0` or `fabric-0.15.11`.
    id: String,
    #[serde(default)]
    primary: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeManifestFile {
    #[serde(rename = "projectID")]
    project_id: u32,
    #[serde(rename = "fileID")]
    file_id: u32,
    #[serde(default = "default_required")]
    required: bool,
}

fn default_required() -> bool {
    true
}

/// Downloads a CurseForge modpack and resolves its manifest into a pack the mrpack installer can
/// install. Files the pack's authors block third-party apps from downloading are left out, and
/// the user is warned about them.
pub(crate) async fn generate_pack_from_curseforge(
    project_id: String,
    file_id: String,
    title: String,
    icon_url: Option<String>,
    instance_id: String,
    reporter: InstallProgressReporter,
) -> crate::Result<CreatePack> {
    let state = State::get().await?;
    let details = InstallPhaseDetails::Modpack {
        project_id: Some(project_id.clone()),
        version_id: Some(file_id.clone()),
        title: Some(title.clone()),
    };
    let mod_id = parse_id(&project_id, "project")?;
    let pack_file_id = parse_id(&file_id, "file")?;

    reporter
        .set_context(
            InstallErrorContext::new("resolve CurseForge modpack file")
                .project_id(project_id.clone())
                .version_id(file_id.clone())
                .build(),
        )
        .await?;
    let pack_file = curseforge::get_file(
        mod_id,
        pack_file_id,
        &state.api_semaphore,
        &state.pool,
    )
    .await?;
    let Some(url) = pack_file.download_url.clone() else {
        return Err(crate::ErrorKind::InputError(format!(
            "The authors of {title} don't allow downloading it from other apps. Download it from CurseForge instead."
        ))
        .into());
    };
    let sha1 = pack_file.sha1();

    reporter
        .set_context(
            InstallErrorContext::new("download modpack file")
                .urls(vec![url.clone()])
                .maybe_expected_hash(sha1.clone())
                .expected_size(pack_file.file_length)
                .project_id(project_id.clone())
                .version_id(file_id.clone())
                .build(),
        )
        .await?;
    let mut last_reported_bytes = 0_u64;
    let mut progress =
        |current: u64,
         total: u64|
         -> Pin<Box<dyn Future<Output = crate::Result<()>> + Send>> {
            let min_delta = (total / 200).max(256 * 1024);
            if current < total
                && current.saturating_sub(last_reported_bytes) < min_delta
            {
                return Box::pin(async { Ok(()) });
            }

            last_reported_bytes = current;
            let reporter = reporter.clone();
            let details = details.clone();
            Box::pin(async move {
                reporter
                    .update(
                        InstallPhaseId::DownloadingPackFile,
                        Some(InstallProgress {
                            current,
                            total,
                            secondary: None,
                        }),
                        details,
                    )
                    .await
            })
        };
    let archive = fetch_file_mirrors_in(
        &[url.as_str()],
        sha1.as_deref(),
        None,
        None,
        &state.fetch_semaphore,
        &state.pool,
        Some(&mut progress as &mut FetchProgressFn<'_>),
        None,
    )
    .await?;
    let archive = CreatePackFile::Downloaded(archive);

    reporter
        .update(InstallPhaseId::ReadingPackManifest, None, details.clone())
        .await?;
    reporter
        .set_context(
            InstallErrorContext::new("read modpack manifest")
                .project_id(project_id.clone())
                .version_id(file_id.clone())
                .entry_path("manifest.json")
                .build(),
        )
        .await?;
    let manifest: CurseForgeManifest = serde_json::from_str(
        &read_pack_entry(&archive, "manifest.json")
            .await?
            .ok_or_else(|| {
                crate::ErrorKind::InputError(
                    "This file isn't a CurseForge modpack: it has no manifest.json"
                        .to_string(),
                )
            })?,
    )?;
    if manifest.overrides.trim_end_matches('/') != OVERRIDES_FOLDER {
        return Err(crate::ErrorKind::InputError(format!(
            "Modpacks that keep their overrides in a folder other than `{OVERRIDES_FOLDER}` aren't supported yet"
        ))
        .into());
    }
    let dependencies = pack_dependencies(&manifest.minecraft)?;
    apply_versions(&instance_id, &dependencies).await?;

    reporter
        .update(InstallPhaseId::ResolvingPack, None, details.clone())
        .await?;
    reporter
        .set_context(
            InstallErrorContext::new("resolve modpack content on CurseForge")
                .project_id(project_id.clone())
                .version_id(file_id.clone())
                .build(),
        )
        .await?;
    let required_files = manifest
        .files
        .iter()
        .filter(|file| file.required)
        .collect::<Vec<_>>();
    let files = curseforge::get_files(
        &required_files
            .iter()
            .map(|file| file.file_id)
            .collect::<Vec<_>>(),
        &state.api_semaphore,
        &state.pool,
    )
    .await?;
    let mods = curseforge::get_mods(
        &required_files
            .iter()
            .map(|file| file.project_id)
            .collect::<Vec<_>>(),
        &state.api_semaphore,
        &state.pool,
    )
    .await?;
    let files_by_id = files
        .into_iter()
        .map(|file| (file.id, file))
        .collect::<HashMap<_, _>>();
    let mods_by_id = mods
        .into_iter()
        .map(|project| (project.id, project))
        .collect::<HashMap<_, _>>();

    let mut pack_files = Vec::new();
    let mut unavailable = Vec::new();
    for entry in &required_files {
        let project = mods_by_id.get(&entry.project_id);
        let file = files_by_id.get(&entry.file_id);
        match (project, file) {
            (Some(project), Some(file)) => match pack_file_for(project, file) {
                Some(pack_file) => {
                    external_source_rows::upsert_external_source(
                        &file.sha1().unwrap_or_default(),
                        &project.external_source(file),
                        false,
                        &state.pool,
                    )
                    .await?;
                    pack_files.push(pack_file);
                }
                None => unavailable.push(project.name.clone()),
            },
            (Some(project), None) => unavailable.push(project.name.clone()),
            (None, _) => unavailable.push(format!(
                "project {} (file {})",
                entry.project_id, entry.file_id
            )),
        }
    }
    if !unavailable.is_empty() {
        emit_warning(&format!(
            "{} of the files in {title} couldn't be downloaded automatically, because their authors don't allow downloads from other apps or they were removed from CurseForge: {}",
            unavailable.len(),
            unavailable.join(", "),
        ))
        .await?;
    }

    let icon = match icon_url {
        Some(icon_url) => {
            let bytes = fetch(
                &icon_url,
                None,
                None,
                None,
                &state.fetch_semaphore,
                &state.pool,
            )
            .await?;
            let icon = crate::api::instance::cache_icon(bytes, &state).await?;
            let _ = crate::api::instance::edit_icon(
                &instance_id,
                Some(icon.as_path()),
            )
            .await;
            Some(icon)
        }
        None => None,
    };

    Ok(CreatePack {
        file: archive,
        description: CreatePackDescription {
            icon,
            override_title: Some(title),
            project_id: None,
            version_id: None,
            instance_id,
            source_filename: Some(pack_file.file_name.clone()),
            link: Some(InstanceLink::CurseForgeModpack {
                project_id,
                file_id,
                name: Some(manifest.name.clone()),
                version_number: Some(pack_file.display_name.clone()),
            }),
        },
        manifest: Some(PackFormat {
            game: "minecraft".to_string(),
            format_version: 1,
            version_id: manifest.version,
            name: manifest.name,
            summary: None,
            files: pack_files,
            dependencies,
        }),
    })
}

fn parse_id(id: &str, kind: &str) -> crate::Result<u32> {
    id.parse().map_err(|_| {
        crate::ErrorKind::InputError(format!(
            "Invalid CurseForge {kind} id {id}"
        ))
        .into()
    })
}

/// The pack entry for a resolved file, or `None` when it can't be downloaded or installed.
fn pack_file_for(
    project: &CurseForgeMod,
    file: &CurseForgeFile,
) -> Option<PackFile> {
    let url = file.download_url.clone()?;
    let sha1 = file.sha1()?;
    let project_type = project.project_type()?;
    let path = SafeRelativeUtf8UnixPathBuf::try_from(format!(
        "{}/{}",
        project_type.get_folder(),
        file.file_name
    ))
    .ok()?;

    Some(PackFile {
        path,
        hashes: HashMap::from([(PackFileHash::Sha1, sha1)]),
        env: None,
        downloads: vec![url],
        file_size: u32::try_from(file.file_length).ok()?,
    })
}

/// The Minecraft version and loader a pack's manifest asks for.
fn pack_dependencies(
    minecraft: &CurseForgeManifestMinecraft,
) -> crate::Result<HashMap<PackDependency, String>> {
    let mut dependencies =
        HashMap::from([(PackDependency::Minecraft, minecraft.version.clone())]);
    let loader = minecraft
        .mod_loaders
        .iter()
        .find(|loader| loader.primary)
        .or_else(|| minecraft.mod_loaders.first());
    if let Some(loader) = loader {
        let (name, version) = loader.id.split_once('-').ok_or_else(|| {
            crate::ErrorKind::InputError(format!(
                "Unknown mod loader {}",
                loader.id
            ))
        })?;
        let dependency = match name {
            "forge" => PackDependency::Forge,
            "neoforge" => PackDependency::NeoForge,
            "fabric" => PackDependency::FabricLoader,
            "quilt" => PackDependency::QuiltLoader,
            other => {
                return Err(crate::ErrorKind::InputError(format!(
                    "Unsupported mod loader {other}"
                ))
                .into());
            }
        };
        dependencies.insert(dependency, version.to_string());
    }
    Ok(dependencies)
}

/// Shows the pack's Minecraft version and loader on the instance while the pack downloads.
async fn apply_versions(
    instance_id: &str,
    dependencies: &HashMap<PackDependency, String>,
) -> crate::Result<()> {
    let Some(game_version) = dependencies.get(&PackDependency::Minecraft)
    else {
        return Ok(());
    };
    let loader = dependencies
        .keys()
        .find_map(|dependency| match dependency {
            PackDependency::Forge => Some(crate::data::ModLoader::Forge),
            PackDependency::NeoForge => Some(crate::data::ModLoader::NeoForge),
            PackDependency::FabricLoader => {
                Some(crate::data::ModLoader::Fabric)
            }
            PackDependency::QuiltLoader => Some(crate::data::ModLoader::Quilt),
            PackDependency::Minecraft => None,
        })
        .unwrap_or(crate::data::ModLoader::Vanilla);
    crate::api::instance::edit(
        instance_id,
        EditInstance {
            content_set_patch: Some(AppliedContentSetPatch {
                source_kind: None,
                game_version: Some(game_version.clone()),
                protocol_version: Some(None),
                loader: Some(loader),
                loader_version: None,
            }),
            ..EditInstance::default()
        },
    )
    .await
    .map(|_| ())
}
