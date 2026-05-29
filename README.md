# W-Light (文旅灯光运维一体化平台)

![W-Light Logo](https://img.shields.io/badge/W--Light-1EAE98?style=for-the-badge&logoColor=white)

W-Light 是一款专为文旅灯光项目打造的**运维闭环管理与灯光师工具箱**。
核心目标是解决故障维修工单流转不规范的问题，并为现场 MA 灯光师提供专业、离线的计算辅助工具。

---

## 🏗 架构说明

本项目采用 Monorepo 架构管理：
* **`apps/LightOps/`**：移动端 APP（React Native 编写，支持 Android / iOS）。
* **`services/backend/`**：后端 API 服务器（NestJS 编写）。
* **`packages/toolbox-core/`**：灯光专业计算核心逻辑（BPM、DMX、光束角、功率计算等），前后端共用。

---

## 🚀 服务器一键部署指南（针对甲骨文云等 Linux 服务器）

本项目后端**不需要**配置复杂的 GitHub Actions，所有服务（API服务器、PostgreSQL数据库、Redis缓存、MinIO文件存储）已经全部封装在了 `docker-compose.yml` 中。

你只需要在你的云服务器上执行以下命令：

### 1. 安装 Docker（如果服务器上还没装）
```bash
# 一键安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. 克隆代码库
```bash
# 下载项目代码
git clone https://github.com/tony-wang1990/W-Light.git

# 进入项目目录
cd W-Light
```

### 3. 一键启动后端所有服务
```bash
# 启动所有后端服务 (-d 表示后台运行)
sudo docker compose up -d
```

✅ **成功标志**：
运行完毕后，输入 `sudo docker ps`，如果看到 `lightops-api`、`lightops-postgres`、`lightops-redis`、`lightops-minio` 这几个容器都在运行，说明服务器端已经完美启动！

---

## 📱 移动端打包说明 (针对本地电脑)

服务器部署成功后，你需要修改移动端代码连接你的服务器，然后打包成 APK：

1. 打开文件 `apps/LightOps/src/api/client.ts`。
2. 将 `baseURL` 修改为你**服务器的公网 IP**（例如：`http://123.45.67.89:3000/v1`）。
3. 在你的本地电脑上运行 Android 打包命令：
   ```bash
   cd apps/LightOps
   npx react-native run-android
   ```

---

## 🛠 内置核心灯光师工具箱
* **BPM 检测**：手动打拍测算 BPM 及延迟时间 (ms)。
* **光束角度**：测算投射距离与光斑直径。
* **DMX 地址码**：动态生成灯具通道链与跳线参考。
* **功率负荷**：总功率计算及空开匹配推荐。
* **MA 宏命令 / 术语词典**：现场速查表。
