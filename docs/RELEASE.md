# W-Light Release Guide

当前内部验收版本：`0.9.0-internal.0`

## 发布前检查

```bash
corepack pnpm --filter backend run test
corepack pnpm --filter web run test
corepack pnpm --filter web run test:e2e
corepack pnpm --filter backend run build
corepack pnpm --filter web run build
corepack pnpm downloads:verify -- --strict
```

`downloads:verify -- --strict` 只有在 Android APK 和 Windows 安装包已经发布到 `deploy/downloads/` 后才应通过。

## 服务器升级

服务器上优先使用带备份和回滚的升级脚本：

```bash
cd /root/W-Light
bash scripts/server-upgrade.sh --branch main --port 3005
```

升级后检查：

```bash
cd /root/W-Light
bash scripts/server-health.sh --port 3005
bash scripts/server-smoke.sh --base-url http://服务器IP:3005 --phone 13800000001 --password '你的管理员密码'
bash scripts/server-backup.sh --list
```

## 客户端发布

Android：

```bash
corepack pnpm android:release:publish
corepack pnpm downloads:verify -- --strict
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/desktop-release.ps1 -Target win -PublishWeb
corepack pnpm downloads:verify -- --strict
```

iOS、macOS、Linux 需要在目标平台或签名环境中构建，并将产物发布到 `deploy/downloads/`。

## Git 标签

正式形成内部验收包时：

```bash
git tag v0.9.0-internal.0
git push origin v0.9.0-internal.0
```

打标签前确认 `CHANGELOG.md`、`PRODUCTION_ACCEPTANCE.md` 和下载产物元数据都已更新。
