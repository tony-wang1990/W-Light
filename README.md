# W-Light 文旅灯光运维一体化平台

W-Light 面向文旅灯光项目现场运维，当前交付范围是：

- Web 管理后台：项目、工单、维修台账、设备台账、备件库存、巡检、报表、数据下载、用户权限、灯光工具箱。
- Android APP：现场扫码、工单处理、维修记录、离线队列、常用灯光工具。
- Windows 客户端：调度室/管理电脑安装使用，连接同一套服务器 API。

说明：iOS、Mac 客户端暂不作为当前交付目标，因为需要 Apple Developer、TestFlight/签名/公证等额外流程。当前优先保证 Android、Windows、Web 三端可用。

## 当前项目状态

当前版本属于“内测生产候选版”，可部署到 Ubuntu/Debian 的 ARM64 或 AMD64 服务器进行业务试运行。上线前仍建议完成 HTTPS、真实账号权限矩阵、备份恢复演练、安卓真机弱网测试和 Windows 安装包复测。

本轮重点修复：

- 修复 Web 工单 SSE 地址重复 `/v1` 导致实时刷新失效的问题。
- 修复 SSE 后端项目权限校验，避免跨项目推送。
- 为 Nginx 的 SSE 反代关闭缓冲，保证事件能实时到达前端。
- 修复 PostgreSQL 下人员绩效导出表关联字段错误。
- 修复 Docker 生产镜像中 PDF 中文字体资源未打包的问题。
- 公开扫码接口改为只返回设备信息卡字段，避免泄露完整设备实体。
- 扫码页改用 Web/桌面统一服务器地址配置。
- 客户端下载中心改为仅展示 Android、Windows、Web/PWA。
- Windows 客户端改用 `wlight://app` 安全协议加载本地前端，不再关闭 Electron `webSecurity`。
- 数据下载中心增加下载中状态和页面内错误提示。

## 一键服务器部署

推荐系统：Ubuntu 22.04/24.04 或 Debian 12。支持 Oracle Cloud ARM64，也支持普通 AMD64 1C1G 服务器。脚本会自动安装 Docker、创建低内存 Swap、生成 `.env` 密钥并启动服务。

```bash
git clone https://github.com/tony-wang1990/W-Light.git /root/W-Light
cd /root/W-Light
bash scripts/server-deploy.sh --port 3005
```

部署完成后访问：

- Web 控制台：`http://服务器IP:3005`
- API 代理：`http://服务器IP:3005/v1`
- 下载页：`http://服务器IP:3005/downloads/`

如果公网无法打开页面，还需要在云服务器安全组/防火墙放行 TCP `3005`。

## 创建管理员账号

```bash
cd /root/W-Light
bash scripts/server-admin.sh --phone 13800000001 --password '你的强密码'
```

登录时填写：

- 服务器地址：`http://服务器IP:3005/v1`
- 账号：上面创建的手机号
- 密码：上面创建的密码

## 客户端下载与发布

服务器通过 `deploy/downloads` 目录发布安装包，Docker Web 服务会把它挂载到 `/downloads/`。

当前维护的安装包：

- Android：`deploy/downloads/w-light-latest.apk`
- Android 校验：`deploy/downloads/w-light-latest.apk.sha256`
- Windows：`deploy/downloads/W-Light-Setup-latest.exe`
- Windows 校验：`deploy/downloads/W-Light-Setup-latest.exe.sha256`

验证下载产物：

```bash
corepack pnpm downloads:verify -- --strict
```

构建 Android 内测包：

```bash
bash scripts/android-release.sh --publish-web
```

构建 Windows 安装包：

```powershell
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

Windows 客户端默认从 `wlight://app` 加载本地前端，服务器部署脚本会把 `wlight://app` 加入 CORS 白名单。旧服务器如果已经部署过，更新后请重新执行：

```bash
cd /root/W-Light
git pull
bash scripts/server-deploy.sh --port 3005
docker compose up -d --build
```

## 备份与恢复

执行一次完整备份：

```bash
bash scripts/server-backup.sh
```

安装定时备份，例如每天 03:15 备份并保留最近 14 份：

```bash
bash scripts/server-backup.sh --install-cron --cron "15 3 * * *" --keep 14
```

## 本地开发与验证

安装依赖：

```bash
corepack pnpm install --frozen-lockfile
```

常用验证命令：

```bash
corepack pnpm --filter backend run lint
corepack pnpm --filter backend run test
corepack pnpm --filter backend run build
corepack pnpm --filter web run lint
corepack pnpm --filter web run test
corepack pnpm --filter web run build
corepack pnpm --filter web run test:e2e
corepack pnpm --filter LightOps run typecheck
corepack pnpm --filter LightOps run lint
corepack pnpm downloads:verify -- --strict
```

## 上线前必须完成

- 配置 HTTPS：公网生产环境不要长期使用 HTTP 明文。
- 修改/停用测试账号：生产管理员密码必须重新设置。
- 验证备份恢复：至少做一次从备份恢复到新目录/新服务器的演练。
- Android 真机测试：扫码、拍照/视频上传、弱网离线队列、维修记录同步。
- Windows 客户端测试：安装、登录、切换服务器地址、工单和下载中心访问。
- 权限矩阵测试：管理员、工程师、巡检员、只读账号分别验证菜单和接口权限。
- 下载产物签名：内部测试可直接分发，正式对外建议 Windows 配置代码签名证书。

## 当前未完成/后续增强

- 工具箱仍需要继续扩充：宏命令库、术语库、故障诊断树、灯库导出格式、LTC Web 端 WAV 导出、颜色方案收藏等。
- 报表需要继续产品化：更多维度筛选、下载历史、批量打包、图表化 PDF 月报。
- 扫码公开页后续建议升级为不可猜测二维码 token，进一步降低设备编号被枚举的风险。
- 生产监控待完善：容器资源监控、错误日志收集、接口慢查询统计、备份告警。
