# LightOps 一键部署与生产环境运行指南

本系统在设计之初就考虑了极简的部署体验，不需要复杂的 Docker 编排、不需要单独安装 Redis 或独立配置 PostgreSQL 数据库（由于已全面适配 SQLite Zero-Config）。

在任何支持 Node.js (v18+) 的服务器上，您只需按照以下步骤即可让整套系统跑起来！

## 🚀 一键部署流程

### 第一步：安装依赖
确保服务器已安装 `Node.js` 和 `pnpm`。在项目根目录下执行：
```bash
pnpm install
```

### 第二步：一键构建
这将同时构建 `Web前端`（输出静态文件）和 `Backend后端`（输出编译后的 js 代码）。
```bash
pnpm run build
```

### 第三步：一键启动
构建完成后，直接启动后端服务。
```bash
pnpm run start:prod
```
> **提示**：启动后，后端将在 `http://localhost:3000` 运行。如果您需要 Web 界面也能被外网访问，请配合 Nginx 等反向代理工具。

## ⚙️ Nginx 反向代理配置参考

由于我们采用了前后端分离架构，在生产环境中，最优雅的方式是用 Nginx：
1. 静态托管构建好的 Web 前端文件（`apps/web/dist`）
2. 将 `/v1` 的请求代理转发到后端的 `3000` 端口

配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 1. 静态托管 Web 前端
    location / {
        root /path/to/lightops/apps/web/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html; # 支持单页应用前端路由
    }

    # 2. 反向代理后端 API
    location /v1/ {
        proxy_pass http://127.0.0.1:3000/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📱 移动端打包
由于我们采用了 `Expo` 开发移动端，您可以直接在云端进行打包，无需本地配置复杂的 Android Studio 或 Xcode 环境。

1. 全局安装 EAS CLI：`npm install -g eas-cli`
2. 登录 Expo：`eas login`
3. 执行云端打包：
   - Android APK: `eas build -p android --profile preview`
   - iOS 提审包: `eas build -p ios`

打包成功后，控制台会返回一个二维码和下载链接，扫描即可安装！
