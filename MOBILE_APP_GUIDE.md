# W-Light 手机端 APP 打包、下载与使用指南

本文档面向两类人：

- 打包人员：负责把 `apps/LightOps` 打成 Android APK/AAB 或 iOS 包。
- 现场用户：负责下载安装到手机，并连接服务器使用。

## 当前结论

- Android/iOS 原生工程已在 `apps/LightOps` 下。
- Android release 已支持正式签名变量，不再只能使用 debug 签名。
- Android 打包脚本已提供：
  - Linux/macOS/WSL：`scripts/android-release.sh`
  - Windows PowerShell：`scripts/android-release.ps1`
- 服务器 Web 容器会把 `deploy/downloads` 目录映射为下载目录：
  - APK 下载地址：`http://服务器IP:3005/downloads/w-light-latest.apk`
- 手机 APP 登录页服务器地址填写：
  - 临时 IP：`http://服务器IP:3005/v1`
  - 正式域名：`https://your-domain.com/v1`

## 一、本地开发运行

安装依赖：

```bash
corepack pnpm install
```

启动 Metro：

```bash
corepack pnpm --filter LightOps run start
```

Android 调试运行：

```bash
corepack pnpm --filter LightOps run android
```

iOS 调试运行需要 macOS：

```bash
cd apps/LightOps/ios
pod install
cd ../../..
corepack pnpm --filter LightOps run ios
```

## 二、Android 正式包打包

### 1. 环境要求

- JDK 17。
- Android Studio 或 Android SDK。
- 已配置 `JAVA_HOME`、`ANDROID_HOME`。
- Windows 可用 PowerShell；Linux/macOS/WSL 可用 bash。

### 2. 生成签名文件

不要把 keystore 提交到 Git。

```bash
cd apps/LightOps/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore wlight-upload-key.keystore -alias wlight-upload -keyalg RSA -keysize 2048 -validity 10000
```

### 3. 配置签名变量

可以写入 `apps/LightOps/android/gradle.properties`，也可以配置为系统环境变量。

```properties
W_LIGHT_UPLOAD_STORE_FILE=wlight-upload-key.keystore
W_LIGHT_UPLOAD_KEY_ALIAS=wlight-upload
W_LIGHT_UPLOAD_STORE_PASSWORD=你的密码
W_LIGHT_UPLOAD_KEY_PASSWORD=你的密码
```

### 4. 打包 APK

Windows PowerShell：

```powershell
.\scripts\android-release.ps1
```

Linux/macOS/WSL：

```bash
bash scripts/android-release.sh
```

产物位置：

```text
apps/LightOps/android/app/build/outputs/apk/release/app-release.apk
```

### 5. 同时发布到 Web 下载目录

如果是在服务器仓库内打包，或想把 APK 放进 Web 下载目录：

Windows PowerShell：

```powershell
.\scripts\android-release.ps1 -PublishWeb
```

Linux/macOS/WSL：

```bash
bash scripts/android-release.sh --publish-web
```

生成：

```text
deploy/downloads/w-light-latest.apk
deploy/downloads/w-light-latest.apk.sha256
deploy/downloads/w-light-android.json
```

服务器上 Web 容器会提供下载：

```text
http://服务器IP:3005/downloads/w-light-latest.apk
```

## 三、从本地电脑上传 APK 到服务器

如果你在本地 Windows/Android Studio 打包，然后要放到服务器下载：

```powershell
scp apps\LightOps\android\app\build\outputs\apk\release\app-release.apk root@服务器IP:/root/W-Light/deploy/downloads/w-light-latest.apk
ssh root@服务器IP "cd /root/W-Light && docker compose restart web"
```

然后手机下载：

```text
http://服务器IP:3005/downloads/w-light-latest.apk
```

## 四、iOS 打包

iOS 必须使用 macOS + Xcode。

```bash
cd apps/LightOps/ios
pod install
open LightOps.xcworkspace
```

在 Xcode 中完成：

- Signing Team。
- Bundle Identifier：`com.wlight.lightops`。
- Release Scheme。
- Archive。
- TestFlight 或 Ad Hoc 导出。

## 五、手机安装和使用

1. Android 手机打开 APK 下载地址。
2. 如果系统提示禁止安装未知来源应用，按提示允许当前浏览器安装。
3. 安装并打开 `W-Light`。
4. 登录页服务器地址填写：

```text
http://服务器IP:3005/v1
```

5. 使用管理员或工程师账号登录。
6. 手机端和 Web 端连接同一个服务器后，工单、设备、巡检、备件和附件会写入同一套 PostgreSQL/MinIO 数据。

## 六、发布前检查

- Android release 包已使用正式 keystore 签名。
- 登录页服务器地址能访问 `/v1`。
- 真机能申请相机权限并扫码。
- 新建工单、上传照片、维修记录、备件扣减、验收流转能跑通。
- 断网新建工单和维修记录能进入离线队列。
- 恢复网络后离线队列能同步。
- Web 能看到手机新建的工单。
- 手机能看到 Web 派发的工单。

更完整的验收清单见 [MOBILE_RELEASE_CHECKLIST.md](MOBILE_RELEASE_CHECKLIST.md)。
