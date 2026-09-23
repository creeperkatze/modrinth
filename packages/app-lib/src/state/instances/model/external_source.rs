use crate::state::ProjectType;
use serde::{Deserialize, Serialize};

use super::unknown_value;

/// A content platform other than Modrinth that files can be installed from.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum ExternalPlatform {
    #[serde(rename = "curseforge")]
    CurseForge,
}

impl ExternalPlatform {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CurseForge => "curseforge",
        }
    }

    pub fn from_stored_str(value: &str) -> crate::Result<Self> {
        match value {
            "curseforge" => Ok(Self::CurseForge),
            other => Err(unknown_value("external platform", other)),
        }
    }

    /// Hosts that files from this platform may be downloaded from.
    pub fn is_download_host(self, host: &str) -> bool {
        match self {
            Self::CurseForge => {
                host == "edge.forgecdn.net" || host == "mediafilez.forgecdn.net"
            }
        }
    }
}

/// Where a content file came from on an external platform, keyed by the file's SHA-1.
///
/// Project details are a snapshot taken at install time so installed content can be
/// displayed without querying the platform.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExternalContentSource {
    pub platform: ExternalPlatform,
    pub project_id: String,
    pub file_id: String,
    pub project_slug: Option<String>,
    pub project_title: String,
    pub project_icon_url: Option<String>,
    pub project_url: Option<String>,
    pub author_name: Option<String>,
    pub author_url: Option<String>,
    pub file_display_name: Option<String>,
    pub file_date: Option<String>,
}

/// A file from an external platform, already resolved by the caller, to install into an instance.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstallExternalFileRequest {
    pub url: String,
    pub file_name: String,
    pub sha1: String,
    pub project_type: ProjectType,
    pub source: ExternalContentSource,
}
