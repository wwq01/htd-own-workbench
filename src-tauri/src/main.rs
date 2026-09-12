// S3-1 · Tauri 桌面壳入口
//
// 设计原则：**业务代码 0 改动**。壳只做三件事：
//   1. 以 sidecar 方式拉起既有的 Node 后端（pkg 打包产物 htd-backend）
//   2. 从 sidecar 的 stdout 解析 HTD_READY，拿到真实端口后让 webview 加载该地址
//   3. 应用退出时回收 sidecar 子进程（否则孤儿 Node 进程会长期持有 SQLite 写锁）
//
// 页面刻意走 http://127.0.0.1:<port>（由 Express 提供静态资源），而不是 Tauri 的
// asset:// 协议：这样 Origin 与 Web 版完全一致，originGuard 的白名单无需任何改动。
//
// ⚠️ 本文件尚未经过 cargo 编译验证（本机暂无 Rust 工具链）。首次编译时若 API 有
// 微调（例如 navigate 要求 Url 类型），按编译器提示修正即可，逻辑无需变动。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use tauri::{Manager, RunEvent, WebviewWindow};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

/// 必须与 backend/src/server.js 输出的就绪行前缀保持一致
/// （由 backend/scripts/verify-tauri-config.js 门禁双向校验）
const READY_PREFIX: &str = "HTD_READY ";

/// 起始端口。后端会自行在 17388/17389/17390 中顺延，并在 HTD_READY 里回报真实端口，
/// 故此处只需给出起始值，不需要壳侧重试。必须与 port.js 的 FIXED_PORTS 首项一致。
const START_PORT: u16 = 17388;

/// 持有 sidecar 子进程句柄，供退出时 kill
struct SidecarState(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
