# W-Light 全代码全功能审计报告

审计日期：2026-06-03  
审计基线：`50536f4 feat: add downloadable desktop client packaging`  
审计范围：后端 API、Web 管理端、Electron 桌面端、React Native 手机端、Docker 部署、下载中心、发布脚本和文档。

## 修复状态更新

- 2026-06-03：P0「角色权限」和「项目隔离」已完成第一轮修复。后端已接入 `ProjectAccessGuard`，主要业务接口按 `X-Project-Id` 校验用户项目权限；高风险管理动作已接入 `RolesGuard`；服务层详情、更新、删除和工单动作已按项目作用域查询。
- 2026-06-03：Web/桌面端已去除硬编码项目 ID，登录后保存当前项目，顶部支持项目切换，请求头统一使用当前项目。
- 2026-06-03：上传接口已接入项目守卫，文件对象按 `projects/<projectId>/...` 分目录，并新增图片/视频 MIME 白名单。P1「附件公网访问/鉴权下载」仍需继续补 MinIO 代理或后端文件下载接口。
- 2026-06-03：新增 `ProjectAccessGuard` 单元测试，`corepack pnpm --filter backend exec jest --runInBand` 与 `corepack pnpm run build` 已通过。根 `corepack pnpm -r run test` 仍因移动端测试脚本未配置完整而不是全仓可用状态。

## 总体结论

项目已经具备“可部署 MVP + 多端客户端雏形”：整仓构建通过，工具箱核心测试通过，移动端 lint/TypeScript 通过，Windows Electron 安装包已经真实打出。

但目前还不能直接作为最终生产版长期上线。主要阻断点不是“功能缺一大块”，而是生产系统必须要解决的权限隔离、项目数据边界、附件公网访问、测试基础设施和安全运维问题。建议先进入内部试运行版，修完 P0/P1 后再开放真实项目长期使用。

## 自动化验证结果

通过：

```text
corepack pnpm run build
corepack pnpm --filter @lightops/toolbox-core run test
corepack pnpm --filter LightOps run lint
corepack pnpm --filter LightOps exec tsc --noEmit
```

失败或受限：

```text
corepack pnpm -r run test
```

失败原因：`apps/LightOps` 声明了 `test: jest`，但未安装/配置可运行的 Jest；后端虽有 Jest 配置，但当前没有实际 `*.spec.ts` 用例。

```text
corepack pnpm --filter backend run lint
corepack pnpm --filter web run lint
```

失败原因：后端 seed 脚本有 1 个 ESLint error，Web 有 1 个 `prefer-const` error；两端还有大量 `any`、未使用导入、console warning。构建能过，但 lint 质量门禁目前不通过。

## P0：上线前必须先修

### 1. 角色权限基本没有真正生效

风险：任何已登录用户都可能创建/修改/禁用用户，创建/修改项目，执行派单、验收、取消等管理动作。系统虽然有 `RolesGuard`，但业务控制器基本没有挂角色守卫。

证据：

- `services/backend/src/modules/users/users.controller.ts:10` 只使用 `JwtAuthGuard`。
- `services/backend/src/modules/users/users.controller.ts:15`、`:40`、`:46` 暴露创建/更新/禁用用户接口。
- `services/backend/src/modules/projects/projects.controller.ts:9` 只使用 `JwtAuthGuard`。
- `services/backend/src/modules/projects/projects.controller.ts:14`、`:26` 暴露创建/更新项目接口。
- `services/backend/src/modules/orders/orders.controller.ts:61`、`:97`、`:109` 暴露派单、验收、取消工单接口，但未加管理员角色限制。

建议：

- 引入全局 `ProjectAccessGuard` 和实际启用 `RolesGuard`。
- 管理接口限定 `admin/project_manager`。
- 工程师接口限定当前负责人或同项目授权人员。
- 所有状态变更写审计日志。

### 2. 项目隔离依赖客户端传入 `X-Project-Id`，服务端未统一校验用户是否属于该项目

风险：登录用户可以伪造请求头访问其他项目数据；多个详情/更新/删除接口只按资源 `id` 查询，没有带 `projectId` 条件，会形成跨项目越权。

证据：

