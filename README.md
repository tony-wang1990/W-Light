# W-Light 文旅灯光运维一体化平台

W-Light 面向文旅灯光项目现场运维，目标是把项目、设备、工单、维修记录、巡检、备件、报表和灯光师工具箱放进同一套系统。当前优先交付三端：Web 控制台、Android APP、Windows 客户端。iOS 和 macOS 暂不作为当前交付目标，因为需要 Apple Developer、TestFlight、签名/公证等额外流程。

## 当前状态

当前版本是内测生产候选版，可部署到 Ubuntu/Debian 的 ARM64 或 AMD64 服务器试运行，默认 Web 端口为 `3005`。

已实装的主线能力：

- Web 控制台：项目、工单、维修台账、设备台账、备件库存、巡检、报表、数据下载、用户权限、客户端下载中心、专业工具箱。
- Android APP：可打包 APK，可连接同一套云端 API，适合现场扫码、工单和常用工具使用。
- Windows 客户端：Electron 安装包，可独立窗口使用 Web 控制台，和 Web/Android 共用同一套后端数据。
- 服务器部署：Docker Compose 一键部署，支持 PostgreSQL、Redis、MinIO、Nginx Web、NestJS API。
- 报表导出：工单明细、设备台账、备件库存、备件消耗、人员绩效、故障统计、财务消耗、设备可靠性、区域热力、每日 KPI、巡检异常、月度运营总览工作簿、PDF 月报。
- 专业工具箱：BPM 打拍、DMX 多灯具链、功率负荷、光束角、照度、RGB/色温、故障诊断、MA 宏命令、行业术语、LTC WAV 生成、灯库 JSON/CSV 草稿、灯位设计、灯光理论速查。
- 下载中心：Android/Windows/Web 状态检查、版本/构建信息、更新说明、SHA256 校验入口。
- 生产检查：`scripts/server-check.sh` 可一键检查服务、数据库、Redis、下载包和备份。

整体完成度：约 80%。已经可以部署和内测，但正式长期生产上线前还需要做 HTTPS、真实账号权限压测、备份恢复演练、客户端签名、真机测试和监控告警。

## 服务器部署

推荐系统：Ubuntu 22.04/24.04 或 Debian 12。支持 Oracle Cloud ARM64，也支持普通 AMD64 1C1G 小服务器。脚本会安装 Docker、生成 `.env`、创建低内存 Swap 并启动服务。

```bash
git clone https://github.com/tony-wang1990/W-Light.git /root/W-Light
cd /root/W-Light
bash scripts/server-deploy.sh --port 3005
```

部署完成后访问：

- Web 控制台：`http://服务器IP:3005`
- API：`http://服务器IP:3005/v1`
- 客户端下载页：`http://服务器IP:3005/downloads/`
- API 健康检查：`http://服务器IP:3005/v1/health`

如果公网打不开，请检查云服务器安全组和系统防火墙是否放行 TCP `3005`。

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

服务器上更新代码并重建：

```bash
cd /root/W-Light
git pull
bash scripts/server-deploy.sh --port 3005
docker compose up -d --build
```

更新后建议执行生产检查：

```bash
bash scripts/server-check.sh --port 3005 --strict-downloads
```

## 生产检查脚本

一键检查当前服务器状态：

```bash
cd /root/W-Light
bash scripts/server-check.sh --port 3005
```

严格检查客户端下载包也存在：

```bash
bash scripts/server-check.sh --port 3005 --strict-downloads
```

检查内容包括：

- Docker Compose 服务：`web`、`api`、`postgres`、`redis`、`minio`
- Web 页面和 API 健康接口
- PostgreSQL 连接和数据表数量
- Redis 密码连接
- Android/Windows 下载包、元数据、SHA256
- `deploy/backups` 最新备份完整性

## 客户端下载与发布

服务器通过 `deploy/downloads` 发布安装包，Docker Web 服务会把该目录挂载到 `/downloads/`。

当前维护的安装包：

- Android：`deploy/downloads/w-light-latest.apk`
- Android 校验：`deploy/downloads/w-light-latest.apk.sha256`
- Windows：`deploy/downloads/W-Light-Setup-latest.exe`
- Windows 校验：`deploy/downloads/W-Light-Setup-latest.exe.sha256`
- Android 元数据：`deploy/downloads/w-light-android.json`
- Windows 元数据：`deploy/downloads/w-light-desktop.json`

验证下载产物：

```bash
corepack pnpm downloads:verify -- --strict
```

构建 Android 内测包并发布到下载目录：

```bash
bash scripts/android-release.sh --publish-web
```

Windows 上构建 Windows 安装包并发布到下载目录：

```powershell
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

Linux/macOS 上交叉构建 Windows 包取决于 electron-builder 环境，推荐先在 Windows 开发机执行上面的 PowerShell 脚本。

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

安装依赖：

```bash
corepack pnpm install --frozen-lockfile
```

常用验证：

```bash
corepack pnpm --filter backend run lint
corepack pnpm --filter backend run test
corepack pnpm --filter backend run build
corepack pnpm --filter web run lint
corepack pnpm --filter web run test
corepack pnpm --filter web run build
corepack pnpm --filter LightOps run typecheck
corepack pnpm --filter LightOps run lint
corepack pnpm downloads:verify -- --strict
```

## 上线前必须完成

- 配置域名和 HTTPS。生产环境不建议长期使用 HTTP 明文。
- 重置所有测试账号密码，梳理管理员、工程师、巡检员、只读账号的真实权限矩阵。
- 完成至少一次备份恢复演练，确认 PostgreSQL、MinIO 附件和 `.env` 都能恢复。
- Android 真机测试：扫码、拍照/视频上传、弱网离线队列、维修记录同步、下载更新。
- Windows 客户端测试：安装、登录、服务器地址切换、工单操作、下载中心、卸载重装。
- 客户端签名：Android 配置正式签名；Windows 对外分发建议配置代码签名证书。
- 生产监控：容器资源、API 错误日志、数据库容量、备份失败告警、磁盘空间告警。
- 接口级权限回归测试，确保隐藏菜单之外，后端接口也按角色限制。

## 后续增强方向

- Android 工具箱继续和 Web 工具箱保持完全同级深度，尤其 LTC WAV、灯库导出、故障诊断树。
- 报表继续增加图表化 PDF、批量打包下载、下载历史和按区域/项目多维筛选。
- 扫码公开页升级为不可猜测二维码 token，进一步降低设备编号枚举风险。
- 增加系统设置页：服务器地址、版本信息、备份状态、下载包状态、运行诊断结果。
- 增加运维监控面板：服务健康、接口耗时、错误率、数据库容量、附件容量、备份新鲜度。
