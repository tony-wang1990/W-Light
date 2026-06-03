# W-Light 文旅灯光运维一体化 APP

W-Light 是面向文旅灯光项目现场的移动端运维工具，目标是把“工单闭环管理”和“灯光师专业工具箱”放进同一个可离线使用的 APP 里。

当前仓库是 AI 生成的半成品代码，已经具备 React Native 移动端、NestJS 后端、React Web 管理端和共享工具包雏形，但业务深度、工程结构和构建质量还需要重新梳理。本 README 作为后续接管开发的总方案和进度记录，每完成一个阶段都要同步更新。

## 项目目标

- 规范文旅灯光运维流程：报修、派单、接单、维修、验收、归档、统计全链路可追溯。
- 提升灯光师现场效率：提供 DMX、功率、BPM、LTC、光束角、照度、MA 宏、术语、故障诊断等离线工具。
- 支持移动端优先：适配 Android/iOS，深色模式优先，适合现场快速操作。
- 支持数据沉淀：设备台账、维修记录、备件消耗、巡检记录、统计报表、Excel 导出。

## 技术架构

- `apps/LightOps/`：React Native 移动端 APP，后续作为主移动端应用。
- `apps/web/`：React + Vite Web 管理后台，用于项目、设备、工单、备件、用户和报表管理。
- `services/backend/`：NestJS 后端 API，负责认证、工单、设备、项目、备件、巡检、上传、报表。
- `packages/toolbox-core/`：灯光工具箱核心算法，供移动端/Web/后端复用。
- `packages/shared/`：共享类型和枚举。

## 云端同步逻辑

后续部署到甲骨文云 ARM 服务器时，手机 APP 和 Web 管理端共用同一个云端后端：`移动端/Web -> https://your-domain.com/v1 -> NestJS API -> PostgreSQL/MinIO/Redis`。

- Web 管理端当前使用相对接口路径 `/v1`，适合同域名反向代理部署。
- 移动端登录页支持填写并保存服务器地址，例如 `https://your-domain.com/v1`。
- 只要两端连接同一个 API，工单、设备、巡检、备件和附件数据就会写入同一套数据库和对象存储，实现多端同步。
- 甲骨文云 ARM 部署步骤记录在 [ORACLE_ARM_DEPLOY.md](ORACLE_ARM_DEPLOY.md)。
- 全端客户端发布矩阵见 [CLIENT_RELEASE_MATRIX.md](CLIENT_RELEASE_MATRIX.md)。

## 当前代码体检

- 后端 `backend` 可以构建通过。
- Web 管理端构建已恢复，API client 返回类型已与运行时行为对齐。
- 移动端 `LightOps` lint 和 TypeScript 检查已通过。
- 移动端主应用已统一为 `apps/LightOps`；历史 `apps/mobile` 工作区已清理，避免重复维护和旧依赖干扰。
- 工具箱主体功能已经补齐到 MVP 水平，LTC、RGB/色温、灯库制作、灯位设计、理论工具等均已接入；仍需做真机/现场设备长时间验证。
- 运维闭环已覆盖扫码报修、媒体上传、验收流转、配件消耗联动、巡检转工单、离线队列、导出备份等核心能力；仍需用真实项目数据做服务器实机验收和生产安全加固。

## 生产版进度评估

当前项目已经从“半成品 demo”推进到“可部署联调的 MVP+生产加固初版”。按真实交付口径估算，整体完成度约 `85%`：核心业务闭环、工具箱主体、Web 管理端、后端 API、离线缓存/队列、备份导出恢复、Docker 部署骨架、通用服务器部署脚本和 Android 打包发布说明都已经具备；距离正式生产版主要还差服务器实机验收、移动端正式包实机验收、HTTPS/备份/监控/权限安全这些上线工序。

### 已完成到什么程度

- 运维闭环：建单、扫码关联设备、派单、接单/拒单、维修记录、备件消耗、提交验收、验收退回/通过、维修历史、基础统计已完成 MVP。
- 设备/巡检/备件：设备台账、二维码、扫码查询、巡检计划、异常巡检转工单、备件入库/出库、低库存和工单消耗联动已完成 MVP。
- 工具箱：DMX、功率、BPM、光束角、照度、故障诊断、MA 宏、术语、RGB/色温、灯位、理论、LTC、灯库制作等主要功能已接入。
- 报表/数据：综合报表、Excel 导出、项目 JSON 备份、备份恢复、唯一约束冲突预处理已完成。
- 离线/移动端：工单创建、维修记录离线队列，工单/设备/备件列表缓存，加密存储和离线状态提示已完成。
- 部署：后端已支持 PostgreSQL migration；Docker Compose 已包含 Web/Nginx、API、PostgreSQL、Redis、MinIO；默认 Web 入口为宿主机 `3005`；部署脚本支持 ARM64/AMD64 Ubuntu，并会为 1C1G 低配机器自动创建 swap、降低 Redis/PostgreSQL/Node 内存参数。
- 手机端交付：Android release 已支持正式签名变量，新增 Android 打包脚本和 APK Web 下载目录；手机端安装、服务器地址配置和验收指南已补齐。

