# W-Light 桌面客户端发布与验收清单

本文档用于确认 Windows、macOS、Linux 桌面客户端是否达到可交付状态。桌面端是 Electron 真客户端，内置 Web 管理端，所有数据通过同一套云端 API 同步。

## 当前状态

- Windows 安装包 `W-Light-Setup-latest.exe` 已生成到 `deploy/downloads/`，并通过 `downloads:verify -- --strict` 校验。
- Windows 安装包仍需在干净 Windows 机器上做安装、登录、升级覆盖安装和卸载测试。
- macOS DMG 与 Linux AppImage 打包入口已具备，但必须在对应平台完成构建和验收。
- macOS 正式分发需要 Apple Developer ID 签名和 notarization。
- Windows 正式对外分发建议配置代码签名证书，避免 SmartScreen 强提醒。

## 打包前检查

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter web run build
corepack pnpm --filter web run test
corepack pnpm --filter web run test:e2e
```

服务器首次部署或升级后，先检查后端：

```bash
cd /root/W-Light
bash scripts/server-smoke.sh --base-url http://服务器IP:3005 --phone 13800000001 --password '你的管理员密码'
```

## Windows

- [ ] 使用 Windows 10/11 打包机执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/desktop-release.ps1 -Target win -PublishWeb
corepack pnpm downloads:verify -- --strict
```

- [ ] 在干净 Windows 机器下载安装 `http://服务器IP:3005/downloads/W-Light-Setup-latest.exe`。
- [ ] 安装后桌面/开始菜单可启动 W-Light。
- [ ] 登录页服务器地址填写 `http://服务器IP:3005/v1` 后可登录。
- [ ] 工单、设备、备件、巡检、报表、工具箱菜单可打开。
- [ ] 退出登录后重新打开客户端仍可重新登录。
- [ ] 覆盖安装新版本不会破坏 API 地址缓存和登录流程。
- [ ] 卸载后程序目录被清理。

## macOS

- [ ] 在 macOS 打包机执行：

```bash
bash scripts/desktop-release.sh --mac --publish-web
```

- [ ] 未签名内测包可通过右键“打开”启动。
- [ ] 正式分发包已完成 Developer ID 签名和公证。
- [ ] Apple Silicon 和 Intel Mac 至少各验收一个目标，或明确只交付其中一种架构。
- [ ] 登录同一服务器后，数据与 Web/手机端同步。

## Linux

- [ ] 在 Linux 打包机执行：

```bash
bash scripts/desktop-release.sh --linux --publish-web
```

- [ ] AppImage 下载后可添加执行权限并启动：

```bash
chmod +x W-Light-latest.AppImage
./W-Light-latest.AppImage
```

- [ ] Ubuntu/Debian 桌面环境下可登录并打开关键菜单。

## 发布记录模板

```text
版本：
平台：Windows / macOS / Linux
架构：x64 / arm64
后端 API：
构建时间：
Git commit：
签名状态：
验收结果：
已知问题：
验收人：
```
