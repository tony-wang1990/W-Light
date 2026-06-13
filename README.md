# W-Light 文旅灯光运维一体化平台

W-Light 面向文旅灯光项目现场运维，目标是把项目、设备、工单、维修记录、巡检、备件、报表和灯光师工具箱统一到一套云端系统里。当前优先交付三端：Web 控制台、Android APP、Windows 客户端。iOS 和 macOS 暂不作为当前上线目标，因为需要 Apple Developer、TestFlight、签名和公证流程。

## 当前状态

当前版本是生产候选内测版，整体完成度约 83%。服务端、Web 控制台、Android APP、Windows 客户端都已经具备可部署、可登录、可联动的主流程，但正式长期上线前仍需要 HTTPS、正式签名、真机回归、备份恢复演练和监控告警。

本轮最新完成：
- 后端路由改为精确快照测试，覆盖认证、项目、工单、设备、备件、巡检、报表、上传、文件访问、通知、SSE、公开扫码。
- 后端新增接口权限矩阵测试，敏感写接口不仅菜单隐藏，接口层也有角色测试约束。
- Android 工具箱补强：DMX 多灯具地址方案可复制，MA 宏命令和术语可一键复制。
- 客户端发布流程统一：Android APK 和 Windows EXE 都通过 `scripts/publish-client-artifact.mjs` 生成 latest 文件、SHA256 和版本元数据。

## 技术结构

- `services/backend`：NestJS API，PostgreSQL，Redis，MinIO，JWT，角色权限，Excel/PDF 导出。
- `apps/web`：Web 控制台，默认通过服务器 `3005` 端口访问。
- `apps/LightOps`：React Native Android APP，连接同一套后端 API。
- `apps/desktop`：Electron Windows 客户端，本质是可安装桌面壳，连接同一套云端数据。
- `packages/toolbox-core`：灯光工具箱离线计算核心，Web 和 Android 共用。
- `deploy/downloads`：客户端下载中心制品目录。

## 已实装菜单和闭环

- 控制台概览：工单、巡检、设备和运营概况。
- 项目管理：项目基础资料和人员项目范围。
- 工单调度中心：报修创建、派单、接单、拒单、挂起、恢复、维修记录、备件消耗、提交验收、验收通过、验收退回、取消归档。
- 维修记录台账：按工单沉淀维修步骤、照片视频、配件、外协费用和设备历史。
- 设备台账管理：设备列表、详情、二维码扫码、公开扫码查询、扫码后创建工单。
- 备件库存管理：入库、出库、低库存预警、工单维修消耗关联。
- 巡检管理：巡检计划、今日巡检、巡检记录、异常转工单。
- 报表与数据：工单统计、故障分析、人员绩效、维修成本、设备可靠性、备件消耗、区域热力、每日 KPI、巡检异常、月度运营总表、PDF 月报。
- 用户权限管理：管理员、工程师、巡检员、只读用户，后端接口已有权限矩阵测试。
- 专业工具箱：BPM、LTC、DMX 多灯具链、灯库制作、功率负荷、光束角、照度、RGB/色温、故障诊断、MA 宏命令、行业术语、灯位设计、灯光理论。
- 客户端下载中心：Android/Windows 下载、版本号、构建时间、文件大小、SHA256 校验和状态展示。

## 服务器部署

推荐 Ubuntu 22.04/24.04 或 Debian 12。支持 Oracle Cloud ARM64，也支持普通 AMD64 1C1G 小服务器。默认 Web 端口使用 `3005`。

```bash
git clone https://github.com/tony-wang1990/W-Light.git /root/W-Light
cd /root/W-Light
bash scripts/server-deploy.sh --port 3005
```

部署完成后访问：
- Web 控制台：`http://服务器IP:3005`
- API：`http://服务器IP:3005/v1`
- 下载中心：`http://服务器IP:3005/downloads/`
- 健康检查：`http://服务器IP:3005/v1/health`

如果公网打不开，检查云服务器安全组和系统防火墙是否放行 TCP `3005`。

## 创建管理员

```bash
cd /root/W-Light
bash scripts/server-admin.sh --phone 13800000001 --password '你的强密码'
```

登录时填写：
- 服务器地址：`http://服务器IP:3005/v1`
- 账号：上面创建的手机号
- 密码：上面创建的密码

## 更新部署

```bash
cd /root/W-Light
git pull
bash scripts/server-deploy.sh --port 3005
docker compose up -d --build
```

更新后建议执行：

```bash
bash scripts/server-check.sh --port 3005
```

严格检查客户端安装包也存在：

```bash
bash scripts/server-check.sh --port 3005 --strict-downloads
```