### 距离正式生产版还缺的工序

- 服务器实机验收：在 Oracle Cloud ARM64 与普通 AMD64 1C1G Ubuntu 上分别跑通 `docker compose config`、一键脚本、镜像构建、数据库迁移、Web 登录、API 健康检查、文件上传、备份恢复。
- HTTPS 与域名：临时可用 `http://服务器IP:3005`，正式交付建议接入域名、HTTPS、反向代理和证书自动续期。
- 移动端正式包实测：Android release 签名配置和打包脚本已补齐，仍需在装好 JDK/Android SDK 的打包机上真实生成 APK/AAB 并安装；iOS 需要 macOS/Xcode、签名、TestFlight 或真机验证。
- 现场业务验收：用真实项目数据验证工单流转、备件扣减、巡检转工单、离线队列冲突、附件上传、报表导出。
- 安全与权限加固：继续细化管理员/工程师/灯光师权限边界、默认账号策略、强密码、敏感信息脱敏、接口访问审计。
- 运维保障：数据库/MinIO 定时备份、日志留存、异常告警、磁盘空间监控、升级回滚方案。
- 测试补齐：当前后端还没有 `*.spec.ts` 测试文件，后续要补库存并发、工单号生成、备份恢复、报表统计等关键单元/集成测试。

## 产品功能架构

### 1. 首页工作台

- 今日待办、待接单、处理中、待验收、超时工单。
- 巡检提醒、低库存提醒、设备异常提醒。
- 快捷扫码、新建工单、工具箱、设备查询。

### 2. 工单闭环

- 手动报修、扫码报修、设备关联、现场照片/视频。
- 管理员派单、维修人员接单/拒单。
- 维修步骤、更换配件、测试结果、现场照片。
- 挂起、恢复、提交验收、验收退回、验收通过、归档。
- 工单台账、维修记录、Excel 导出。

### 3. 设备台账

- 项目、区域、点位、设备编号、二维码。
- 灯具型号、通道模式、DMX 地址、Universe、功率、安装日期、质保日期。
- 设备健康分、历史故障、维修记录、保养周期、说明书附件。

### 4. 巡检保养

- 巡检计划、周期任务、巡检表单。
- 异常巡检一键生成工单。
- 保养记录、巡检统计、漏检提醒。

### 5. 备件库存

- 备件入库、出库、库存预警。
- 工单维修时选择更换配件，自动扣减库存。
- 配件消耗统计、供应商信息、成本统计。

### 6. 灯光师工具箱

- BPM 检测：手动打拍、音频导入预留。
- LTC 时码：立体声 LTC 生成、格式转换。
- DMX 地址码：多灯具链、通道统计、地址冲突检测、型号预设。
- 功率/负荷：多回路功率、电流、安全负载、空开建议。
- 光束角度：距离、光斑、角度互算。
- 照度计算：光通量、距离、角度、目标照度估算。
- RGB/色温：RGB、HEX、色温参考、文旅场景配色收藏。
- 灯库制作：灯具通道、属性、功能编辑与导出。
- 故障诊断：不亮、频闪、不受控、颜色异常、机械卡死等排查流程。
- MA 宏命令：MA2/MA3 常用语法、示例、分类检索。
- 行业术语：中英对照、模糊搜索。
- 灯光理论：灯位、布光角度、色彩混合基础。

### 7. 我的/设置

- 登录、项目切换、角色权限。
- 离线数据、同步队列、导出备份。
- 消息通知、账号安全、系统设置。

## 后续实施路线

### 阶段 1：工程止血

目标：让项目结构清晰、构建可验证、后续可持续开发。

- [x] 统一移动端主应用为 `apps/LightOps`，修正根脚本指向。
- [x] 修复 Web 管理端构建失败。
- [x] 修复移动端 lint 的实际错误。
- [x] 梳理 API client 返回类型。
- [x] 标记或处理重复的 `apps/mobile` 目录。
- [x] 更新 README 运行方式和阶段进度。
- [x] 清理移动端 lint 警告和无用导入。
- [x] 补齐移动端 TypeScript 检查并修复 API/导航类型问题。
- [x] 删除 `apps/mobile` 历史目录，确认根脚本和业务引用均已统一到 `apps/LightOps`。

### 阶段 2：运维 MVP

目标：完成工单闭环的核心可用版本。

- [x] 新建/扫码工单。
- [x] 工单派单、接单、拒单。
- [x] 维修记录。
- [x] 照片/视频上传。
- [x] 提交验收、验收退回、验收通过、归档。
- [x] 维修台账查询。
- [x] 工单基础统计。

### 阶段 3：设备/巡检/备件联动

目标：让运维数据真正沉淀到设备生命周期。

- [x] 设备台账完善。
- [x] 设备/备件台账关键词查询。
- [x] 二维码批量生成和扫码查询。
- [x] 巡检计划和巡检记录。
- [x] 巡检到期提醒与记录后周期滚动。
- [x] 异常巡检转工单。
- [x] 备件入库/出库。
- [x] 工单配件消耗联动。

### 阶段 4：工具箱补全

