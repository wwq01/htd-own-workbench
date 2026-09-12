// S3-1 · Tauri 桌面壳入口
// S3-2 · 系统集成：托盘 / 关闭最小化到托盘 / 全局快捷键 / 通知
//
// 设计原则：**业务代码 0 改动**。壳只做四件事：
//   1. 以 sidecar 方式拉起既有的 Node 后端（pkg 打包产物 htd-backend）
//   2. 从 sidecar 的 stdout 解析 HTD_READY，拿到真实端口后让 webview 加载该地址
//   3. 系统集成：系统托盘（点 X 隐藏到托盘而非退出）、全局快捷键唤起、原生通知
//   4. 应用退出时回收 sidecar 子进程（否则孤儿 Node 进程会长期持有 SQLite 写锁）
//
// 页面刻意走 http://127.0.0.1:<port>（由 Express 提供静态资源），而不是 Tauri 的
// asset:// 协议：这样 Origin 与 Web 版完全一致，originGuard 的白名单无需任何改动。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

/// 必须与 backend/src/server.js 输出的就绪行前缀保持一致
/// （由 backend/scripts/verify-tauri-config.js 门禁双向校验）
const READY_PREFIX: &str = "HTD_READY ";

/// 起始端口。后端会自行在 17388/17389/17390 中顺延，并在 HTD_READY 里回报真实端口，
/// 故此处只需给出起始值，不需要壳侧重试。必须与 port.js 的 FIXED_PORTS 首项一致。
const START_PORT: u16 = 17388;

/// 唤起/隐藏主窗口的全局快捷键。
/// 格式由 global-hotkey 解析：修饰词仅支持 CTRL/ALT/SHIFT/SUPER，主键必须在最后一个
/// token（例如 "Ctrl+Alt+H" 合法，"Ctrl+H+Alt" 非法）。注册失败（被其它程序占用）
/// 只告警不阻断启动。
const HOTKEY_TOGGLE: &str = "Ctrl+Alt+H";

const MENU_TOGGLE: &str = "htd.toggle";
const MENU_OPEN_DATA: &str = "htd.open-data";
const MENU_QUIT: &str = "htd.quit";

/// 持有 sidecar 子进程句柄，供退出时 kill
struct SidecarState(Mutex<Option<CommandChild>>);

/// 是否为「真正退出」。点窗口关闭按钮只隐藏到托盘，只有托盘菜单的「退出」才置位，
/// 用于让 on_window_event 放行真实的关闭请求。
struct Quitting(AtomicBool);

/// 是否已提示过「已最小化到托盘」，避免每次隐藏都弹系统通知打扰用户
struct TrayHinted(AtomicBool);

/// 数据目录（Tauri AppData），托盘「打开数据目录」与 sidecar 启动共用
struct DataRoot(String);

