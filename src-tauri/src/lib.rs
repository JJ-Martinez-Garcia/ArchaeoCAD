#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env, fs,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[tauri::command]
fn app_info() -> &'static str {
    "ArchaeoCAD"
}

/// Converts DWG files with an OpenCADStudio executable installed alongside
/// the desktop build. The web/PWA path continues to use LibreDWG-WASM.
#[tauri::command]
fn convert_dwg_with_opencadstudio(input: Vec<u8>) -> Result<Vec<u8>, String> {
    let executable =
        env::var("ARCHAEOCAD_OPENCADSTUDIO").unwrap_or_else(|_| "OpenCADStudio".to_string());
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp = env::temp_dir().join(format!("archaeocad-{stamp}"));
    fs::create_dir_all(&temp).map_err(|e| e.to_string())?;
    let input_path = temp.join("input.dwg");
    let output_path = temp.join("output.dxf");
    fs::write(&input_path, input).map_err(|e| e.to_string())?;
    let result = Command::new(&executable)
        .arg("--export")
        .arg(&input_path)
        .arg(&output_path)
        .output()
        .map_err(|e| format!("No se encontró OpenCADStudio ({e})"))?;
    let bytes = if result.status.success() {
        fs::read(&output_path).map_err(|e| e.to_string())?
    } else {
        return Err(String::from_utf8_lossy(&result.stderr).trim().to_string());
    };
    let _ = fs::remove_dir_all(&temp);
    Ok(bytes)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app_info,
            convert_dwg_with_opencadstudio
        ])
        .run(tauri::generate_context!())
        .expect("error while running ArchaeoCAD");
}