目标：优先完成现场高频工具，再扩展专业工具。

- [x] DMX 多灯具链和冲突检测增强。
- [x] 功率多回路负荷计算增强。
- [x] BPM、光束角、照度体验优化。
- [x] 故障诊断流程结构化。
- [x] MA 宏和术语库扩充。
- [x] RGB/色温、灯位设计、灯光理论工具补齐。
- [x] LTC 时码换算与立体声路由配置。
- [ ] LTC 音频波形生成/导出。
- [x] 灯库制作与导出。

### 阶段 5：报表、离线与交付

目标：达到真实现场使用和交付部署标准。

- [x] 故障率、维修时长、重复故障、人员绩效、备件消耗报表。
- [x] Excel 导出和备份下载。
- [x] 备份恢复导入。
- [x] 工单创建、维修记录离线加密队列。
- [x] 工具箱核心计算离线运行。
- [x] 移动端个人中心同步队列入口。
- [x] 工单/设备/备件离线列表缓存。
- [x] 附件离线暂存与恢复上传。
- [x] 同步队列冲突详情处理。
- [x] 移动端鉴权与接口配置加密存储。
- [x] 甲骨文云 ARM 部署与多端同步说明。
- [x] 移动端打包文档、验收清单。

### 阶段 6：生产加固与专项体验优化

目标：把 MVP 从“功能可用”推进到“可稳定部署、可真实交付、可持续维护”。

- [x] 后端报表 SQL 兼容 PostgreSQL 与 SQLite。
- [x] 后端 Date 实体列去除 SQLite-only `datetime` 类型。
- [x] 备份下载查询改用 TypeORM repository，减少数据库方言依赖。
- [x] 生产数据库迁移脚本补齐，替代生产环境 `synchronize`。
- [x] 后端查询方言二次审计，覆盖搜索、分页、统计、导出接口。
- [x] 通用服务器部署脚本支持 ARM64/AMD64 与 1C1G 低内存部署。
- [x] Android release 签名配置、打包脚本和 APK Web 下载目录。
- [x] Electron 桌面客户端打包工程，支持 Windows `.exe`、Mac `.dmg` 与 Linux `.AppImage` 安装包。
- [x] 全端客户端发布矩阵与下载中心页面。
- [ ] Android `JAVA_HOME`/SDK/release 签名打包实机验证。
- [ ] iOS Xcode 工程、签名和真机安装验证。
- [x] 移动端 MMKV 密钥升级为 Keychain/Keystore 派生。
- [x] 真机摄像头扫码闭环接入。
- [x] Web chunk 分包和动态/静态导入警告处理。
- [x] LTC 音频波形生成/导出专项补齐。
- [x] 移动端派单人员搜索、技能标签和忙闲状态。
- [x] 移动端工单/设备/备件离线缓存显式提示。
- [x] 备份恢复唯一约束冲突预处理。
- [x] 巡检模块实体/服务/控制器拆分。
- [x] 报表模块控制器/服务/工具函数拆分。
- [x] 报表备份/恢复逻辑独立 service 拆分。
- [x] 报表 Excel 导出逻辑独立 service 拆分。
- [x] 报表统计查询独立 service 拆分。

## 进度记录