- `services/backend/src/modules/auth/jwt.strategy.ts:15` JWT validate 只返回 `id/phone/role`，不包含项目权限，也不查数据库确认用户项目。
- `apps/web/src/api/client.ts:48` Web 用用户第一个项目或硬编码项目 ID 作为请求头。
- `apps/web/src/api/client.ts:49` 客户端直接写入 `X-Project-Id`。
- `services/backend/src/modules/orders/orders.controller.ts:55` 工单详情按 `id` 取，未传项目上下文。
- `services/backend/src/modules/devices/devices.controller.ts:41`、`:45`、`:49` 设备详情/更新/删除按 `id` 操作。
- `services/backend/src/modules/parts/parts.controller.ts:31`、`:34`、`:37` 备件详情/更新/删除按 `id` 操作。

建议：

- 每个请求根据 JWT 用户 id 查当前用户，校验 `X-Project-Id` 是否在 `user.projectIds`。
- 所有 `findOne/update/delete/action` 服务方法都改为 `(id, projectId)` 双条件。
- Web 去掉硬编码项目 ID，增加项目选择器和“无项目不可操作”状态。

## P1：生产使用前必须修

### 3. 附件上传成功后公网不可访问

风险：上传接口返回 `/lightops-files/uploads/...`，但 Nginx 没有代理 MinIO bucket 路径；MinIO 端口默认绑定 `127.0.0.1`，外部访问不到。结果可能是“上传成功、数据库有 URL，但手机/Web 打不开附件”。

证据：

- `services/backend/src/modules/upload/upload.module.ts:34` 返回 `/${bucket}/${objectName}`。
- `apps/web/nginx.conf:10` 只代理 `/v1/`。
- `apps/web/nginx.conf:28` 只处理 `/downloads/`。
- `docker-compose.yml:127` MinIO 默认绑定 `127.0.0.1`。

建议：

- 方案 A：后端提供 `/v1/files/:object` 鉴权下载/预览接口。
- 方案 B：Nginx 增加 `/files/` 反代 MinIO，并配合 bucket policy 或签名 URL。
- 附件 URL 统一存可访问的 API URL，而不是内部 bucket path。

### 4. 上传接口没有 MIME/扩展名白名单

风险：当前只有文件大小限制，没有校验文件类型。攻击者可上传任意文件内容，后续若开放静态访问会扩大风险。

证据：

- `services/backend/src/modules/upload/upload.module.ts:47` 图片上传只有 `fileSize`。
- `services/backend/src/modules/upload/upload.module.ts:56` 视频上传只有 `fileSize`。

建议：

- 图片限制 `image/jpeg,image/png,image/webp`。
- 视频限制明确的 `mp4/mov` 等格式。
- 文件名扩展名与 MIME 双校验。
- 对上传结果做鉴权访问。

### 5. DTO 校验没有覆盖主要实体创建/更新

风险：全局 `ValidationPipe` 已开启，但很多接口使用 `Partial<Entity>` 或裸对象作为 body，class-validator 不会真正约束字段。上线后容易出现脏数据、越权写入 `projectId`、状态字段被前端直接改等问题。

证据：

- `services/backend/src/modules/devices/devices.controller.ts:16` 使用 `Partial<Device>`。
- `services/backend/src/modules/devices/devices.controller.ts:47` 使用 `Partial<Device>`。
- `services/backend/src/modules/parts/parts.controller.ts:16` 使用 `Partial<SparePart>`，且允许 `dto.projectId` 优先。
- `services/backend/src/modules/projects/projects.controller.ts:16` 使用 `Partial<Project>`。
- `services/backend/src/modules/projects/projects.controller.ts:28` 使用 `Partial<Project>`。

建议：

- 给每个模块补 `Create*/Update*Dto`。
- 更新 DTO 禁止提交 `id/projectId/createdAt/updatedAt`。
- 备件/设备创建必须以后端校验后的当前项目为准。

### 6. 工单状态变更缺少并发控制和操作者边界

风险：状态机有状态合法性校验，但读取工单后再保存，没有版本号/条件更新。两个人同时派单、提交、验收时可能发生状态覆盖。部分动作也没有校验当前操作者是否是负责人或管理员。

证据：

