// TransLang AI — desktop shell entry point.
//
// Phase-1 strategy: the Tauri window loads the live web app (translangai.vercel.app
// in release, http://localhost:3000 in dev), so we get a native macOS / Windows
// shell with zero refactor of the existing Next.js code.
//
// Phase-2 additions land here: native global hotkey (⌘⇧D / Ctrl+Shift+D),
// system tray, deep links, "Translate Selection" via macOS Services.

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Bring the main window to front on launch (helps if relaunched while hidden).
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