| 日期 | 阶段 | 状态 | 说明 |
| --- | --- | --- | --- |
| 2026-06-01 | 项目接管 | 已完成 | 已下载仓库并完成初步体检，确认采用“保留基础、系统重构整理”的策略。 |
| 2026-06-01 | 阶段 1 工程止血 | 已完成 | 已修正根脚本指向 `apps/LightOps`，Web/后端根构建通过，移动端 lint 与 TypeScript 检查通过，`apps/mobile` 已标记为历史目录。 |
| 2026-06-01 | 阶段 2 运维 MVP | 进行中 | 开始补强工单创建、维修记录、配件消耗和验收流转。 |
| 2026-06-01 | 阶段 2 运维 MVP | 进行中 | 已支持扫码设备关联建单、维修记录消耗备件并自动扣库存、工单详情展示更换备件、管理员验收退回。 |
| 2026-06-01 | 阶段 2 运维 MVP | 进行中 | 移动端工单详情已支持管理员派单、维修人员接单/拒单/挂起/恢复。 |
| 2026-06-01 | 阶段 2 运维 MVP | 进行中 | 设备详情已接通维修历史，可按设备筛选历史工单作为维修台账基础查询。 |
| 2026-06-01 | 阶段 2/3 联动 | 进行中 | 已接入移动端照片/视频选择上传；新建工单和维修记录可带附件；巡检异常可跳转创建维修工单。 |
| 2026-06-01 | 阶段 2 运维 MVP | 已完成 | 移动端工单闭环 MVP 已覆盖建单、派单、接单/拒单、维修记录、备件消耗、验收、维修历史和基础统计。 |
| 2026-06-01 | 云端同步/部署 | 已完成 | 移动端登录页已支持配置服务器地址；README 和 `ORACLE_ARM_DEPLOY.md` 已记录甲骨文云 ARM 部署与多端同步逻辑。 |
| 2026-06-01 | 阶段 3 设备/巡检/备件联动 | 进行中 | 后端已支持设备/备件关键词查询；备件新增时自动绑定当前项目并补齐删除接口；巡检今日提醒按到期计划返回，提交记录后自动推进下一次巡检时间，移动端首页显示真实到期巡检数。 |
| 2026-06-01 | 阶段 3 设备/巡检/备件联动 | 进行中 | Web 设备台账已支持真实二维码批量生成、预览和打印；设备详情二维码改为可扫码图片；后端补齐设备删除接口，批量导入时自动绑定当前项目并补齐二维码值。 |
| 2026-06-02 | 阶段 3 设备/巡检/备件联动 | 进行中 | 移动端首页“扫码查验”已从 mock 改为真实二维码/设备编号查询页，可查到设备后跳转设备详情或直接创建报修工单；后端扫码查询同时匹配 `qrCode` 和 `deviceNo`。 |
| 2026-06-02 | 阶段 3 设备/巡检/备件联动 | 进行中 | 异常巡检转工单已改为后端自动生成维修工单并回填 `inspection_records.orderId`；移动端异常巡检提交后可直接查看生成的工单。 |
| 2026-06-02 | 阶段 3 设备/巡检/备件联动 | 进行中 | 后端巡检记录查询已改为按项目隔离的分页对象；移动端巡检计划支持展开最近记录，并可从异常记录跳转关联工单。 |
| 2026-06-02 | 阶段 3 设备/巡检/备件联动 | 进行中 | 移动端设备台账已支持新增设备，现场可录入编号、名称、分类、位置、品牌型号和二维码内容，保存后刷新设备列表并可进入详情。 |
| 2026-06-02 | 阶段 3 设备/巡检/备件联动 | 已完成 | 移动端设备详情已接入编辑入口，设备表单支持新增/编辑复用，现场可维护设备基础台账信息；阶段 3 设备、巡检、备件联动闭环完成 MVP。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | DMX 地址工具已支持多 Universe 分链、固定起始地址、逐台地址展开、Universe 使用率和地址冲突检测；共享计算逻辑已下沉到 `toolbox-core`。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | 功率负荷工具已支持多回路、单相/三相、额定空开快捷选择、回路负载百分比、电缆长度截面积建议和超载提醒；共享计算逻辑同步增强。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | BPM 已补半速/双速、节拍毫秒细分和稳定度；光束角已补常用距离与多距离光斑表；照度计算已补常用流明/光束角、维护照度和场景目标快捷套用。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | 故障诊断页面已结构化为风险入口、排查路径、结论安全提醒、预计处理时间、处理步骤和一键带结论创建工单。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | MA 宏库已扩充序列、执行器、Blind/Preview/Highlight/Park/Clone/变量和系统会话命令；术语库已补控台、信号网络、光学色彩、电气运维词条，并修复术语分类过滤。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | 已新增 RGB/色温配色、灯位设计参考、灯光理论速查三个离线页面并接入工具箱导航；LTC 和灯库制作拆为后续专项。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | LTC 页面已接入工具箱，支持 SMPTE 起止时码换算、帧率选择、总帧数计算、drop-frame 提醒和立体声 LTC/Click/Guide 路由配置；音频波形导出留作后续专项。 |
| 2026-06-02 | 阶段 4 工具箱补全 | 进行中 | 灯库制作页面已接入工具箱，支持品牌/型号/模式、DMX 通道表编辑、PAR/Beam/Wash 模板生成，并可复制通用 JSON/CSV 导出文本。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 后端新增 `/reports/operations-summary` 综合报表接口；Web Dashboard 已展示故障率、平均维修时长、重复故障设备、超时工单、故障类型、人员绩效和备件消耗。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 后端新增工单 Excel 导出和项目 JSON 备份下载接口；Web Dashboard 已接入“导出工单 Excel”和“下载备份”按钮，备份恢复导入拆为后续任务。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 移动端 token、用户信息、当前项目和服务器地址已统一改用加密 MMKV 存储，并内置旧默认 MMKV key 一次性迁移；离线业务数据缓存后续接同步队列时继续加密。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 移动端新增加密离线同步队列；新建工单和维修记录在网络失败/超时时可本地入队，个人中心可查看待同步数量、手动同步并标记库存/冲突类失败。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 后端新增 `POST /reports/backup/restore` 备份恢复接口，支持 dry-run 预检、同 ID 合并覆盖和项目内依赖过滤；Web Dashboard 已接入 JSON 备份恢复入口。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 新增 [MOBILE_RELEASE_CHECKLIST.md](MOBILE_RELEASE_CHECKLIST.md)，记录移动端原生工程、Android/iOS 打包、云端联调和交付验收清单。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 已基于 React Native 0.74.5 模板补入 `apps/LightOps/android` 与 `apps/LightOps/ios` 原生工程，统一 module name、应用显示名、Android applicationId、iOS Bundle Identifier 和相册/相机权限说明；移动端 TypeScript/lint 通过，Android Gradle 因本机未配置 `JAVA_HOME` 暂未验证。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 移动端个人中心已展示离线队列明细、冲突标记、最近错误、尝试次数和手动移除入口，便于现场处理同步失败记录。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 移动端 API client 已为 `/orders`、`/devices`、`/parts` GET 接口增加加密本地缓存；在线成功刷新缓存，网络失败时自动返回上次缓存，支撑工单、设备和备件列表离线查看。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 进行中 | 移动端附件选择失败时可保留本机 URI 暂存；新建工单和维修记录提交前会重试上传，若仍断网则随离线队列保存，并在队列同步时先恢复上传附件再提交业务数据。 |
| 2026-06-02 | 阶段 5 报表/离线/交付 | 已完成 | 阶段 5 MVP checklist 已全部完成：报表、Excel、备份恢复、离线队列、列表缓存、附件恢复上传、加密存储、原生工程和交付验收文档均已落地；后续转入生产加固和专项体验优化。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | 后端报表模块已改为 SQLite/PostgreSQL 双 SQL 分支，日期差、月份分组、周趋势、布尔统计和导出查询均适配 PostgreSQL；实体 Date 列去除 SQLite-only `datetime` 类型，备份下载改用 TypeORM repository；后端构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | 已补齐后端 TypeORM CLI data-source、PostgreSQL 初始建表迁移、迁移脚本命令和 Oracle ARM 部署迁移说明；运行时数据库连接改为通过 `DB_SYNCHRONIZE`、`DB_MIGRATIONS_RUN`、`DB_SSL` 显式控制。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | 完成后端查询方言二次审计：工单搜索去除 PostgreSQL 专属 `ILIKE`，用户项目过滤去除不适配 simple-json 的 `ANY(...)`，设备/备件/巡检/工单 QueryBuilder 条件统一补齐 camelCase 列名引用。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | Web 构建已去除 API client 混合动态/静态导入 warning，并通过函数式 manualChunks 拆分 React、图表、图标和应用工具依赖，最大 chunk 降至 500k 阈值以内。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | 移动端加密 MMKV 已升级为启动前初始化 Keychain/Keystore 托管安装级密钥，保留旧默认 MMKV key 与旧固定密钥迁移路径；新增 `react-native-keychain` 原生依赖，移动端 TypeScript/lint 与整仓构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | 移动端“扫码查验”已接入相机权限请求、二维码相机预览、扫码自动查询设备、成功后暂停识别和手动输入兜底；新增 `react-native-camera-kit`、`react-native-permissions` 依赖并配置 iOS Camera permission Pod；移动端 TypeScript/lint 与整仓构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | LTC 共享核心已补齐 80-bit frame word、sync word、BMC 编码、29.97 drop-frame 换算和 48kHz/16-bit stereo WAV Data URI 生成；移动端 LTC 页面支持配置导出时长、生成 WAV、复制 Data URI 和系统分享，移动端 TypeScript/lint、整仓构建及 1s WAV 运行时小验证通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 受限 | 已复查 Android release 验证环境：当前机器 `java` 不可用，`JAVA_HOME` 与 `ANDROID_HOME` 未配置；`apps/LightOps/android/gradlew.bat` 存在，待安装 JDK/Android SDK 后再执行 Gradle 打包验证。iOS 真机验证需 macOS/Xcode/CocoaPods 环境。 |
| 2026-06-02 | 阶段 6 生产加固 | 进行中 | `packages/toolbox-core` 已补齐 TypeScript build 和无额外依赖的 esbuild 测试 runner，覆盖 DMX 地址展开/冲突、功率电流、29.97 drop-frame、LTC frame bits 与 WAV Data URI；根 `build` 已接入工具核心构建，toolbox-core build/test 与整仓构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 已删除历史 `apps/mobile` 工作区并刷新 pnpm lockfile/install 状态；仓库移动端仅保留 `apps/LightOps`，workspace 项目数从 7 个降为 6 个，移除 44 个旧依赖包，工具核心测试与整仓构建通过。 |
| 2026-06-02 | 阶段 6 体验加固 | 已完成 | 移动端工单详情派单面板已支持姓名/手机号/技能搜索、技能标签展示、当前负责人置顶、按技能匹配与负载排序；后端 `/users` 支持按项目返回人员未闭环工单数并屏蔽 `passwordHash`/`fcmToken` 敏感字段。 |
| 2026-06-02 | 阶段 6 体验加固 | 已完成 | 移动端 API 离线缓存命中时会记录缓存元信息；工单列表、设备台账和备件库已显示“离线缓存”提示与缓存时间，避免现场用户误以为缓存数据就是实时在线数据。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 备份恢复已增加唯一约束冲突预处理：手机号冲突会映射到现有账号并补入当前项目，设备编号/二维码冲突会自动生成不重复后缀；相关工单、维修记录、库存流水和巡检记录会同步映射人员 ID，并在恢复结果 `warnings` 中提示。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 巡检模块已从单文件拆分为实体、服务、控制器和模块装配文件，报表备份恢复改为直接引用巡检实体文件；后端构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 报表模块已拆分为 `reports.controller.ts`、`reports.service.ts`、`reports.utils.ts` 和轻量 `reports.module.ts`，路由、业务逻辑、日期范围工具职责分离；后端构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 报表备份下载、备份恢复、项目内依赖过滤和唯一约束冲突处理已从 `ReportsService` 拆入 `ReportsBackupService`；`ReportsService` 保留统计/Excel 导出门面委托，后端构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 工单 Excel 导出查询和 workbook 生成已从 `ReportsService` 拆入 `ReportsExportService`；报表模块 provider 装配完成，后端构建通过。 |
| 2026-06-02 | 阶段 6 生产加固 | 已完成 | 报表统计查询已拆入 `ReportsStatsService`，`ReportsService` 现在只保留对统计、导出、备份恢复的门面委托；后端构建通过。 |
| 2026-06-03 | 阶段 6 生产加固/部署止血 | 已完成 | 修复 Oracle ARM 上 `bcrypt` 原生 binding 缺失导致 API 崩溃的问题，改用 `bcryptjs`；`docker-compose.yml` 改为生产构建并新增 Web/Nginx 容器，默认通过宿主机 `3005` 访问 Web 和 `/v1` API；新增 `scripts/oracle-arm-deploy.sh` 一键部署脚本；同时修复备件库存原子扣减、维修记录事务、工单号并发序列和月末统计日期溢出问题；`corepack pnpm run build` 已通过，本机无 Docker/bash，compose 与脚本需在 Oracle 服务器做最终验证。 |
| 2026-06-03 | 生产版进度/部署文档 | 已完成 | README 已补充生产版进度评估、已完成范围、剩余上线工序和服务器部署操作说明，包含 Oracle 端口放行、一键部署、已有服务器更新、部署后验证、常见故障排查、手机端 API 地址和升级前备份建议。 |
| 2026-06-03 | 通用部署/移动端发布 | 已完成 | 新增 `scripts/server-deploy.sh`，支持 ARM64/AMD64 Ubuntu 与 1C1G 低内存机器自动 swap、串行 Docker 构建和低内存运行参数；Web 容器挂载 `deploy/downloads` 提供 APK 下载；Android release 已支持正式签名变量并新增 bash/PowerShell 打包脚本；新增 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md) 记录 APP 运行、打包、上传下载和手机端使用流程。 |
| 2026-06-03 | 全端客户端矩阵 | 已完成 | Web 端已补 PWA manifest、service worker 和图标，Windows/Mac 可通过 Edge/Chrome/Safari 安装为桌面客户端；新增 [CLIENT_RELEASE_MATRIX.md](CLIENT_RELEASE_MATRIX.md) 和 `/downloads/` 下载中心页面，明确 Android、iOS、Windows、Mac、Web 全端连接同一 API 并同步同一套云端数据。 |
| 2026-06-03 | 桌面客户端安装包 | 已完成 | 新增 `apps/desktop` Electron 客户端工程、Windows/Mac/Linux 打包脚本、下载中心真实安装包入口和 [DESKTOP_CLIENT_GUIDE.md](DESKTOP_CLIENT_GUIDE.md)；Web 登录页支持配置服务器 API 地址，桌面端可连接 `http://服务器IP:3005/v1` 与手机端/Web 端同步数据。 |
| 2026-06-03 | 全代码全功能审计 | 已完成 | 已完成后端、Web、手机端、桌面端、部署脚本和发布链路审计，新增 [FULL_CODE_AUDIT_REPORT.md](FULL_CODE_AUDIT_REPORT.md)；结论是整仓构建通过但最终上线前必须优先修复角色权限、项目隔离、附件访问、测试基础设施和生产安全。 |