- `services/backend/src/modules/orders/order-state.machine.ts:37`、`:48`、`:84`、`:92` 读取对象后直接改字段并 `save`。
- `services/backend/src/modules/orders/orders.service.ts:133` 添加维修记录只校验状态，不校验工程师是否为当前负责人。
- `services/backend/src/modules/orders/orders.controller.ts:79`、`:85` 挂起/恢复未限制操作者身份。

建议：

- 工单加 `version` 或 `updatedAt` 条件更新。
- 所有状态动作放进事务，使用条件更新：`WHERE id = ? AND projectId = ? AND status = ?`。
- 维修记录只允许负责人、管理员或明确授权角色添加。

### 7. 根测试命令不可用，后端/Web/移动端缺少关键业务测试

风险：当前最关键的权限、项目隔离、工单状态、库存事务和备份恢复没有自动化保护。后续修 bug 容易反复回归。

证据：

- `apps/LightOps/package.json:8` 声明 `test: jest`，但依赖中没有 `jest`。
- `services/backend/package.json` 有 Jest 配置，但 `services/backend/src` 下没有 `*.spec.ts`。
- `apps/web/package.json` 没有测试脚本。

建议：

- 先让根 `corepack pnpm -r run test` 可稳定执行。
- 后端优先补权限、项目隔离、库存、工单号、状态机、备份恢复测试。
- Web/移动端补登录、项目选择、工单流转和离线队列测试。

## P2：上线前建议修

### 8. 设备编号/二维码是全局唯一，不是项目内唯一

风险：不同项目可能存在相同设备编号或二维码规则，当前会互相冲突，影响多项目复制和备份恢复。

证据：

- `services/backend/src/modules/devices/entities/device.entity.ts:35` `deviceNo` 全局唯一。
- `services/backend/src/modules/devices/entities/device.entity.ts:54` `qrCode` 全局唯一。
- `services/backend/src/database/migrations/1780358400000-InitialPostgresSchema.ts:185`、`:186` 创建全局唯一索引。

建议：

- 改为 `(projectId, deviceNo)` 和 `(projectId, qrCode)` 组合唯一。
- 同步调整扫码查询必须带项目上下文。

### 9. 默认账号、默认密钥和开放 CORS 仍有生产风险

风险：seed 脚本保留固定管理员密码；compose 仍有默认 JWT secret；CORS 开放全部来源。虽然一键脚本会生成随机值，但只要有人手动用默认值启动，就有风险。

证据：

- `services/backend/src/database/seeds/run-seeds.ts:48` 默认密码 `Admin@123`。
- `docker-compose.yml:50` JWT secret 有默认值。
- `services/backend/src/main.ts:28` CORS `origin: '*'`。

建议：

- 生产启动时检测默认密钥并拒绝启动。
- seed 只生成随机临时密码并输出一次，或要求环境变量提供初始管理员密码。
- CORS 根据 `APP_ORIGIN` 白名单配置。

### 10. Swagger 文档生产环境公开

风险：`/api-docs` 在生产直接暴露接口结构，配合弱权限会放大攻击面。

证据：

- `services/backend/src/main.ts:38` 到 `:43` 无条件启用 Swagger。
- `apps/web/nginx.conf:20` 代理 `/api-docs/`。

建议：

- 生产默认关闭 Swagger，或至少加 Basic Auth/IP 白名单。

### 11. 数据库实体 glob 包含 `.module` 文件

风险：TypeORM entities 配置包含 `modules/**/*.module{.ts,.js}`，虽然当前构建没报错，但这是不必要且容易引入异常扫描的配置。

证据：

- `services/backend/src/app.module.ts:33`

建议：

- 仅保留 `modules/**/*.entity{.ts,.js}`。

### 12. 项目备份没有真正包含 MinIO 附件对象

风险：`backupProjectData` 只导出数据库表和 URL，不导出 MinIO 对象。服务器灾难恢复时，数据库可恢复但现场照片/视频可能丢失。

证据：

- `services/backend/src/modules/reports/reports-backup.service.ts:217` 起只备份数据库表。
- 上传文件实际保存在 MinIO：`services/backend/src/modules/upload/upload.module.ts:33`。

建议：

- 生产备份必须包含 PostgreSQL dump + MinIO bucket 数据。
- 在 README/脚本中做一键备份和恢复，而不是只靠数据库 JSON 备份。

