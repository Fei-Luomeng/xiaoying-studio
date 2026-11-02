# 拾影 · 素材工作室

小影科技 2027 校招全栈开发笔试项目。目标是完成「浏览模板 → 上传素材 → 创建异步任务 → 查询阶段 → 查看个人结果」闭环。

源码仓库：[Fei-Luomeng/xiaoying-studio](https://github.com/Fei-Luomeng/xiaoying-studio)。开发过程按阶段提交，当前不是最终验收版本。

**当前阶段：第 2 / 7 阶段，模板分类、列表与详情。上传、身份和异步制作尚未完成，不能作为最终交付。** 本文随开发同步更新，未验证的内容明确标记。

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

所有 SQL 显式设置 `SET NAMES utf8mb4`，避免命令行客户端的默认字符集把中文写成乱码。模板种子可幂等重导入：只覆盖这 6 个演示模板 ID 的字段，其他记录保留。对已启动的数据库执行：

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < database/init/002-seed.sql
```

首次启动需要拉取镜像及构建依赖，耗时受网络影响；之前本机遇到过 Docker Hub 认证超时。目前的实际验证结果以开发日志为准。

Compose 项目名固定为 `xiaoying-studio`，独立创建以下容器，不复用其他项目的服务：

| 服务 | 默认容器名 | 用途 |
| --- | --- | --- |
| frontend | `xiaoying-studio-frontend-1` | Next.js，入口端口 3000 |
| backend | `xiaoying-studio-backend-1` | Java API，入口端口 8080 |
| mysql | `xiaoying-studio-mysql-1` | MySQL，宿主机映射端口 3307 |

在 Docker Desktop 中可按 `xiaoying-studio` 项目管理。两个命名数据卷也带此前缀。日常操作均在项目根目录执行：

```bash
# 第一次运行或代码更新后重建
docker compose up --build -d
# 已有镜像与容器时启动（不重新构建）
docker compose up -d
# 停止，保留容器和数据
docker compose stop
# 查看状态
docker compose ps
```

`backend-check` 只在显式执行测试 profile 时临时创建，不属于日常运行的三个容器。

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

本机 `dev`、`typecheck`、`build`、`start` 统一经过 `frontend/scripts/next.mjs`，在加载 Next.js CLI 前设置 `NEXT_TELEMETRY_DISABLED=1`，避免遥测尝试写入宿主机偏好目录。无需手动追加环境变量，不更改系统全局设置，也没有新增依赖；Docker 与 CI 保留相同的环境设置。命令和 `npm run dev -- --port ...` 等参数转发方式不变。

Java 测试和构建可完全在容器中执行，不需要宿主机安装 Java/Maven：

```bash
docker compose --profile checks run --build --rm backend-check
```

也可在 Java 21 / Maven 3.9 环境执行 `cd backend && mvn verify`，先启动 MySQL。默认连接 `localhost:3307/xiaoying`。可通过 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 覆盖。当前集成测试使用真实 MySQL，验证 HTTP → Java → MyBatis → 种子表及健康检查。

CI 已配置在 push / pull request 时检查前端 lint、类型和构建，以及使用真实 MySQL 的 Java 测试与构建。用户提供的 Actions 截图确认，第一阶段提交 `22ec58b` 与第二阶段提交 `152bc97` 均通过；第二次 CI 耗时 1 分 10 秒。CI 验证对应提交中的检查，不等同于全部业务或完整浏览器验收。核心业务测试在对应功能实现时加入，不用基础连通性测试代替业务测试。

## 当前接口

`GET /api/system/status`：经 MyBatis 查询数据库中的模板数量，用于开发阶段验证链路。数据库不可用时返回请求错误，不伪造正常状态。

```json
{"status":"UP","application":"Xiaoying Studio","templateCount":6}
```

`GET /actuator/health`：Spring Boot 的应用与数据库健康状态，正常返回 `{"status":"UP"}`。

模板接口见下表，完整示例与验证步骤见 [模板浏览验收](docs/template-browsing.md)：

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| `GET /api/templates/categories` | 无 | 分类字符串数组，按种子排序 |
| `GET /api/templates` | 可选 `category`，空白表示全部 | 模板对象数组；无匹配返回 `[]` |
| `GET /api/templates/{id}` | 模板 ID | 单个模板；不存在返回 404 |
| `GET /demo/{filename}.svg` | 已提供的封面文件名 | 随后端部署的本地 SVG 图片 |

模板字段为 `id`、`title`、`category`、`description`、`coverUrl`、`requiredImageCount`、`acceptedMimeTypes`（字符串数组）、`maxFileSizeBytes`（字节数）。数据库 JSON 存储格式不会直接暴露为字符串。

请求错误采用 Problem Details，例如 `{"status":404,"detail":"模板不存在或已下架，请返回列表选择其他模板。"}`；数据库请求失败返回 503 和通用说明，不向浏览器暴露数据库细节。其他业务接口仍未实现，计划见 [架构与实施步骤](docs/architecture.md)。

## 模板、素材与身份

已提供 6 条模板种子记录，包含 3 个分类以及 1 / 2 张素材要求。已提供 6 张对应的原创 SVG 插画封面，位于 `backend/src/main/resources/static/demo/`，由 Java 静态资源服务读取，Next.js 代理 `/demo/*`。不依赖远程图片服务。SVG 用于展示，后续上传仍按模板规则仅接受 JPEG / PNG。

后续会随源码提供可上传的 JPEG / PNG 示例素材，运行时不依赖付费或内部服务。上传文件与结果文件保存至后端数据卷。身份计划采用预置演示用户与 Java 服务端会话，所有个人记录按会话用户隔离。上述素材上传、身份及历史查询当前均未实现。

## 任务与演示计划

任务整体状态计划为 `QUEUED / RUNNING / SUCCEEDED / FAILED`，依次执行 `MATERIAL_CHECK → GENERATE → FINALIZE`。Java 在任务事务提交后调度后台线程池；查询仅读取数据库。失败后停止后续步骤并保存失败阶段、原因。

计划支持创建时指定失败阶段、每阶段耗时，且持久化该配置快照。成功、指定阶段失败、多任务、刷新恢复、切换用户的演示命令将在功能完成后补充，目前不声称可演示。

服务重启后自动恢复执行不在本题要求内，暂不计划实现；重启时未完成任务的展示与处理策略仍待实现。已存历史应保留在 MySQL，浏览器关闭不应影响正常运行中的 Java 后台任务。

## 完成情况与验证

- 工程文件：前后端骨架、MySQL 初始化、Compose、配置示例与 CI 已编写；Compose 配置检查通过。运行验证结果见 [开发记录](docs/development-log.md)。
- 第一阶段工程骨架已提交，用户确认推送成功并提供 CI 通过截图。
- 已编写模板分类、列表、详情接口及数据库筛选；首页为模板列表，支持分类切换、进入详情、加载与空数据、重试和缺失模板反馈。详情展示封面与素材数量、格式、大小要求。
- 请求组件在分类切换、重试和离开页面时取消旧请求，并防止旧响应写回已卸载的视图；请求超时有可恢复的反馈。图片读取失败有替代展示。
- 新增 Java 集成测试覆盖分类、列表排序、筛选、未知分类、参数绑定、素材要求、404 / 400 和本地封面读取。当前阶段执行结果见开发日志。
- 本轮本机验证：前端 lint、类型检查、生产构建通过；容器内 9 个 Java 集成测试及 `mvn verify` 通过；前端、后端、MySQL 三个独立容器均健康。正式 3000 端口的页面、分类、列表、分类筛选、详情、本地封面和 404 已完成 HTTP 联调检查。
- 当前详情里的素材位为静态占位，明确说明上传与制作尚未开放，作品区域不伪造历史记录。
- 浏览器 UI 使用临时 fixture 做过布局与交互检查；正式 Docker 网站的浏览器预览因工具会话错误未完成，不能把 HTTP 联调当作完整浏览器端到端验收。
- 第二阶段收尾已固定本机关闭遥测的入口，普通 `npm run build` 和更新后的 Docker 构建均通过。临时 3100 / 18080 服务已停止并验证端口关闭，正式入口为 3000。正式浏览器检查再次尝试时，内置预览未能打开、本机 Chrome 访问未获授权，仍按未验证记录。
- 待完成：可上传示例文件、素材上传、用户会话、后台任务、轮询、历史结果、核心异步行为测试与最终验收。
- 实际开发投入按开发阶段记录；尚未统计用户自行操作、阅读或后续开发的时间，不将自动生成时间等同于人工投入。

## 部署与回滚

本地部署使用 `docker compose up --build -d`，以健康检查确认服务就绪。当前不要求公网部署。

后续代码采用分阶段 Git commit。发布前记录验收 commit 并备份数据库与素材数据卷。需要回滚应用时，在单独工作目录检出上一个已验证 commit，使用同一项目名和配置重建镜像；保留数据卷，不执行 `down -v`。若数据库结构发生变化，必须先评估向后兼容性，不能假定仅回滚代码就能回滚数据库。当前尚未引入数据库版本迁移工具。

## AI 使用与来源

使用 Codex 辅助分析要求、设计架构、生成和修改代码、编写文档及执行验证。工作流是：按要求拆分阶段 → 提供题目和当前仓库上下文 → 生成一块可检查的实现 → 查看差异并执行检查 → 根据真实错误修正 → 同步更新文档。用户负责审阅、理解与最终交付。

已明确的修正例子：初始准备采用全容器开发，结合本机已有 Node.js 的情况，调整为前端可本机开发、Java/MySQL 使用容器；保留完整 Compose 作为最终验收入口。

代码验证的具体例子：第二阶段 UI 检查正常，但真实 Java / MySQL 测试发现中文分类乱码。通过查询 `HEX(category)` 和 `CHAR_LENGTH(category)`，确认 4 个汉字被存成 12 个乱码字符，定位到种子导入时的客户端字符集。随后在 SQL 和 CI 导入命令中明确 UTF-8、将种子改为可幂等导入，修复现有演示记录，并重跑全部 9 个集成测试与 Java 构建，通过后才记录为修复完成。

当前工程手工搭建，使用 Next.js、React、Spring Boot、MyBatis 等开源依赖及其官方 API，没有复制第三方业务项目。6 张模板 SVG 封面由本项目编写矢量图形代码生成，无外部图片引用、字体或第三方素材依赖，随源码提供，可用于本项目演示。后续新增素材的来源、许可和复用范围在加入时登记。不提交私人聊天记录、账号或真实凭据。

交付接受源码压缩包或可读取仓库。若使用仓库交付，最终补充验收 commit；当前尚无交付 commit。