## 当前验证命令

```bash
corepack pnpm install
corepack pnpm --filter @lightops/toolbox-core run build
corepack pnpm --filter @lightops/toolbox-core run test
corepack pnpm --filter backend run build
corepack pnpm --filter web run build
corepack pnpm --filter desktop run prepare:web
corepack pnpm --filter LightOps run lint
corepack pnpm --filter LightOps exec tsc --noEmit
corepack pnpm run build
.\scripts\desktop-release.ps1 -Target win -PublishWeb
docker compose config
bash -n scripts/server-deploy.sh
bash -n scripts/oracle-arm-deploy.sh
bash -n scripts/android-release.sh
bash -n scripts/desktop-release.sh
```

## 当前已知问题

- 移动端扫码查验已接入相机扫码，仍需在 Android/iOS 真机包验证相机权限弹窗、二维码识别、弱光/反光现场识别率和 Camera Kit 原生链接。
- 移动端 Keychain/Keystore 密钥升级已接入，仍需在 Android/iOS 真机包验证首次安装、升级迁移、重装和系统安全存储异常场景。
- LTC WAV 当前通过 Data URI 复制/系统分享导出，仍需在真机和目标控台/时码读取器上验证音量、相位、帧率识别和长时段稳定性。
- `apps/LightOps` 已补入 Android/iOS 原生工程目录，Android release 签名配置和打包脚本已补齐；当前机器未配置 `JAVA_HOME`，尚未在 Android SDK 环境真实生成 APK/AAB 并完成真机安装验证。
- 后续每次新增/调整数据库结构，都需要继续生成新的 TypeORM migration，并在服务器更新代码后执行迁移。
- 当前本机环境没有 Docker CLI 和 bash，`docker compose config` 与 `scripts/server-deploy.sh` 需在 ARM64/AMD64 Ubuntu 服务器上执行；服务器侧重点验证 `http://服务器IP:3005`、`http://服务器IP:3005/v1/health`、`docker compose ps` 和 `docker compose logs -f api web`。