### 13. 移动端离线队列只能重放，不能自动合并业务冲突

风险：离线期间同一工单被他人推进，恢复网络后队列会失败并标记冲突，但不会自动合并；现场用户需要明确看到冲突并选择处理。

证据：

- `apps/LightOps/src/offline/offlineQueue.ts:168` 失败项只记录 `hasConflict` 和错误信息。
- `apps/LightOps/src/offline/offlineQueue.ts:184` 最终仅保留失败队列。

建议：

- 冲突详情页展示远端当前状态、本地待提交内容和处理按钮。
- 对工单状态提交增加服务端版本号。

### 14. Web 类型和状态管理仍比较粗糙

风险：Web 管理端大量 `any`、mock fallback 和局部 alert，不影响构建但影响维护性和真实生产体验。

证据：

- `apps/web/src/store/authStore.ts:7` 使用 `any`。
- `apps/web/src/pages/Dashboard/Dashboard.tsx:10` 仍有 fallback mock data。
- `corepack pnpm --filter web run lint` 当前失败。

建议：

- 引入共享 DTO/类型。
- 去掉生产 mock fallback，改为空状态/错误状态。
- 先修 lint error，再逐步收敛 `any`。

### 15. 桌面/Mac/iOS/Android 仍缺实机签名验收

风险：Windows `.exe` 已在本机真实生成，但没有完成安装运行验收；Mac DMG、Android APK、iOS IPA/TestFlight 仍需要对应平台实机验证。未签名安装包会触发 SmartScreen/Gatekeeper。

证据：

- `CLIENT_RELEASE_MATRIX.md` 明确 Mac/iOS/Android 仍需实机。
- `apps/desktop/package.json:31` Windows 当前关闭强制签名。

建议：

- Windows 内测先可用，正式对外加代码签名证书。
- Mac 用 Apple Developer ID 签名和 notarization。
- Android 配 release keystore 真机安装。
- iOS 用 TestFlight 或 Ad Hoc 验证。

## 当前功能模块判断

| 模块 | 当前状态 | 主要风险 |
| --- | --- | --- |
| 后端 API | 可构建，可跑主流程 | 权限/项目隔离不足，测试缺失 |
| 工单闭环 | MVP 已具备 | 状态并发、操作者边界、跨项目访问 |
| 备件库存 | 原子扣减已补 | 操作权限和项目隔离仍需补 |
| 设备台账 | MVP 已具备 | 全局唯一约束、多项目扫码边界 |
| 巡检 | MVP 已具备 | 权限和实机流程待验收 |
| 报表/备份 | 数据报表可用 | 附件对象不在项目 JSON 备份内 |
| Web 管理端 | 可构建，可桌面封装 | 硬编码项目 fallback、lint 失败、类型粗糙 |
| Android | 代码检查通过 | APK 真机、扫码、上传、离线冲突待验收 |
| iOS | 原生工程存在 | Xcode 签名和真机未验收 |
| Windows 桌面端 | 安装包已生成 | 未签名、需安装运行验收 |
| Mac 桌面端 | 打包脚本已具备 | 需 macOS 打包、公证、实机验收 |
| Docker 部署 | 架构可用 | HTTPS、备份、监控、附件代理待补 |

## 推荐后续修复顺序

1. 修 P0 权限：角色守卫、项目访问守卫、服务层项目作用域。
2. 修附件访问：MinIO 代理/鉴权下载、上传类型白名单。
3. 修 Web 项目选择：去掉硬编码项目 ID，支持多项目切换。
4. 修测试基础设施：让根测试命令可用，补后端关键测试。
5. 修生产安全：默认密钥检测、默认管理员密码策略、CORS/Swagger 生产开关。
6. 修并发一致性：工单状态条件更新、版本号、状态冲突提示。
7. 修多项目数据模型：设备编号/二维码组合唯一迁移。
8. 修备份恢复：数据库 + MinIO 一键备份和恢复。
9. 做全端实机验收：Windows、Android、Mac、iOS、ARM64/AMD64 服务器。

## 建议上线口径

当前适合定义为“内部试运行版”。  
修完 P0/P1 后，可以进入“生产候选版”。  
完成实机验收、HTTPS、备份、监控、签名、公证和关键测试后，再定义为“最终上线使用版”。
