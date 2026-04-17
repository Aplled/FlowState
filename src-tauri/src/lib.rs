use std::collections::HashMap;
use std::sync::Mutex;

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

/// Parse a URL and reject anything that isn't http(s). The frontend also
/// filters with `safeHttpUrl`, but this is the security boundary — client
/// code can be bypassed by anyone with DevTools.
fn validated_http_url(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw).map_err(|e| format!("invalid url: {}", e))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        other => Err(format!("scheme '{}' not allowed", other)),
    }
}

/// Filesystem-safe key identifying a cookie/localStorage partition. Per-origin
/// (scheme + host + port) so two BrowserNodes on github.com share a login,
/// but github.com and random-site.com do not.
fn origin_key(u: &Url) -> String {
    let host = u.host_str().unwrap_or("unknown");
    let port = u.port().map(|p| format!("_{}", p)).unwrap_or_default();
    // Sanitize: only alphanumerics, dots, and dashes survive as directory
    // name chars; everything else becomes an underscore.
    let safe: String = host
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("{}_{}{}", u.scheme(), safe, port)
}

fn embedded_browser_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("embedded-browser");
    std::fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

fn data_dir_for(app: &AppHandle, url: &Url) -> Result<std::path::PathBuf, String> {
    let dir = embedded_browser_root(app)?.join(origin_key(url));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Tracks the origin a given child webview was created with so that
/// `browser_embed_navigate` can detect cross-origin navigation and rebuild the
/// webview on a fresh data directory instead of leaking the previous origin's
/// session into the new one.
#[derive(Default)]
struct EmbedOrigins(Mutex<HashMap<String, String>>);

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
    let parsed = validated_http_url(&url)?;

    if let Some(existing) = app.get_webview(&label) {
        let _ = existing.close();
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let (dx, dy) = chrome_offset(&window);
    let data_dir = data_dir_for(&app, &parsed)?;
    let key = origin_key(&parsed);

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

    if let Some(state) = app.try_state::<EmbedOrigins>() {
        if let Ok(mut map) = state.0.lock() {
            map.insert(label, key);
        }
    }

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
    if let Some(state) = app.try_state::<EmbedOrigins>() {
        if let Ok(mut map) = state.0.lock() {
            map.remove(&label);
        }
    }
    Ok(())
}

#[tauri::command]
async fn browser_embed_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let parsed = validated_http_url(&url)?;
    let new_key = origin_key(&parsed);

    // Check whether the target origin matches the webview's creation origin.
    // If not, we can't just `navigate()` — the existing webview is bound to
    // the previous origin's data directory, which would leak that origin's
    // cookies into the new site. Close and recreate with the right data dir.
    let existing_key = app
        .try_state::<EmbedOrigins>()
        .and_then(|state| state.0.lock().ok().and_then(|m| m.get(&label).cloned()));

    if existing_key.as_deref() != Some(new_key.as_str()) {
        // Cross-origin navigation: recreate. We need the current bounds to
        // put it back in the same place.
        let (pos, size) = {
            let webview = app
                .get_webview(&label)
                .ok_or_else(|| format!("webview '{}' not found", label))?;
            let pos = webview
                .position()
                .map_err(|e| e.to_string())?;
            let size = webview
                .size()
                .map_err(|e| e.to_string())?;
            let scale = app
                .get_window("main")
                .map(|w| w.scale_factor().unwrap_or(1.0))
                .unwrap_or(1.0);
            let logical_pos = LogicalPosition::new(pos.x as f64 / scale, pos.y as f64 / scale);
            let logical_size =
                LogicalSize::new(size.width as f64 / scale, size.height as f64 / scale);
            (logical_pos, logical_size)
        };

        if let Some(webview) = app.get_webview(&label) {
            webview.close().map_err(|e| e.to_string())?;
        }

        let window = app
            .get_window("main")
            .ok_or_else(|| "main window not found".to_string())?;
        let data_dir = data_dir_for(&app, &parsed)?;
        let builder = WebviewBuilder::new(label.as_str(), WebviewUrl::External(parsed))
            .user_agent(DESKTOP_USER_AGENT)
            .data_directory(data_dir)
            .incognito(false);
        window
            .add_child(builder, pos, size)
            .map_err(|e| e.to_string())?;

        if let Some(state) = app.try_state::<EmbedOrigins>() {
            if let Ok(mut map) = state.0.lock() {
                map.insert(label, new_key);
            }
        }
        return Ok(());
    }

    // Same-origin navigation: regular navigate call.
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{}' not found", label))?;
    webview.navigate(parsed).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn browser_open_standalone(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = validated_http_url(&url)?;
    let label = format!(
        "standalone-browser-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let data_dir = data_dir_for(&app, &parsed)?;
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
        .manage(EmbedOrigins::default())
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
