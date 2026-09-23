//! A minimal client for the CurseForge Core API, for work that runs in the background such as
//! installing modpacks.

use crate::state::{ExternalContentSource, ExternalPlatform, ProjectType};
use crate::util::fetch::{FetchSemaphore, fetch_advanced};
use reqwest::Method;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use sqlx::SqlitePool;

const API_URL: &str = "https://api.curseforge.com/v1/";

#[derive(Deserialize)]
struct Response<T> {
    data: T,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurseForgeMod {
    pub id: u32,
    pub name: String,
    pub slug: String,
    pub class_id: Option<u32>,
    #[serde(default)]
    pub authors: Vec<CurseForgeAuthor>,
    pub logo: Option<CurseForgeAsset>,
    pub links: Option<CurseForgeLinks>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurseForgeAuthor {
    pub id: u32,
    pub name: String,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurseForgeAsset {
    pub thumbnail_url: Option<String>,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurseForgeLinks {
    pub website_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurseForgeFile {
    pub id: u32,
    pub display_name: String,
    pub file_name: String,
    pub file_date: String,
    pub file_length: u64,
    /// Missing when the author doesn't allow downloads from third-party apps.
    pub download_url: Option<String>,
    #[serde(default)]
    pub hashes: Vec<CurseForgeFileHash>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CurseForgeFileHash {
    pub value: String,
    /// 1 is SHA-1, 2 is MD5.
    pub algo: u8,
}

impl CurseForgeFile {
    pub fn sha1(&self) -> Option<String> {
        self.hashes
            .iter()
            .find(|hash| hash.algo == 1)
            .map(|hash| hash.value.to_lowercase())
    }
}

impl CurseForgeMod {
    pub fn icon_url(&self) -> Option<String> {
        self.logo.as_ref().and_then(|logo| {
            logo.thumbnail_url.clone().or_else(|| logo.url.clone())
        })
    }

    /// The content type of the project, for the classes that can be installed into an instance.
    pub fn project_type(&self) -> Option<ProjectType> {
        match self.class_id? {
            6 => Some(ProjectType::Mod),
            12 => Some(ProjectType::ResourcePack),
            6552 => Some(ProjectType::ShaderPack),
            6945 => Some(ProjectType::DataPack),
            _ => None,
        }
    }

    /// Where `file` of this project came from, as recorded for installed content.
    pub fn external_source(
        &self,
        file: &CurseForgeFile,
    ) -> ExternalContentSource {
        let author = self.authors.first();
        ExternalContentSource {
            platform: ExternalPlatform::CurseForge,
            project_id: self.id.to_string(),
            file_id: file.id.to_string(),
            project_slug: Some(self.slug.clone()),
            project_title: self.name.clone(),
            project_icon_url: self.icon_url(),
            project_url: self
                .links
                .as_ref()
                .and_then(|links| links.website_url.clone()),
            author_id: author.map(|author| author.id.to_string()),
            author_name: author.map(|author| author.name.clone()),
            author_url: author.and_then(|author| author.url.clone()),
            file_display_name: Some(file.display_name.clone()),
            file_date: Some(file.file_date.clone()),
        }
    }
}

fn api_key() -> crate::Result<&'static str> {
    option_env!("CURSEFORGE_API_KEY")
        .filter(|key| !key.is_empty())
        .ok_or_else(|| {
            crate::ErrorKind::InputError(
                "CurseForge isn't available because this build has no CurseForge API key".to_string(),
            )
            .into()
        })
}

async fn request<T: DeserializeOwned>(
    method: Method,
    path: &str,
    body: Option<serde_json::Value>,
    semaphore: &FetchSemaphore,
    pool: &SqlitePool,
) -> crate::Result<T> {
    let bytes = fetch_advanced(
        method,
        &format!("{API_URL}{path}"),
        None,
        body,
        Some(("x-api-key", api_key()?)),
        None,
        None,
        None,
        semaphore,
        pool,
    )
    .await?;
    Ok(serde_json::from_slice::<Response<T>>(&bytes)?.data)
}

pub(crate) async fn get_file(
    mod_id: u32,
    file_id: u32,
    semaphore: &FetchSemaphore,
    pool: &SqlitePool,
) -> crate::Result<CurseForgeFile> {
    request(
        Method::GET,
        &format!("mods/{mod_id}/files/{file_id}"),
        None,
        semaphore,
        pool,
    )
    .await
}

/// Returns the files with the given ids. Files that no longer exist are left out.
pub(crate) async fn get_files(
    file_ids: &[u32],
    semaphore: &FetchSemaphore,
    pool: &SqlitePool,
) -> crate::Result<Vec<CurseForgeFile>> {
    if file_ids.is_empty() {
        return Ok(Vec::new());
    }
    request(
        Method::POST,
        "mods/files",
        Some(serde_json::json!({ "fileIds": file_ids })),
        semaphore,
        pool,
    )
    .await
}

/// Returns the projects with the given ids. Projects that no longer exist are left out.
pub(crate) async fn get_mods(
    mod_ids: &[u32],
    semaphore: &FetchSemaphore,
    pool: &SqlitePool,
) -> crate::Result<Vec<CurseForgeMod>> {
    if mod_ids.is_empty() {
        return Ok(Vec::new());
    }
    request(
        Method::POST,
        "mods",
        Some(serde_json::json!({ "modIds": mod_ids })),
        semaphore,
        pool,
    )
    .await
}