## 服务器部署操作说明

当前推荐部署目标是 Ubuntu/Debian 服务器，支持 Oracle Cloud ARM64，也支持常规 AMD64 1C1G 小机器。默认对外端口使用 `3005`：浏览器访问 `http://服务器IP:3005`，手机 APP 服务器地址填写 `http://服务器IP:3005/v1`。

低配 1C1G 机器说明：

- 脚本会检测内存；低于约 2GB 且 swap 不足时，会自动创建 `/swapfile-lightops`。
- Docker 构建会使用串行构建，减少小内存机器 OOM 风险。
- Redis、PostgreSQL、Node API 会使用偏保守的默认内存参数。

### 1. 云服务器放行端口

在云厂商控制台的安全组/安全列表/NSG 中放行：

- TCP `3005`：当前 Web/API 统一入口。
- TCP `80`、`443`：后续绑定域名和 HTTPS 时使用。

服务器系统内如果启用了 `ufw`，也执行：

```bash
sudo ufw allow 3005/tcp
```

### 2. 新服务器一键部署

用 root 或具备 sudo 的用户登录服务器后执行：

```bash
curl -fsSL https://raw.githubusercontent.com/tony-wang1990/W-Light/main/scripts/server-deploy.sh | bash -s -- --port 3005
```

旧命令仍可用，`scripts/oracle-arm-deploy.sh` 会自动转到通用脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/tony-wang1990/W-Light/main/scripts/oracle-arm-deploy.sh | bash -s -- --port 3005
```

脚本会自动完成：

- 安装 Docker 和 Docker Compose 插件。
- 克隆或更新 `https://github.com/tony-wang1990/W-Light.git`。
- 在 `/root/W-Light` 生成 `.env`，包含数据库密码、Redis 密码、JWT 密钥、MinIO 密钥。
- 低内存机器自动创建 swap，并写入低内存运行参数。
- 构建并启动 `lightops-web`、`lightops-api`、`lightops-postgres`、`lightops-redis`、`lightops-minio`。
- 默认执行已提交的数据库 migration。

