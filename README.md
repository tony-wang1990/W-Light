# W-Light 文旅灯光运维一体化平台

W-Light 是面向文旅灯光项目内部运维的 Web + Android APP + Windows 客户端系统。核心目标是把项目、设备、工单、维修记录、巡检、备件、报表和灯光师工具箱统一到同一套云端数据里，现场手机端、调度电脑端和 Web 控制台共用同一套 API。

当前定位：**内部试运行生产版候选**。代码已具备部署、升级、备份、报表导出、客户端下载和健康检查能力；正式长期运行前，需要按本文的“上线验收清单”完成一次真实环境验收和备份恢复演练。

## 当前范围

- Web 控制台：控制台概览、项目管理、工单调度、维修记录台账、巡检管理、设备台账、备件库存、报表与数据下载、用户权限、专业工具箱、客户端下载中心。
- Android APP：内部 APK 分发，连接同一套云端 API，适合现场维修、扫码、工单和工具箱使用。
- Windows 客户端：Electron 安装包，适合调度室和项目管理电脑长期使用。
- Web/PWA：浏览器直接访问，也可在 Chrome/Edge 里安装为桌面应用。
- 暂不维护：iOS APP、macOS 客户端。内部使用场景下优先保证 Android 和 Windows，避免被开发者账号、签名公证和 TestFlight 流程拖住主线。

## 技术结构

```text
apps/web          Web 控制台
apps/LightOps     Android APP / React Native
apps/desktop      Windows 桌面客户端 / Electron
packages          共享工具箱逻辑
services/backend  NestJS API
deploy/downloads  客户端安装包和下载中心元数据
scripts           服务器部署、升级、备份、自检、打包脚本
```

生产部署使用 Docker Compose：

- `web`：Nginx 静态站点和反向代理，默认对外端口 `3005`
- `api`：NestJS 后端，容器内端口 `3000`，对外统一走 `/v1`
- `postgres`：业务数据库
- `redis`：缓存、队列和运行状态
- `minio`：图片、视频、附件等对象存储

## 服务器要求

支持 Oracle Cloud ARM、普通 AMD64 VPS、1C1G 小机器。

建议：

- Ubuntu 22.04/24.04 或 Debian 12
- 1 核 1G 可试运行，脚本会自动创建 2G swap；更舒服的配置是 2 核 2G+
- 磁盘建议 20G+
- 放行 TCP `3005`，如使用 Nginx Proxy Manager 或反代，则外部走 `80/443`
- 内部正式使用建议绑定域名并启用 HTTPS

## 首次部署

在服务器上执行：

```bash
curl -fsSL https://raw.githubusercontent.com/tony-wang1990/W-Light/main/scripts/server-deploy.sh -o server-deploy.sh
bash server-deploy.sh --port 3005
```

部署完成后访问：

```text
Web 控制台：http://服务器IP:3005
API 地址：http://服务器IP:3005/v1
下载中心：http://服务器IP:3005/clients
```

如果你使用域名和 HTTPS，例如 `https://w-light.example.com`，客户端登录服务器地址填写：

```text
https://w-light.example.com/v1
```

如果直接用 IP 和 3005 端口，客户端登录服务器地址填写：

```text
http://服务器IP:3005/v1
```

## 创建或重置管理员

部署完成后创建管理员账号：

```bash
cd /root/W-Light
bash scripts/server-admin.sh --phone 13800000001 --password '请改成强密码'
```

网页登录时：

- 服务器地址：`/v1`，或完整地址 `https://域名/v1`
- 账号：上面设置的手机号
- 密码：上面设置的密码

## 日常升级

服务器已经部署过以后，不要手动乱拷贝文件，直接使用升级脚本：

```bash
cd /root/W-Light
bash scripts/server-upgrade.sh --port 3005
```

升级脚本会自动：

- 检查 git 工作区
- 升级前备份 PostgreSQL、MinIO 和 `.env`
- 拉取最新代码
- 重建并重启 Web/API
- 检查 `/v1/health`
- 如果健康检查失败，自动回退应用代码

升级后执行：

```bash
bash scripts/server-check.sh --port 3005 --strict-downloads
bash scripts/server-smoke.sh --port 3005 --phone 13800000001 --password '你的管理员密码'
```

如果有域名：

```bash
bash scripts/server-check.sh --port 3005 --strict-downloads --public-url https://你的域名
bash scripts/server-smoke.sh --base-url https://你的域名 --phone 13800000001 --password '你的管理员密码'
```

## 客户端下载

客户端下载中心：

```text
http://服务器IP:3005/clients
https://你的域名/clients
```

直接下载地址：

```text
Android APK：/downloads/w-light-latest.apk
Windows 安装包：/downloads/W-Light-Setup-latest.exe
```

下载页会显示：

- 当前版本号
- 发布日期
- 构建时间
- 包内代码 commit
- SHA256 校验值
- 安装包是否存在、校验是否通过

