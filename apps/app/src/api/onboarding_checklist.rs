use crate::api::Result;
use refract_lib::prelude::*;
use tauri::plugin::TauriPlugin;

pub fn init<R: tauri::Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("onboarding-checklist")
        .invoke_handler(tauri::generate_handler![get_onboarding_checklist])
        .build()
}

#[tauri::command]
pub async fn get_onboarding_checklist() -> Result<OnboardingChecklist> {
    Ok(onboarding_checklist::get().await?)
}