/// 显示 / 隐藏主窗口。托盘点击、托盘菜单、全局快捷键共用同一套行为。
fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if matches!(w.is_visible(), Ok(true)) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        // 全局快捷键：Ctrl+Alt+H 唤起/隐藏。仅按下时触发，避免长按重复切换
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        // 单实例：二次启动时聚焦已有窗口，避免两个进程同时写同一个 SQLite 库
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();

            // 数据目录交给 Tauri 管理的 AppData 路径，通过环境变量传给 sidecar
            let data_root = handle
                .path()
                .app_data_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if !data_root.is_empty() {
                let _ = std::fs::create_dir_all(&data_root);
            }

            handle.manage(SidecarState(Mutex::new(None)));
            handle.manage(Quitting(AtomicBool::new(false)));
            handle.manage(TrayHinted(AtomicBool::new(false)));
            handle.manage(DataRoot(data_root.clone()));

            // ---- 系统托盘 ----
            let toggle_item = MenuItemBuilder::with_id(MENU_TOGGLE, "显示 / 隐藏").build(app)?;
            let data_item = MenuItemBuilder::with_id(MENU_OPEN_DATA, "打开数据目录").build(app)?;
            let quit_item = MenuItemBuilder::with_id(MENU_QUIT, "退出").build(app)?;

            // 分隔符在部分平台由原生菜单托管，构建失败不影响托盘可用性
            let menu = MenuBuilder::new(app)
                .item(&toggle_item)
                .item(&data_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("荒天帝工作台")
                .menu(&menu)
                // 左键单击直接切换窗口（更符合工作台「随叫随到」的诉求），右键出菜单
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    MENU_TOGGLE => toggle_main_window(app),
                    MENU_OPEN_DATA => {
                        let root = app.state::<DataRoot>();
                        if !root.0.is_empty() {
                            let _ = app.shell().open(root.0.clone(), None);
                        }
                    }
                    MENU_QUIT => {
                        app.state::<Quitting>().0.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            // 托盘图标复用打包进来的应用图标，避免额外引入图片解码依赖
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            // ---- 全局快捷键注册 ----
            if let Err(e) = app.global_shortcut().register(HOTKEY_TOGGLE) {
                eprintln!("[htd] 注册全局快捷键 {} 失败：{}", HOTKEY_TOGGLE, e);
            }

            // ---- 拉起 Node 后端 sidecar ----
            let window: WebviewWindow = handle
                .get_webview_window("main")
                .expect("main 窗口必须存在");

            let ready_window = window.clone();

            let cmd = handle
                .shell()
                .sidecar("htd-backend")
                .expect("sidecar htd-backend 未声明，检查 tauri.conf.json 的 externalBin")
                .env("HTD_DESKTOP", "1")
                .env("HTD_PORT", START_PORT.to_string())
                .env("HTD_DATA_ROOT", &data_root);

            match cmd.spawn() {
                Ok((mut rx, child)) => {
                    // 先登记句柄，保证任何后续路径都能回收子进程
                    handle
                        .state::<SidecarState>()
                        .0
                        .lock()
                        .expect("SidecarState 锁损坏")
                        .replace(child);

                    // stdout 按行到达；找到 HTD_READY 行即解析端口并加载页面
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            if let CommandEvent::Stdout(bytes) = event {
                                let line = String::from_utf8_lossy(&bytes);
                                let Some(json) = line.trim().strip_prefix(READY_PREFIX) else {
                                    continue;
                                };
                                let Ok(value) = serde_json::from_str::<serde_json::Value>(json)
                                else {
                                    continue;
                                };
                                let Some(url) = value.get("url").and_then(|u| u.as_str()) else {
                                    continue;
                                };
                                let parsed: tauri::Url = url.parse().expect("HTD_READY 中的 url 非法");
                                let _ = ready_window.navigate(parsed);
                                let _ = ready_window.show();
                                let _ = ready_window.set_focus();
                                break;
                            }
                        }
                    });
                }
                Err(e) => {
                    // 拉不起后端时也要把窗口显示出来并给出可读提示，避免用户看到无响应窗口
                    let msg = format!("无法启动后端服务：{}", e).replace('\'', " ");
                    let _ = window.show();
                    let _ = window.eval(&format!(
                        "document.body.style.cssText='font:14px system-ui;padding:24px;color:#333';\
                         document.body.textContent='{}';",
                        msg
                    ));
                }
            }

            Ok(())
        })
        // 点关闭按钮 = 隐藏到托盘，后端继续在后台跑（工作台需要「秒回」的语境）
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<Quitting>().0.load(Ordering::SeqCst) {
                    return;
                }
                let _ = window.hide();
                api.prevent_close();

                // 首次隐藏时提示一次，让用户知道去哪里找回窗口
                if !window.state::<TrayHinted>().0.swap(true, Ordering::SeqCst) {
                    let _ = window
                        .notification()
                        .builder()
                        .title("荒天帝工作台")
                        .body("已最小化到系统托盘，点击托盘图标或按 Ctrl+Alt+H 重新打开")
                        .show();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("构建 Tauri 应用失败")
        .run(|app_handle, event| {
            // 退出前回收 sidecar：孤儿 Node 进程会持有 SQLite 写锁，导致下次启动异常
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