### 3. 已有服务器更新

如果服务器上已经有 `/root/W-Light`：

```bash
cd /root/W-Light
git pull
bash scripts/server-deploy.sh --port 3005
docker compose ps
```

### 4. 部署后验证

```bash
cd /root/W-Light
docker compose ps
curl http://127.0.0.1:3005/v1/health
docker compose logs -f --tail=100 api web
```

浏览器验证：

- Web 管理端：`http://服务器IP:3005`
- API 健康检查：`http://服务器IP:3005/v1/health`
- Swagger 文档：`http://服务器IP:3005/api-docs`
- Android APK 下载：`http://服务器IP:3005/downloads/w-light-latest.apk`

手机 APP 登录页填写：

```text
http://服务器IP:3005/v1
```

### 5. 常见故障排查

- 浏览器显示 `ERR_CONNECTION_REFUSED`：先看 `docker compose ps`，确认 `lightops-web` 是否启动；再确认云服务器安全组/安全列表/NSG 已放行 TCP `3005`。
- API 日志报数据库连接失败：执行 `docker compose logs -f --tail=100 api postgres`，重点检查 `.env` 中 `DB_PASSWORD` 与 PostgreSQL 容器是否一致。
- API 日志报 migration 失败：保留日志，不要删除数据卷；先执行 `docker compose logs --tail=200 api` 定位是哪条 migration。
- 上传文件失败：检查 `docker compose logs -f --tail=100 api minio`，确认 MinIO 容器健康。
- 构建时卡死或 OOM：确认脚本已创建 swap，执行 `free -h` 查看；1C1G 机器首次构建会比较慢，属于正常情况。
- 修改端口：推荐仍使用 `3005`；如必须改端口，执行 `bash scripts/server-deploy.sh --port 3006`，同时放行新的云服务器安全组端口。

### 6. 生产前备份建议

进入真实项目试运行后，升级前先备份数据库和 MinIO 数据卷。示例：

```bash
cd /root/W-Light
mkdir -p backups
docker compose exec -T postgres pg_dump -U lightops lightops > backups/lightops-$(date +%F).sql
tar -czf backups/minio-data-$(date +%F).tar.gz -C /var/lib/docker/volumes/w-light_minio_data/_data .
```

如果 Docker volume 名称和服务器实际不一致，先用下面命令确认：

```bash
docker volume ls | grep minio
docker volume ls | grep postgres
```

更完整的 Oracle ARM 说明见 [ORACLE_ARM_DEPLOY.md](ORACLE_ARM_DEPLOY.md)。

## 手机端 APP 打包与下载

