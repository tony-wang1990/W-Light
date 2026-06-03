# W-Light 全端客户端发布矩阵

W-Light 的生产架构是“一套云端后端 + 多端客户端”。所有客户端都连接同一个 API：

```text
https://你的域名/v1
http://服务器IP:3005/v1
```

只要 API 地址一致，Windows、Mac、Web、Android、iOS 的工单、设备、巡检、备件、附件数据都会进入同一套 PostgreSQL/MinIO，因此天然同步。

## 平台矩阵

| 平台 | 形态 | 当前状态 | 安装/使用方式 | 同步方式 |
| --- | --- | --- | --- | --- |
| 服务器 ARM64 | Docker 服务端 | 已支持 | `scripts/server-deploy.sh --port 3005` | PostgreSQL/MinIO/Redis |
| 服务器 AMD64 | Docker 服务端 | 已支持 | `scripts/server-deploy.sh --port 3005` | PostgreSQL/MinIO/Redis |
| Web 浏览器 | Web 管理端 | 已支持 | 打开 `http://服务器IP:3005` | 同源 `/v1` |
| Windows | PWA 桌面客户端 | 已支持安装基础 | Edge/Chrome 打开 Web 后“安装此应用” | 同源 `/v1` |
| Mac | PWA 桌面客户端 | 已支持安装基础 | Chrome/Edge 安装为应用，Safari 可添加到 Dock | 同源 `/v1` |
| Android | React Native APK/AAB | 打包能力已支持，需打包机实测 | `scripts/android-release.*` 生成 APK；可放到 `/downloads` 下载 | 登录页配置 API |
| iOS | React Native IPA/TestFlight | 原生工程已支持，需 macOS/Xcode 实测 | Xcode Archive/TestFlight/Ad Hoc | 登录页配置 API |

## 当前优先级

1. 先把服务器部署跑稳：ARM64 和 AMD64 1C1G 都要实机验收。
2. Android 先出 APK 内测包：最适合现场快速发给工程师安装。
3. Windows/Mac 先用 PWA：不用额外装包工具，浏览器即可安装为桌面应用。
4. iOS 进入 TestFlight 或 Ad Hoc：需要 Apple 开发者账号和 macOS 打包机。
5. 如果后续必须提供 `.exe` / `.dmg` 安装包，再引入 Electron 或 Tauri 桌面壳。

## Windows/Mac 独立安装包路线

当前 Windows/Mac 已可通过 PWA 作为桌面客户端使用。独立安装包不是不能做，但会新增：

- Windows 代码签名证书。
- macOS Apple Developer ID、公证和 Gatekeeper 流程。
- Electron/Tauri 依赖和平台打包机。
- 自动更新策略。

建议先用 PWA 进入生产试运行，等现场确认真的需要 `.exe` / `.dmg` 后，再把 Web 壳封装为桌面安装包。

## 下载中心

部署后访问：

```text
http://服务器IP:3005/downloads/
```

这里会展示：

- Android APK 下载入口。
- Windows PWA 安装方式。
- Mac PWA 安装方式。
- iOS TestFlight/Ad Hoc 提示。

Android APK 发布到下载中心：

```bash
bash scripts/android-release.sh --publish-web
docker compose restart web
```

或本地打包后上传：

```powershell
scp apps\LightOps\android\app\build\outputs\apk\release\app-release.apk root@服务器IP:/root/W-Light/deploy/downloads/w-light-latest.apk
ssh root@服务器IP "cd /root/W-Light && docker compose restart web"
```

## 现场用户怎么选

- 维修工程师/灯光师用 Android：下载安装 APK。
- 管理员在办公室用 Windows/Mac：浏览器打开 Web 后安装 PWA。
- iPhone 用户：优先 TestFlight；没有 iOS 包时临时使用 Safari Web/PWA。
- Web 管理员：直接浏览器访问。

## 还需要实机完成的事

- Android APK 在真机上安装、登录、扫码、上传、离线队列同步。
- iOS Xcode Archive、签名、真机安装/TestFlight。
- Windows/Mac PWA 安装后的登录、刷新、离线缓存和附件下载。
- ARM64/AMD64 服务器各跑一轮部署和数据同步。
