# W-Light 移动端打包与验收清单

本文档用于把 `apps/LightOps` 从当前 React Native JS/TS 工程推进到可真机安装、可交付验收的 Android/iOS 包。

## 当前状态

- 当前主移动端目录是 `apps/LightOps`。
- 该目录已包含基于 React Native 0.74.5 模板生成的 `android/`、`ios/` 原生工程目录。
- 当前已同步原生 module name `WLight`、显示名 `W-Light`、Android applicationId `com.wlight.lightops` 和 iOS Bundle Identifier `com.wlight.lightops`。
- 正式 APK/AAB/IPA 仍需要在具备 Android SDK/Xcode/CocoaPods 的打包机上完成签名、依赖安装和真机验证。
- 当前 Windows 工作机未配置 `JAVA_HOME`，因此 Android Gradle 尚未完成本机验证。
- 本地敏感数据使用 MMKV 加密，MMKV 密钥通过 `react-native-keychain` 写入 iOS Keychain / Android Keystore，并保留旧 MVP 固定密钥迁移路径。
- 扫码查验已接入 `react-native-camera-kit` 与 `react-native-permissions`，真机包需验证相机权限和二维码识别。

## 打包前置

1. 安装依赖并确认 JS 工程可检查：

```bash
corepack pnpm install
corepack pnpm --filter LightOps exec tsc --noEmit
corepack pnpm --filter LightOps run lint
```

2. 确认原生依赖完成链接：

- Android 使用 React Native autolinking。
- iOS 打包前在 `apps/LightOps/ios` 执行 `pod install`，确保 `react-native-keychain`、`react-native-mmkv`、`react-native-camera-kit`、`react-native-permissions` 等原生依赖进入 Xcode workspace。

3. 检查原生工程信息：

- Android `applicationId` 建议：`com.wlight.lightops`
- iOS Bundle Identifier 建议：`com.wlight.lightops`
- App 名称：`W-Light`
- 深色模式、相册/相机、网络访问权限按上传、扫码和现场拍照能力配置。

如后续需要重新生成原生壳，可使用同版本模板：

```bash
cd apps
npx @react-native-community/cli init LightOpsNative --version 0.74.5 --skip-install
```

然后只迁移 `android/`、`ios/` 和必要的原生配置，不覆盖业务源码。

## Android Release

1. 生成上传签名：

```bash
cd apps/LightOps/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore wlight-upload-key.keystore -alias wlight-upload -keyalg RSA -keysize 2048 -validity 10000
```

2. 在 `apps/LightOps/android/gradle.properties` 配置签名变量：

```properties
W_LIGHT_UPLOAD_STORE_FILE=wlight-upload-key.keystore
W_LIGHT_UPLOAD_KEY_ALIAS=wlight-upload
W_LIGHT_UPLOAD_STORE_PASSWORD=change-me
W_LIGHT_UPLOAD_KEY_PASSWORD=change-me
```

3. 在 `android/app/build.gradle` 的 release signingConfig 中读取上述变量。

4. 打包：

```bash
cd apps/LightOps/android
./gradlew assembleRelease
./gradlew bundleRelease
```

Windows PowerShell 使用：

```powershell
cd apps/LightOps/android
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

5. 产物位置通常为：

- APK：`apps/LightOps/android/app/build/outputs/apk/release/app-release.apk`
- AAB：`apps/LightOps/android/app/build/outputs/bundle/release/app-release.aab`

## iOS Release

iOS 需要在 macOS + Xcode 环境完成。

```bash
cd apps/LightOps/ios
pod install
open LightOps.xcworkspace
```

在 Xcode 中完成：

- Signing Team 和 Bundle Identifier。
- Release Scheme。
- Archive。
- TestFlight 或 Ad Hoc 导出。

## 云端联调

移动端和 Web 端必须连接同一个后端 API。

- Web 同域反代：`https://your-domain.com/v1`
- 手机登录页服务器地址：`https://your-domain.com/v1`
- 后端数据链路：NestJS API -> PostgreSQL -> MinIO/对象存储。

甲骨文云 ARM 部署步骤见 [ORACLE_ARM_DEPLOY.md](ORACLE_ARM_DEPLOY.md)。

## 验收清单

### 基础登录与同步

- [ ] 手机端可配置云端 API 地址并登录。
- [ ] Web 管理端和手机端使用同一账号、同一项目数据。
- [ ] 手机端创建工单后，Web 端工单列表可看到。
- [ ] Web 端派单后，手机端工单详情状态同步。

### 工单闭环

- [ ] 新建/扫码报修可关联设备。
- [ ] 管理员可派单。
- [ ] 维修人员可接单、拒单、挂起、恢复。
- [ ] 可添加维修步骤、照片/视频链接、外委费用。
- [ ] 更换备件后库存流水和工单维修记录一致。
- [ ] 提交验收、验收通过、验收退回流程正确。
- [ ] 工单归档后维修台账可查询。

### 设备/巡检/备件

- [ ] 设备台账可新增、编辑、搜索、扫码查询。
- [ ] 手机端“扫码查验”可弹出相机权限、打开预览、识别设备二维码并自动查询设备。
- [ ] 巡检计划可创建，异常巡检可生成工单。
- [ ] 备件入库、出库、低库存提醒数据正确。
- [ ] 设备详情可查看历史工单与健康状态。

### 工具箱离线能力

- [ ] DMX 地址、功率负荷、BPM、光束角、照度工具断网可用。
- [ ] 故障诊断、MA 宏、术语库、RGB/色温、灯位理论断网可用。
- [ ] LTC 当前支持时码换算和声道配置；音频波形导出仍是后续专项。
- [ ] 灯库制作可生成通道表并复制 JSON/CSV 文本。

### 离线与恢复

- [ ] 断网时新建工单可进入手机端加密同步队列。
- [ ] 断网时新增维修记录可进入手机端加密同步队列。
- [ ] 恢复网络后可在“我的 -> 离线同步”手动上传。
- [ ] 同步失败能保留错误信息并继续留在队列。
- [ ] Web Dashboard 可下载项目 JSON 备份。
- [ ] Web Dashboard 可 dry-run 预检并恢复 JSON 备份。

### 安全与交付

- [ ] 手机端 token、用户、当前项目和服务器地址使用加密 MMKV 存储。
- [ ] 首次安装和升级安装时 Keychain/Keystore 可创建/读取 MMKV 密钥，旧本地加密数据可迁移。
- [ ] 退出登录后本地 token 被清理。
- [ ] Release 包不输出敏感 token 日志。
- [ ] 后端生产环境关闭 TypeORM synchronize，改用迁移。
- [ ] 备份文件作为敏感资料保管，不在公开仓库提交真实数据。

## 发布记录模板

```text
版本：
平台：Android / iOS
环境：测试 / 生产
后端 API：
构建时间：
Git commit：
主要变更：
已知问题：
验收人：
```
