fn main() -> Result<(), Box<dyn std::error::Error>> {
    refract_lib::export_app_event_bindings(
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../apps/app-frontend/src/generated/app-events"),
    )
}