## Android APP

下载地址：
- 浏览器打开 `http://服务器IP:3005/downloads/`
- 下载 `w-light-latest.apk`
- Android 手机上允许“安装未知来源应用”
- 安装后登录服务器地址 `http://服务器IP:3005/v1`

本地打包并发布到下载中心：

```bash
bash scripts/android-release.sh --publish-web
```

Windows PowerShell 也可以打 Android 包：

```powershell
.\scripts\android-release.ps1 -PublishWeb
```

Android 当前状态：
- 已支持登录、扫码查设备、扫码创工单、工单列表/详情/派单/接单/维修记录、附件上传、离线创建工单、离线维修记录队列、网络恢复自动同步、工具箱离线使用。
- 仍建议上线前做真机回归：扫码、相机权限、照片视频上传、弱网离线同步、安装覆盖更新、不同 Android 版本兼容。

## Windows 客户端

下载地址：
- 浏览器打开 `http://服务器IP:3005/downloads/`
- 下载 `W-Light-Setup-latest.exe`
- 安装后填写服务器地址 `http://服务器IP:3005/v1`

Windows 本机一键打包并发布到下载中心：

```powershell
corepack pnpm desktop:dist:win:publish
```

等价命令：

```powershell
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

Windows 当前状态：
- 是真正可安装的 Electron 客户端。
- 与 Web、Android 使用同一套后端，所以数据同步到同一套云端。
- 正式对外分发前建议配置代码签名证书，否则 Windows 可能提示未知发布者。

## 手动发布已有客户端包

如果你已经拿到了某个 APK 或 EXE，可以不重新打包，直接发布到下载中心：

```bash
corepack pnpm clients:publish -- --target android --file /path/to/w-light.apk
corepack pnpm clients:publish -- --target win --file /path/to/W-Light-Setup.exe
corepack pnpm downloads:verify -- --strict
```

发布器会自动生成：
- `deploy/downloads/w-light-latest.apk`
- `deploy/downloads/W-Light-Setup-latest.exe`
- 对应 `.sha256`
- `w-light-android.json`
- `w-light-desktop.json`

下载中心会自动读取这些元数据展示版本、构建时间、文件大小和校验值。

## 备份与恢复

执行一次完整备份：

```bash
cd /root/W-Light
bash scripts/server-backup.sh
```

安装定时备份，例如每天 03:15 备份并保留最近 14 份：

```bash
bash scripts/server-backup.sh --install-cron --cron "15 3 * * *" --keep 14
```

查看备份：

```bash
bash scripts/server-backup.sh --list
```

验证某次备份：

```bash
bash scripts/server-backup.sh --verify /root/W-Light/deploy/backups/备份目录名
```

## 本地开发验证

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter backend run test -- app.routes.spec.ts app.permissions.spec.ts
corepack pnpm --filter backend run build
corepack pnpm --filter web run lint
corepack pnpm --filter web run build
corepack pnpm --filter LightOps run typecheck
corepack pnpm --filter @lightops/toolbox-core run test
corepack pnpm downloads:verify
```

## 上线前必须完成

- 配置域名和 HTTPS。生产环境不建议长期使用 HTTP 明文。
- 重置所有测试账号密码，梳理真实管理员、工程师、巡检员、只读账号。
- 完成至少一次备份恢复演练，确认 PostgreSQL、MinIO 附件和 `.env` 都能恢复。
- Android 配置正式签名，并做真机扫码、附件上传、离线同步、覆盖安装测试。
- Windows 做安装、登录、服务器地址切换、卸载重装、未知发布者提示验证，条件允许时配置代码签名。
- 增加生产监控：容器状态、API 错误率、数据库容量、MinIO 容量、磁盘空间、备份失败告警。
- 压测关键接口：登录、工单列表、工单状态流转、上传、报表导出。
- 公开扫码接口后续建议升级为不可枚举 token，降低设备编号被猜测的风险。
- 补全系统审计日志：谁创建、派单、验收、改库存、恢复备份，都应有审计记录。

## 继续完善方向

- Android 与 Web 工具箱继续保持同级深度，下一步重点是 LTC 文件落地保存、灯库模板更多控台格式、故障诊断树继续扩充。
- 报表增加图表化 PDF、批量打包下载、下载历史、按区域/项目/设备类型多维筛选。
- 下载中心增加历史版本管理、回滚入口、客户端强制最低版本提示。
- 权限继续细化到字段级和操作级，例如工程师只能处理自己的工单，巡检员只能创建巡检记录。
- 增加运维监控面板：服务健康、接口耗时、错误率、数据库容量、附件容量、备份新鲜度。