注意：`发布时刻` 是安装包同步到下载中心的时间，`构建时间` 是安装包文件实际生成时间。确认是否为最新代码，优先看页面上的 `包内代码 commit`，并等待 GitHub Actions 自动打包完成后再下载。

## 自动打包规则

推送到 `main` 后，`.github/workflows/release.yml` 会自动：

1. 在 Ubuntu runner 构建 Android APK。
2. 在 Windows runner 构建 Windows 安装包。
3. 校验 SHA256 和元数据。
4. 把安装包同步到 `deploy/downloads`。
5. 自动提交 `chore: publish client packages ... [skip ci]`。

服务器升级时会拉取这个安装包提交，下载中心就会变成最新包。

如果 GitHub Actions 还没跑完，下载页可能仍显示旧构建时间，这是正常的；等 Actions 成功后再执行服务器升级即可。

本地手动打包命令：

```bash
corepack pnpm install --frozen-lockfile
bash scripts/android-release.sh --publish-web
```

Windows 开发机上：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/desktop-release.ps1 -Target win -PublishWeb
corepack pnpm downloads:verify -- --strict
```

## 备份与恢复

立即备份：

```bash
cd /root/W-Light
bash scripts/server-backup.sh
```

安装每日自动备份，保留最近 14 份：

```bash
bash scripts/server-backup.sh --install-cron --cron "15 3 * * *" --keep 14
```

查看备份：

```bash
bash scripts/server-backup.sh --list
```

校验备份：

```bash
bash scripts/server-backup.sh --verify /root/W-Light/deploy/backups/备份目录名
```

恢复备份：

```bash
bash scripts/server-backup.sh --restore /root/W-Light/deploy/backups/备份目录名 --yes
```

## 一键生产自检

上线、升级、报错排查时优先执行：

```bash
cd /root/W-Light
bash scripts/server-check.sh --port 3005 --strict-downloads
```

它会检查：

- Docker Compose 服务状态
- Web、`/v1/health`、`/v1/health/ready`
- PostgreSQL、Redis
- `.env` 是否仍使用默认弱密钥
- `DB_SYNCHRONIZE` 是否关闭
- 磁盘占用
- Android/Windows 安装包和 SHA256
- 安装包是否对应当前客户端源码
- 最新备份是否存在、是否过旧、校验是否通过

接口级烟测：

```bash
bash scripts/server-smoke.sh --port 3005 --phone 13800000001 --password '你的管理员密码'
```

## 上线验收清单

试运行前必须确认：

- `bash scripts/server-check.sh --port 3005 --strict-downloads` 无失败项。
- `bash scripts/server-smoke.sh ...` 通过。
- 云服务器安全组已放行 `3005`，或域名 HTTPS 反代已配置好。
- `.env` 中 `JWT_SECRET`、`DB_PASSWORD`、`REDIS_PASSWORD`、`MINIO_PASSWORD`、`MINIO_USER` 都不是默认值。
- `DB_SYNCHRONIZE=false`，`DB_MIGRATIONS_RUN=true`。
- 已创建正式管理员账号，并停用测试账号或改强密码。
- 已安装自动备份，并完成一次备份恢复演练。
- 下载中心 Android/Windows 均可下载，SHA256 可校验。
- Web、Android、Windows 使用同一个 `/v1` 地址登录，数据能同步。
- 工单创建、派单、接单、维修记录、备件扣减、验收归档流程至少跑通 3 单。
- 报表 Excel、PDF、DOCX 下载正常。
- 巡检计划、异常上报、自动生成维修工单流程跑通。

## 常用排错

页面打不开：

```bash
docker compose ps
docker compose logs --tail=120 web
docker compose logs --tail=120 api
bash scripts/server-check.sh --port 3005
```

菜单出现 500：

```bash
docker compose logs --tail=200 api
bash scripts/server-smoke.sh --port 3005 --phone 账号 --password '密码'
```

客户端下载 404：

```bash
corepack pnpm downloads:verify -- --strict
ls -lh deploy/downloads
```

客户端不是最新：

- 先看下载页的 `包内代码 commit`。
- 等 GitHub Actions 的 Build Client Packages 成功。
- 服务器执行 `bash scripts/server-upgrade.sh --port 3005`。
- 再执行 `bash scripts/server-check.sh --port 3005 --strict-downloads`。

## 开发验证

本地常用命令：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm run test
corepack pnpm downloads:verify
```

后端路由和权限矩阵有测试覆盖，新增菜单或接口时必须同步更新：

- `services/backend/src/app.routes.spec.ts`
- `services/backend/src/app.permissions.spec.ts`

## 试运行后建议继续增强

这些不是当前内部试运行的阻塞项，但适合在真实使用 1-2 周后继续补：

- Android 离线冲突合并策略更细化。
- 工单 SLA 分级和消息通知策略按真实项目调整。
- Windows 安装包配置正式代码签名证书，减少系统安全提示。
- 报表模板根据公司实际月报格式继续微调。
- 接入企业微信/钉钉/短信通知。
- 增加更细的操作审计日志和管理员导出审计。
