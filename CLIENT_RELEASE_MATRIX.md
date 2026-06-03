# W-Light 全端客户端发布矩阵

W-Light 的生产架构是“一套云端后端 + 多端客户端”。所有客户端都连接同一个 API：

```text
https://你的域名/v1
http://服务器IP:3005/v1
```

只要 API 地址一致，Windows、Mac、Web、Android、iOS 的工单、设备、巡检、备件和附件数据都会进入同一套 PostgreSQL/MinIO，因此天然同步。

## 平台矩阵

| 平台 | 形态 | 当前状态 | 安装/使用方式 | 同步方式 |
| --- | --- | --- | --- | --- |
| 服务器 ARM64 | Docker 服务端 | 已支持 | `scripts/server-deploy.sh --port 3005` | PostgreSQL/MinIO/Redis |
| 服务器 AMD64 | Docker 服务端 | 已支持 | `scripts/server-deploy.sh --port 3005` | PostgreSQL/MinIO/Redis |
| Web 浏览器 | Web 管理端 | 已支持 | 打开 `http://服务器IP:3005` | 同源 `/v1` |
| Windows | Electron 安装包 | 已补齐打包能力 | `scripts/desktop-release.ps1 -Target win` 生成 `.exe` | 登录页配置 API |
| Mac | Electron DMG | 已补齐打包能力 | `scripts/desktop-release.sh --mac` 生成 `.dmg` | 登录页配置 API |
| Linux | Electron AppImage | 已补齐打包能力 | `scripts/desktop-release.sh --linux` 生成 `.AppImage` | 登录页配置 API |
| Android | React Native APK/AAB | 打包能力已支持，需打包机实测 | `scripts/android-release.*` 生成 APK/AAB | 登录页配置 API |
| iOS | React Native IPA/TestFlight | 原生工程已支持，需 macOS/Xcode 实测 | Xcode Archive/TestFlight/Ad Hoc | 登录页配置 API |

## 下载中心

部署后访问：

```text
http://服务器IP:3005/downloads/
```

下载中心会展示：

- Windows 安装包：`W-Light-Setup-latest.exe`
- Mac 安装包：`W-Light-latest.dmg`
- Android APK：`w-light-latest.apk`
- Web/PWA 备用入口
- iOS TestFlight/Ad Hoc 提示

如果某个按钮 404，说明对应安装包还没有发布到服务器的 `deploy/downloads/` 目录。

## 桌面客户端发布

完整说明见 [DESKTOP_CLIENT_GUIDE.md](DESKTOP_CLIENT_GUIDE.md)。

Windows 本地打包：

```powershell
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

macOS 打包：

```bash
bash scripts/desktop-release.sh --mac --publish-web
```

Linux 打包：

```bash
bash scripts/desktop-release.sh --linux --publish-web
```

发布到服务器后重启 Web 容器：

```bash
cd /root/W-Light
docker compose restart web
```

## 手机端发布

完整说明见 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md)。

Android APK 发布：

```bash
bash scripts/android-release.sh --publish-web
docker compose restart web
```

iOS 需要 macOS、Xcode、Apple Developer 账号和签名配置。没有 iOS 包时，可以让 iPhone 用户临时使用 Safari 打开 Web 端并添加到主屏幕。

## 现场用户怎么选

- 维修工程师/灯光师：优先 Android APK，方便现场扫码、拍照、离线队列。
- 项目管理员：Windows/Mac 桌面客户端或 Web 管理端。
- iPhone 用户：优先 TestFlight/Ad Hoc；正式包未完成前使用 Safari Web/PWA。
- 服务器管理员：使用 `scripts/server-deploy.sh --port 3005` 部署和升级。

## 仍需实机完成的事

- Windows `.exe` 在 Windows 设备上安装、登录、附件下载和重启验证。
- macOS `.dmg` 在 Intel/Apple Silicon Mac 上安装、登录和 Gatekeeper 处理验证。
- Android APK 在真机上安装、扫码、上传、离线队列同步验证。
- iOS Xcode Archive、签名、真机安装或 TestFlight 验证。
- ARM64/AMD64 服务器各跑一轮部署和数据同步验收。
