/**
 * 跨平台打开浏览器工具
 */
import { exec } from 'child_process';
import os from 'os';

/**
 * 使用系统默认浏览器打开指定 URL
 */
export function openBrowser(url) {
  const platform = os.platform();
  let command;

  switch (platform) {
    case 'win32':
      // Windows 使用 start 命令
      command = `start "" "${url}"`;
      exec(command, (err) => {
        if (err) {
          // 降级方案
          exec(`cmd /c start "" "${url}"`);
        }
      });
      break;
    case 'darwin':
      // macOS 使用 open 命令
      command = `open "${url}"`;
      exec(command);
      break;
    case 'linux':
      // Linux 使用 xdg-open
      command = `xdg-open "${url}"`;
      exec(command);
      break;
    default:
      console.warn(`Unsupported platform: ${platform}, cannot open browser automatically`);
  }
}
