# 拾影 · 素材工作室

小影科技 2027 校招全栈开发笔试项目。目标是完成「浏览模板 → 上传素材 → 创建异步任务 → 查询阶段 → 查看个人结果」闭环。

源码仓库：[Fei-Luomeng/xiaoying-studio](https://github.com/Fei-Luomeng/xiaoying-studio)。开发过程按阶段提交，当前不是最终验收版本。

**当前阶段：工程骨架与连通性验证，尚未完成业务功能，不能作为最终交付。** 本文随开发同步更新，未验证的内容明确标记。

## 技术与职责

| 层 | 选择 | 职责 |
| --- | --- | --- |
| 前端 | Next.js 16.4.3 / React 19.3.1 / TypeScript 5.9.3 / Node.js 22 | App Router、交互、通过同源代理访问 Java |
| 后端 | Java 21 / Spring Boot 3.5.16 / MyBatis Starter 3.0.5 | 业务接口、文件校验、任务执行、持久化 |
| 数据库 | MySQL 8.4 | 模板、素材、用户会话、任务与步骤记录 |
| 运行 | Docker Compose v2+ | 前端、Java、MySQL 和持久化数据卷 |

前端的 `package.json` 约束主要版本系列，`frontend/package-lock.json` 已生成并记录精确依赖，后续使用 `npm ci` 安装。Java 直接依赖以 `backend/pom.xml` 为准。镜像标签固定主要版本系列，暂未固定镜像 digest。

兼容性参考：[Next.js 安装要求](https://nextjs.org/docs/app/getting-started/installation)、[Spring Boot 3.5 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)、[MyBatis Starter 兼容矩阵](https://mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/)。

## 项目结构

```text
frontend/                 Next.js App Router 前端
backend/                  Spring Boot / MyBatis 后端
database/init/            按文件名顺序执行的结构与种子 SQL
docs/                     设计、开发和验收记录
.github/workflows/        自动检查流水线
compose.yaml              本地容器启动入口
.env.example              无真实凭据的本地演示配置
```

## 启动

需要 Docker Desktop（或 Docker Engine + Compose），无需在宿主机安装 Node、Java 或 Maven。在项目根目录，默认使用演示配置启动：

```bash
docker compose up --build -d
docker compose ps
```

- 页面：[http://localhost:3000](http://localhost:3000)
- 经前端代理读取 Java：[http://localhost:3000/api/system/status](http://localhost:3000/api/system/status)
- Java 健康检查：[http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)
- MySQL：`127.0.0.1:3307`，库名、账号和演示密码见 `.env.example`。

端口占用时，复制 `.env.example` 为 `.env` 并修改相应端口。所有端口仅绑定本机回环地址。

```bash
cp .env.example .env
docker compose logs -f backend
docker compose down
```

`down` 保留数据卷。MySQL 仅在空数据卷上执行 `database/init/`；修改初始化脚本不会自动迁移现有数据库。开发期如确需重新初始化，可执行 `docker compose down -v`，**该命令会删除此项目的数据库和素材数据卷**。

当前本机验证遇到 Docker Hub 镜像认证请求超时（`failed to authorize: DeadlineExceeded`），后端尚未进入编译。可先在终端执行 `docker pull maven:3.9-eclipse-temurin-21` 检查 Docker 的镜像访问是否可用；恢复访问后再运行 Compose 构建与测试。前端本机检查已通过，具体结果见开发日志。

## 开发与检查

前端可使用本机 Node.js 22 开发：

```bash
docker compose up --build -d backend
cd frontend
npm ci
npm run dev
```

前端默认转发 `/api/*` 至 `http://localhost:8080`。若修改后端映射端口，在启动前端时设置 `BACKEND_ORIGIN=http://localhost:新端口`。它是服务端配置，不使用 `NEXT_PUBLIC_*` 暴露内部地址。容器生产构建通过 build arg 将该地址设为 `http://backend:8080`；修改时需重建前端镜像。

前端检查（在 `frontend/` 内）：

```bash
npm run lint
npm run typecheck
npm run build
```

`typecheck` 会先执行 `next typegen` 生成路由类型，再执行 `tsc --noEmit`，不依赖此前已运行过开发服务器或构建。

Java 测试和构建可完全在容器中执行，不需要宿主机安装 Java/Maven：

```bash
docker compose --profile checks run --build --rm backend-check
```

也可在 Java 21 / Maven 3.9 环境执行 `cd backend && mvn verify`，先启动 MySQL。默认连接 `localhost:3307/xiaoying`。可通过 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 覆盖。当前集成测试使用真实 MySQL，验证 HTTP → Java → MyBatis → 种子表及健康检查。

CI 已配置在 push / pull request 时检查前端 lint、类型和构建，以及使用真实 MySQL 的 Java 测试与构建；尚未在 GitHub 实际运行。核心业务测试在对应功能实现时加入，不用基础连通性测试代替业务测试。

## 当前接口

`GET /api/system/status`：经 MyBatis 查询数据库中的模板数量，用于开发阶段验证链路。数据库不可用时返回请求错误，不伪造正常状态。

```json
{"status":"UP","application":"Xiaoying Studio","templateCount":6}
```

`GET /actuator/health`：Spring Boot 的应用与数据库健康状态，正常返回 `{"status":"UP"}`。

其余业务接口尚未实现，计划见 [架构与实施步骤](docs/architecture.md)。

## 模板、素材与身份

已提供 6 条模板种子记录，包含 3 个分类以及 1 / 2 张素材要求。封面地址已在种子中约定，**对应图片文件尚未加入，当前页面不展示这些封面**。

计划随源码提供本地示例素材，运行时不依赖付费或内部服务。上传文件与结果文件保存至后端数据卷。身份计划采用预置演示用户与 Java 服务端会话，所有个人记录按会话用户隔离。上述素材上传、身份及历史查询当前均未实现。

## 任务与演示计划

任务整体状态计划为 `QUEUED / RUNNING / SUCCEEDED / FAILED`，依次执行 `MATERIAL_CHECK → GENERATE → FINALIZE`。Java 在任务事务提交后调度后台线程池；查询仅读取数据库。失败后停止后续步骤并保存失败阶段、原因。

计划支持创建时指定失败阶段、每阶段耗时，且持久化该配置快照。成功、指定阶段失败、多任务、刷新恢复、切换用户的演示命令将在功能完成后补充，目前不声称可演示。

服务重启后自动恢复执行不在本题要求内，暂不计划实现；重启时未完成任务的展示与处理策略仍待实现。已存历史应保留在 MySQL，浏览器关闭不应影响正常运行中的 Java 后台任务。

## 完成情况与验证

- 工程文件：前后端骨架、MySQL 初始化、Compose、配置示例与 CI 已编写；Compose 配置检查通过。运行验证结果见 [开发记录](docs/development-log.md)。
- 前端依赖已安装并生成锁文件；基础页面的 lint、TypeScript 检查和生产构建均已通过。详细记录见开发日志。
- 待完成：后端实际构建与容器运行验证、模板业务接口与页面、真实示例文件、上传、用户会话、后台任务、轮询、历史结果、核心业务测试、完整 CI 验证与最终验收。
- 当前首页仅为服务连通性验证页，不是最终模板列表。
- 实际开发投入按开发阶段记录；尚未统计用户自行操作、阅读或后续开发的时间，不将自动生成时间等同于人工投入。

## 部署与回滚

本地部署使用 `docker compose up --build -d`，以健康检查确认服务就绪。当前不要求公网部署。

后续代码采用分阶段 Git commit。发布前记录验收 commit 并备份数据库与素材数据卷。需要回滚应用时，在单独工作目录检出上一个已验证 commit，使用同一项目名和配置重建镜像；保留数据卷，不执行 `down -v`。若数据库结构发生变化，必须先评估向后兼容性，不能假定仅回滚代码就能回滚数据库。当前尚未引入数据库版本迁移工具。

## AI 使用与来源

使用 Codex 辅助分析要求、设计架构、生成和修改代码、编写文档及执行验证。工作流是：按要求拆分阶段 → 提供题目和当前仓库上下文 → 生成一块可检查的实现 → 查看差异并执行检查 → 根据真实错误修正 → 同步更新文档。用户负责审阅、理解与最终交付。

已明确的修正例子：初始准备采用全容器开发，结合本机已有 Node.js 的情况，调整为前端可本机开发、Java/MySQL 使用容器；保留完整 Compose 作为最终验收入口。

当前工程手工搭建，使用 Next.js、React、Spring Boot、MyBatis 等开源依赖及其官方 API，没有复制第三方业务项目。最终示例素材的来源、许可和复用范围将在加入时登记。不提交私人聊天记录、账号或真实凭据。

交付接受源码压缩包或可读取仓库。若使用仓库交付，最终补充验收 commit；当前尚无交付 commit。
