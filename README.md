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

### 🚀 一键部署代码（直接复制到服务器执行）

无论你的服务器有没有装 Docker，直接复制下面这一整段代码，敲回车，然后去喝杯咖啡，它会自动完成**环境安装、代码下载、后台拉起**的所有动作：

```bash
if ! command -v docker &> /dev/null; then echo "安装 Docker..." && curl -fsSL https://get.docker.com | sudo sh && sudo systemctl enable --now docker; fi && rm -rf W-Light && git clone https://github.com/tony-wang1990/W-Light.git && cd W-Light && sudo docker compose up -d
```

✅ **成功标志**：
命令行不再滚动，最后出现 `Started` 字样，并且执行 `sudo docker ps` 能看到 `lightops-api` 等几个容器，就说明服务器端完美跑通了！


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
