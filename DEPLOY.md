# W-Light 部署说明

当前项目采用 React Native 移动端、React/Vite Web 管理端、NestJS 后端、PostgreSQL、Redis 和 MinIO 的组合。

部署时建议遵循同一个原则：Web 管理端和手机 APP 都连接同一个云端 API，这样工单、设备、巡检、备件和附件数据天然同步。

## 推荐入口

- 甲骨文云 ARM 服务器部署：见 [ORACLE_ARM_DEPLOY.md](ORACLE_ARM_DEPLOY.md)。
- 本地开发运行：见 [README.md](README.md) 的“本地运行”和“当前验证命令”。

## 当前部署基线

```bash
corepack pnpm install
corepack pnpm run build
docker compose up -d --build
```

当前 `docker-compose.yml` 会启动后端 API、PostgreSQL、Redis 和 MinIO。生产环境上线前必须修改默认密码、JWT 密钥，并使用 Nginx/Caddy 配置 HTTPS。

## 多端同步地址

- Web 管理端：建议部署在 `https://your-domain.com`，通过反向代理把 `/v1` 转发到后端。
- 手机 APP：登录页“服务器地址”填写 `https://your-domain.com/v1`。
