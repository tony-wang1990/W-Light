# W-Light 桌面客户端打包与安装指南

W-Light 桌面客户端是一个真正可安装的 Electron 客户端，不依赖浏览器安装 PWA。它会把 `apps/web` 管理端打包进 Windows/Mac/Linux 安装包，登录页可填写同一套云端 API 地址，例如：

```text
http://服务器IP:3005/v1
https://你的域名/v1
```

只要 Windows、Mac、Android、iOS 客户端填写同一个 API 地址，数据都会同步到服务器上的同一套 PostgreSQL/MinIO。

## 1. 准备打包机

推荐使用对应系统打对应平台的安装包：

- Windows 安装包 `.exe`：用 Windows 10/11 打包。
- macOS 安装包 `.dmg`：用 macOS 打包，正式分发建议配置 Apple Developer ID 与 notarization。
- Linux 包 `.AppImage`：用 Linux 打包。

通用要求：

```bash
node -v
corepack enable
corepack pnpm install
```

Node 建议使用 20.x，pnpm 由 Corepack 管理。

## 2. Windows 打包

在 Windows PowerShell 里执行：

```powershell
.\scripts\desktop-release.ps1 -Target win
```

本项目已在 Windows 上验证生成过 `W-Light-Setup-latest.exe`。如果仓库路径很长，NSIS 可能因为 Windows 路径长度限制报 `allowOnlyOneInstallerInstance.nsh` 找不到；建议把仓库放在 `C:\WL` 这类短路径，或创建短路径 worktree 后打包：

```powershell
git worktree add --detach C:\WL HEAD
Set-Location C:\WL
corepack pnpm install --frozen-lockfile
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

产物位置：

```text
apps/desktop/dist/W-Light-Setup-1.0.0-x64.exe
```

如果要同时复制到下载中心目录：

```powershell
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

会生成：

```text
deploy/downloads/W-Light-Setup-latest.exe
deploy/downloads/W-Light-Setup-latest.exe.sha256
deploy/downloads/w-light-desktop.json
```

## 3. macOS 打包

在 macOS 终端执行：

```bash
bash scripts/desktop-release.sh --mac
```

产物位置通常为：

```text
apps/desktop/dist/W-Light-1.0.0-x64.dmg
apps/desktop/dist/W-Light-1.0.0-arm64.dmg
```

发布到下载中心：

```bash
bash scripts/desktop-release.sh --mac --publish-web
```

内部未签名 DMG 可以安装，但 macOS 可能提示“无法验证开发者”。生产分发建议使用 Apple Developer ID 证书签名并公证。

## 4. Linux 打包

```bash
bash scripts/desktop-release.sh --linux
```

产物位置：

```text
apps/desktop/dist/W-Light-1.0.0-x64.AppImage
apps/desktop/dist/W-Light-1.0.0-arm64.AppImage
```

## 5. 上传到服务器下载中心

如果你是在本地打包，再上传到服务器：

```powershell
scp deploy\downloads\W-Light-Setup-latest.exe root@服务器IP:/root/W-Light/deploy/downloads/
scp deploy\downloads\W-Light-Setup-latest.exe.sha256 root@服务器IP:/root/W-Light/deploy/downloads/
ssh root@服务器IP "cd /root/W-Light && docker compose restart web"
```

macOS/Linux 使用同样思路，把 `.dmg` 或 `.AppImage` 放到：

```text
/root/W-Light/deploy/downloads/
```

浏览器访问：

```text
http://服务器IP:3005/downloads/
```

## 6. 用户安装与登录

Windows：

1. 打开 `http://服务器IP:3005/downloads/`。
2. 下载 `W-Light-Setup-latest.exe`。
3. 双击安装，按向导完成安装。
4. 打开桌面上的 `W-Light`。
5. 登录页服务器地址填写 `http://服务器IP:3005/v1`。
6. 输入账号密码登录。

Mac：

1. 打开 `http://服务器IP:3005/downloads/`。
2. 下载 `W-Light-latest.dmg`。
3. 打开 DMG，把 `W-Light` 拖到 `Applications`。
4. 第一次打开如果被 Gatekeeper 拦截，右键应用选择“打开”。
5. 登录页服务器地址填写 `http://服务器IP:3005/v1`。

## 7. 生产注意事项

- 未签名 Windows 安装包可能触发 SmartScreen 提醒，生产对外分发建议购买代码签名证书。
- 未公证 macOS DMG 会触发 Gatekeeper 提醒，生产对外分发建议配置 Apple Developer ID。
- 桌面客户端只是客户端壳，真正数据以服务器为准；服务器必须先部署成功，并保证 `3005` 端口可访问。
