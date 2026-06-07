#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data_pack;
mod generated_data_pack;

use data_pack::read_desktop_data_file;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![read_desktop_data_file])
    .setup(|app| {
      WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Little Tank")
        .inner_size(1280.0, 800.0)
        .min_inner_size(960.0, 640.0)
        .resizable(true)
        .visible(true)
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Little Tank");
}
