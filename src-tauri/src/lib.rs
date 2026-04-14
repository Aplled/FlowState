use tauri::webview::WebviewBuilder;
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Url, WebviewUrl,
    WebviewWindowBuilder, Window,
};

fn chrome_offset(window: &Window) -> (f64, f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let inner: PhysicalPosition<i32> = window
        .inner_position()
        .unwrap_or(PhysicalPosition { x: 0, y: 0 });
    let outer: PhysicalPosition<i32> = window
        .outer_position()
        .unwrap_or(PhysicalPosition { x: 0, y: 0 });
    let dx = (inner.x - outer.x) as f64 / scale;
    let dy = (inner.y - outer.y) as f64 / scale;
    (dx, dy)
}

const DESKTOP_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

#[tauri::command]
async fn browser_embed_create(
    app: AppHandle,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(existing) = app.get_webview(&label) {
        let _ = existing.close();
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let (dx, dy) = chrome_offset(&window);
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("embedded-browser");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let builder = WebviewBuilder::new(label.as_str(), WebviewUrl::External(parsed))
        .user_agent(DESKTOP_USER_AGENT)
        .data_directory(data_dir)
        .incognito(false);

    window
        .add_child(
            builder,
            LogicalPosition::new(x + dx, y + dy),
            LogicalSize::new(width.max(1.0), height.max(1.0)),
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn browser_embed_set_bounds(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{}' not found", label))?;
    let main = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let (dx, dy) = chrome_offset(&main);
    webview
        .set_position(LogicalPosition::new(x + dx, y + dy))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn browser_embed_close(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn browser_embed_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{}' not found", label))?;
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    webview.navigate(parsed).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn browser_open_standalone(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    let label = format!(
        "standalone-browser-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("embedded-browser");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, label.as_str(), WebviewUrl::External(parsed))
        .title("Browser")
        .inner_size(1100.0, 800.0)
        .resizable(true)
        .user_agent(DESKTOP_USER_AGENT)
        .data_directory(data_dir)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            browser_embed_create,
            browser_embed_set_bounds,
            browser_embed_close,
            browser_embed_navigate,
            browser_open_standalone,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
