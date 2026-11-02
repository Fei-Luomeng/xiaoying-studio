# 开发与验证记录

只记录实际完成和实际运行的结果，不把计划当作完成。时间按 Asia/Shanghai 记录。

## 2026-11-02 · 第一阶段：工程骨架

- 起始状态：项目目录为空，未初始化 Git。
- 环境：本机 Node.js 22.18.0、npm 10.9.3、Docker Engine 29.9.2、Compose 5.6.1；本机没有 Java/Maven，后端采用容器构建。
- 已编写：前后端入口、MyBatis 连通性接口、6 条模板种子数据、Dockerfile、Compose、配置示例与文档。
- CI：已编写前端 lint / TypeScript / build，以及真实 MySQL 初始化后的 Java `mvn verify`；尚未在 GitHub 运行。
- Compose：`docker compose config --quiet` 通过。Docker 服务可连接，当前没有本项目运行中的容器。
- Docker 构建：已尝试后端构建，但 Docker Hub 认证请求超时，尚未拉到 BuildKit 的 Dockerfile 语法解析镜像，未进入 Java 编译。因此不记录为代码编译失败或构建通过。
- 前端：沙箱内访问 npm registry 出现 `ENOTFOUND`。按用户指示，依赖安装由用户在 `frontend/` 执行 `npm i`；本阶段未安装依赖、未生成锁文件、未运行 lint/类型检查/构建。
- 后端：未运行 Java 测试与应用，待镜像拉取可用后验证。
- 配置静态检查：`frontend/package.json` 和 `frontend/tsconfig.json` 均通过 Node.js JSON 解析。这不等同于 TypeScript 检查或应用构建通过。
- 实际投入：本轮有工具时间记录的工作窗口至少为 10:28–10:39（约 11 分钟，包含编写、授权等待与网络超时；此前需求讨论和环境初查未单独计时）。这是辅助开发会话经过时间，不声称是用户人工编码工时。后续继续按轮补充。
- Git：尚未初始化，也未替用户创建 commit 或绑定远程仓库；待基础检查通过后再建立第一个提交节点。

## 2026-11-02 · 第一阶段续：依赖与前端验证

- 用户已在本机完成 `npm i`，生成 `frontend/package-lock.json`；已检查锁文件根依赖与 `package.json` 一致。
- 实际锁定：Next.js 16.4.3、React / React DOM 19.3.1、TypeScript 5.9.3、ESLint 9.39.5、eslint-config-next 16.4.3。
- 首次 lint 发现首页使用普通 `<a>` 跳转站内路径，不符合 Next.js 规则；改为 `next/link` 的 `Link` 后，`npm run lint` 通过。
- `npm run typecheck` 通过。进一步将命令完善为 `next typegen && tsc --noEmit`，明确生成路由类型，复查通过。
- `npm run build` 通过；修改首页链接后再次构建通过。当前可构建的是基础验证页，不能据此声称模板与制作业务已经完成。
- Docker 重试仍在 Dockerfile 语法镜像的认证请求上超时。已移除两个 Dockerfile 的显式 syntax 下载指令，使用 Docker 内置 BuildKit 前端；后端构建推进到 Maven 基础镜像元数据读取，但 Docker Hub 认证请求仍超时（`failed to authorize: DeadlineExceeded`）。未进入 Maven 依赖解析或 Java 编译，后端测试与容器启动仍未验证。
- README 已移除“前端锁文件缺失”的过期启动前置条件，记录实际依赖版本和通过的检查。
- 锁文件为 v3，依赖下载地址均使用公开 `registry.npmjs.org`，没有依赖本机私有 npm 镜像。
- 本轮可核验工作窗口：10:47–10:52，约 5 分钟，包含检查、修正和 Docker Hub 超时等待；与上一轮同为辅助开发会话时间。

## 2026-11-02 · 第一笔工程提交

- 用户已创建源码仓库 `https://github.com/Fei-Luomeng/xiaoying-studio.git`。
- 本次提交范围为工程骨架、前端锁文件、数据库初始化、Docker / CI 配置和文档，不包含依赖目录、构建缓存或真实凭据。
- 前端 lint、类型检查、生产构建已通过；后端仍因 Docker Hub 镜像认证超时而未验证，首次提交不代表最终验收。
- 最终交付时另行标明验收 commit；远程推送和 CI 运行结果以实际返回为准。
