mod sys;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("dynamicbar")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            sys::media_control,
            sys::set_volume,
            sys::resize_window,
            sys::set_brightness
        ])
        .setup(|app| {
            use tauri_plugin_autostart::ManagerExt;

            // Aktifkan autostart saat aplikasi pertama kali dijalankan.
            app.autolaunch().enable()?;

            let window = app.get_webview_window("main").unwrap();

            if let Some(monitor) = window.primary_monitor()? {
                let x = monitor.position().x
                    + (monitor.size().width as i32
                        - window.outer_size()?.width as i32)
                        / 2;

                window.set_position(tauri::PhysicalPosition::new(
                    x,
                    monitor.position().y,
                ))?;
            }

            sys::start(app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}