完整说明见 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md)，验收清单见 [MOBILE_RELEASE_CHECKLIST.md](MOBILE_RELEASE_CHECKLIST.md)。
Windows/Mac/iOS/Android 的客户端形态和同步方式见 [CLIENT_RELEASE_MATRIX.md](CLIENT_RELEASE_MATRIX.md)。

### Android 打包

打包机需要 JDK 17 和 Android SDK。正式包需要先生成 keystore，并在 `apps/LightOps/android/gradle.properties` 或系统环境变量中配置：

```properties
W_LIGHT_UPLOAD_STORE_FILE=wlight-upload-key.keystore
W_LIGHT_UPLOAD_KEY_ALIAS=wlight-upload
W_LIGHT_UPLOAD_STORE_PASSWORD=你的密码
W_LIGHT_UPLOAD_KEY_PASSWORD=你的密码
```

Windows PowerShell 打包：

```powershell
.\scripts\android-release.ps1
```

Linux/macOS/WSL 打包：

```bash
bash scripts/android-release.sh
```

APK 产物：

```text
apps/LightOps/android/app/build/outputs/apk/release/app-release.apk
```

### 发布 APK 到服务器下载

如果在服务器仓库内打包，可以直接发布到 Web 下载目录：

```bash
bash scripts/android-release.sh --publish-web
docker compose restart web
```

如果在本地 Windows 打包，再上传到服务器：

```powershell
scp apps\LightOps\android\app\build\outputs\apk\release\app-release.apk root@服务器IP:/root/W-Light/deploy/downloads/w-light-latest.apk
ssh root@服务器IP "cd /root/W-Light && docker compose restart web"
```

手机浏览器下载：

```text
http://服务器IP:3005/downloads/w-light-latest.apk
```

客户端下载中心：

```text
http://服务器IP:3005/downloads/
```

### 手机端使用

1. 安装 APK。
2. 打开 `W-Light`。
3. 登录页服务器地址填写：

```text
http://服务器IP:3005/v1
```

4. 登录后，手机端和 Web 端会共用同一套后端数据。

## 桌面客户端安装包与下载

W-Light 现在已补齐真正可安装的桌面客户端打包工程，位置是 `apps/desktop/`。桌面端使用 Electron 封装 Web 管理端，不再只是浏览器 PWA；用户可以下载 Windows `.exe` 或 Mac `.dmg` 安装包，打开后在登录页填写同一套服务器 API 地址：

```text
http://服务器IP:3005/v1
https://你的域名/v1
```

只要桌面端、手机端、Web 端连接同一个 API，工单、设备、巡检、备件、附件都会同步到同一套云端数据库。

完整桌面端打包与安装说明见 [DESKTOP_CLIENT_GUIDE.md](DESKTOP_CLIENT_GUIDE.md)，全端发布矩阵见 [CLIENT_RELEASE_MATRIX.md](CLIENT_RELEASE_MATRIX.md)。

### Windows 安装包

在 Windows 打包机上执行：

```powershell
corepack pnpm install
.\scripts\desktop-release.ps1 -Target win -PublishWeb
```

产物：

```text
apps/desktop/dist/W-Light-Setup-1.0.0-x64.exe
deploy/downloads/W-Light-Setup-latest.exe
```

上传到服务器：

```powershell
scp deploy\downloads\W-Light-Setup-latest.exe root@服务器IP:/root/W-Light/deploy/downloads/
scp deploy\downloads\W-Light-Setup-latest.exe.sha256 root@服务器IP:/root/W-Light/deploy/downloads/
ssh root@服务器IP "cd /root/W-Light && docker compose restart web"
```

用户下载安装：

```text
http://服务器IP:3005/downloads/
```

下载 `W-Light-Setup-latest.exe`，双击安装，启动后服务器地址填写 `http://服务器IP:3005/v1`。

### Mac 安装包

在 macOS 打包机上执行：

```bash
corepack pnpm install
bash scripts/desktop-release.sh --mac --publish-web
```

产物：

```text
apps/desktop/dist/W-Light-1.0.0-x64.dmg
apps/desktop/dist/W-Light-1.0.0-arm64.dmg
deploy/downloads/W-Light-latest.dmg
```

用户从下载中心下载 DMG 后拖入 Applications。未签名内测包首次打开可能需要右键选择“打开”；正式对外分发建议配置 Apple Developer ID 签名和公证。

### 下载中心

部署成功后统一访问：

```text
http://服务器IP:3005/downloads/
```

下载中心包含：

- Windows：`W-Light-Setup-latest.exe`
- Mac：`W-Light-latest.dmg`
- Android：`w-light-latest.apk`
- iOS：TestFlight/Ad Hoc 或 Safari Web/PWA 说明

如果某个下载按钮 404，说明对应安装包还没放入服务器 `/root/W-Light/deploy/downloads/` 目录。

## 本地运行

安装依赖：

```bash
corepack pnpm install
```

启动后端：

```bash
corepack pnpm --filter backend run start:dev
```

启动 Web 管理端：

```bash
corepack pnpm --filter web run dev
```

启动移动端 Metro：

```bash
corepack pnpm --filter LightOps run start
```

运行 Android：

```bash
cd apps/LightOps
npx react-native run-android
```
