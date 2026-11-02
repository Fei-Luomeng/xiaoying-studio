# 拾影 · 素材工作室

小影科技 2027 校招全栈开发笔试项目。目标是完成「浏览模板 → 上传素材 → 创建异步任务 → 查询阶段 → 查看个人结果」闭环。

源码仓库：[Fei-Luomeng/xiaoying-studio](https://github.com/Fei-Luomeng/xiaoying-studio)。开发过程按阶段提交，当前不是最终验收版本。

**当前阶段：第 5 / 7 阶段，已完成任务自动跟踪、刷新／切换用户后自动恢复，以及个人历史页面。核心测试、容器联调通过，用户基础页面试用反馈暂未发现问题；系统验收及最终交付整理仍待完成。** 本文随开发同步更新，未验证的内容明确标记。

## 技术与职责

| 层 | 选择 | 职责 |
| --- | --- | --- |
| 前端 | Next.js 16.4.3 / React 19.3.1 / TypeScript 5.9.3 / Node.js 22.18+（22.x） | App Router、交互、通过同源代理访问 Java |
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

`checks` profile 包含临时 `backend-check` 和专用 `mysql-check`，不属于日常三个容器。测试 MySQL 不映射宿主机端口，数据放在 512MB tmpfs，初始化全部 SQL，不共享应用数据库或素材卷。检查后停止它，停止后测试数据库即清空；下次检查重新初始化。

## 开发与检查

前端可使用本机 Node.js 22.18+（22.x）开发；最低版本用于内置测试运行器直接读取纯 TypeScript 状态模块：

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
npm test
npm run typecheck
npm run build
```

`typecheck` 会先执行 `next typegen` 生成路由类型，再执行 `tsc --noEmit`，不依赖此前已运行过开发服务器或构建。

本机 `dev`、`typecheck`、`build`、`start` 统一经过 `frontend/scripts/next.mjs`，在加载 Next.js CLI 前设置 `NEXT_TELEMETRY_DISABLED=1`，避免遥测尝试写入宿主机偏好目录。无需手动追加环境变量，不更改系统全局设置，也没有新增依赖；Docker 与 CI 保留相同的环境设置。命令和 `npm run dev -- --port ...` 等参数转发方式不变。

Java 测试和构建可完全在容器中执行，不需要宿主机安装 Java/Maven：

```bash
docker compose --profile checks run --build --rm backend-check
docker compose --profile checks stop mysql-check
```

也可在 Java 21 / Maven 3.9 环境执行 `cd backend && mvn verify`，需用 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 指向已初始化的独立测试 MySQL。应用默认连接 `localhost:3307/xiaoying`；不要让测试与正在运行的应用共享数据库，应用工作器会领取同库的测试任务。推荐上述 Compose 检查入口，已固定连接专用 mysql-check。集成测试覆盖模板、会话／素材、任务顺序、失败中断、历史与结果归属；测试关闭自身自动领取，显式调用工作器，临时文件和自身记录在用例结束时清理。

CI 已配置在 push / pull request 时检查前端 lint、状态模型测试、类型和构建，以及使用真实 MySQL 的 Java 测试与构建。用户提供的 Actions 截图确认，第一阶段 `22ec58b`、第二阶段 `152bc97` 与第三阶段 `9c0e469` 均通过；第三次 CI 耗时 1 分 7 秒。CI 验证对应提交中的检查，不等同于全部业务或完整浏览器验收。第四阶段本机已通过 27 个 Java 集成测试和 10 个前端状态测试；用户截图确认第四阶段 `311e998` 的 CI #4 通过，耗时 1 分 17 秒。

第五阶段本机已通过 **21 个前端测试、28 个 Java 集成测试**、lint、类型检查和构建。新增 14 个测试直接运行页面使用的自动查询控制器，验证轮询停止、异常保留／恢复、超时、迟到响应、用户 scope 和请求清理；Java 增加 100 条以外待处理任务的恢复测试。用户截图已确认提交 `c448c47` 的 CI #5 通过，耗时 1 分 28 秒；用户已参考页面清单试用，反馈暂未发现问题，记录为基础手动试用正常。

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

请求错误采用 Problem Details，例如 `{"status":404,"detail":"模板不存在或已下架，请返回列表选择其他模板。"}`；数据库请求失败返回 503 和通用说明，不向浏览器暴露数据库细节。身份和素材接口见下节；任务接口及演示见 [异步任务验收](docs/async-tasks.md)。

## 模板、素材与身份

已提供 6 条模板种子记录，包含 3 个分类以及 1 / 2 张素材要求。已提供 6 张对应的原创 SVG 插画封面，位于 `backend/src/main/resources/static/demo/`，由 Java 静态资源服务读取，Next.js 代理 `/demo/*`。不依赖远程图片服务。SVG 用于展示，图片上传按模板规则仅接受 JPEG / PNG。

已随源码提供两张原创 PNG，位于 `backend/src/main/resources/static/demo/sample-1.png` 和 `sample-2.png`，也可在上传位点击「使用示例图」读取并执行真实上传。示例生成代码为 `tools/generate_upload_samples.py`，仅用 Python 标准库，运行网站时无需执行。JPEG 由集成测试生成并验证上传支持。

用户方案是两个预置演示用户「小陈 / demo-chen」「小林 / demo-lin」。在页头选择用户，Java 签发 7 天有效的随机会话 Cookie（HttpOnly、SameSite=Lax、Path=/api），MySQL 只保存令牌 SHA-256 摘要、用户归属和过期时间。浏览器刷新时从 `/api/auth/me` 恢复；切换用户时旧会话失效，客户端清空当前选择、取消旧请求并释放临时预览。前端不将令牌或用户身份依据保存到 localStorage；其 storage 事件只通知其他标签页重新确认身份。

**这是可自由选择预置账号的演示身份方案，不是生产账号登录。** 没有注册、密码或第三方身份服务。后端根据 Cookie 查用户，不信任客户端 userId；素材、任务、历史和文件结果均检查归属，其他用户读取返回 404。

| 方法与路径 | 主要字段／行为 |
| --- | --- |
| `GET /api/auth/demo-users` | 公开演示用户数组：`id / displayName` |
| `POST /api/auth/session` | JSON `userId`；返回用户并通过 Set-Cookie 设置会话 |
| `GET /api/auth/me` | 当前用户；没有有效会话返回 401 |
| `DELETE /api/auth/session` | 删除当前会话并清除 Cookie |
| `POST /api/assets` | multipart：`templateId`、单个 `file`；返回 201 和素材元数据 |
| `GET /api/assets` | 当前用户最近 100 个素材，按创建时间倒序 |
| `GET /api/assets/{id}` | 仅当前用户可读的素材元数据 |
| `GET /api/assets/{id}/content` | 仅当前用户可预览的真实文件，Cache-Control: no-store |

所有上述写请求带 `X-Studio-Request: 1`，前端统一添加；Java 拒绝缺少该头的普通跨站表单请求，未启用跨域 CORS。此头不是身份凭据，真正的归属校验依赖服务端会话。

上传响应包含 `id / ownerId / templateId / originalName / mimeType / sizeBytes / width / height / url / createdAt`。前端成功后用服务端 url 预览，不把浏览器 Blob 地址当成已保存素材。Java 校验模板、空文件、5 MB 限制、实际 JPEG / PNG 解码格式与声明 MIME 一致、最多 2000 万像素；文件以 UUID 命名存入 `/app/storage/uploads` 数据卷，元数据经 MyBatis 入库。解码或保存失败返回中文原因，超限返回 413，不支持格式返回 415。

**已有第二／三阶段数据卷的升级**：新空数据卷会自动执行全部 SQL。已有数据卷需应用新增脚本后再重建应用，不能只修改初始化目录就认为数据库已更新：

```bash
for script in database/init/003-identity-assets.sql database/init/004-demo-users.sql database/init/005-tasks.sql; do
  docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < "$script"
done
docker compose up --build -d
```

本机开发后端可设置 `STORAGE_ROOT`；Compose 固定到 `/app/storage` 并挂载独立卷。`COOKIE_SECURE=false` 用于本地 HTTP；通过 HTTPS 部署时设置为 true。演示步骤和 curl 示例见 [身份与素材验收](docs/identity-and-uploads.md)。

当前边界：移除、替换只更改本次表单选择，不物理删除已上传素材；刷新不恢复槽位选择，但身份、已存文件和素材元数据保留。文件系统与数据库没有分布式事务，常规保存失败会清理临时文件，进程在写文件与入库之间崩溃可能产生未引用文件，尚未实现清理任务。上传接口一次只接收一个文件；任务受理时另行校验准确数量、重复 ID、模板匹配、所有权、文件可用性及模拟参数。

## 异步任务与演示

| 方法与路径 | 主要字段／行为 |
| --- | --- |
| `POST /api/tasks` | JSON：`templateId`、按槽位顺序的 `assetIds`、可选 `simulation`；202 返回任务，Location 指向查询地址 |
| `GET /api/tasks?templateId=...` | 当前用户最近 100 条及全部未完成任务，模板筛选可选，倒序且去重 |
| `GET /api/tasks/{id}` | 当前用户的任务、当前阶段、全部步骤与配置快照 |
| `GET /api/tasks/{id}/result` | 成功后私有图片，未成功或越权为 404 |

写请求同样需要 `X-Studio-Request: 1`。响应字段为 `id / ownerId / templateId / status / stage / errorMessage / resultUrl / createdAt / updatedAt / finishedAt / simulation / steps`。整体时间字段为 UTC ISO 8601；步骤时间为 UTC 的 ISO 本地日期时间。步骤有 `stage / status / startedAt / finishedAt / errorMessage`。

状态为 `QUEUED → RUNNING → SUCCEEDED / FAILED`，阶段依次为 `MATERIAL_CHECK → GENERATE → FINALIZE`。任务、输入顺序、三个步骤和模拟参数在同一短事务中写入。后台单个 Java 调度线程每 500ms 从 MySQL 领取最早的排队任务，条件更新防止重复领取；步骤各自开始／完成时提交独立事务，不在延迟期间占用事务。查询只读库，没有推进任务的逻辑。没有增加队列、Redis 或新运行容器。

`simulation` 可省略：默认每阶段 1500ms、全部成功。可设置 `stepDelayMs`（0–30000 毫秒，逐阶段相同）与 `failAtStage`（三个阶段之一或 null），每次提交保存独立快照。详情页「模拟制作设置」可调整。失败时保存当前阶段和原因，后续步骤保持 WAITING 且开始时间为空。

模拟生成不处理图片；结果整理将第一张输入图片复制到独立结果目录，保存地址后任务成功。输入和结果均在素材卷中，Java 继续运行时关闭页面不会停止制作。详情页自动恢复该模板的记录，页头「我的作品」进入 `/history` 查看跨模板历史。身份恢复、进入页面和切换用户后会自动加载；刷新无需再次点击查询。

演示：选择用户 → 进入模板 → 各槽位上传或使用示例 → 开始制作 → 自动观察进度。连续创建任务可看到独立排队／执行／结果；指定「模拟生成失败」时后续整理不启动。未完成任务每轮查询结束约 2 秒后再次查询，最多同时 4 个请求；某任务结束后停止查询它，没有待查询任务时取消定时器，不继续请求历史。

查询异常与任务失败分开：单个任务查询失败保留其上次状态、显示黄色提示并暂停该任务查询，其他任务继续；完整历史读取失败保留已有记录并暂停自动跟踪。点击「恢复查询」或「刷新记录」重新加载并继续。每个请求最多 15 秒，用户／页面 scope 卸载会取消请求和定时器；迟到响应不能写回新 scope，终态不回退。其他标签页创建新任务不会主动推送到本页，可点击刷新发现。

后端参数、curl 见 [异步任务验收](docs/async-tasks.md)，自动跟踪、历史页面、异常恢复和可重复验证见 [前端异步状态验收](docs/frontend-async.md)。

**重启策略**：不实现执行中的断点续跑。单实例启动时，将原 RUNNING 任务及正在执行的步骤标记为 FAILED，并说明重启中断；QUEUED 任务保留，后台可继续领取；终态保留。数据库／素材卷不丢失时历史与成功结果保留。本题不要求的幂等提交、自动重试、集群运行、孤立文件清理均未实现。数据库在阶段写入时中断可能使任务停留 RUNNING，需要服务重启执行上述中断标记；不声称具备自动修复能力。

## 完成情况与验证

- 工程文件：前后端骨架、MySQL 初始化、Compose、配置示例与 CI 已编写；Compose 配置检查通过。运行验证结果见 [开发记录](docs/development-log.md)。
- 第一阶段工程骨架已提交，用户确认推送成功并提供 CI 通过截图。
- 已编写模板分类、列表、详情接口及数据库筛选；首页为模板列表，支持分类切换、进入详情、加载与空数据、重试和缺失模板反馈。详情展示封面与素材数量、格式、大小要求。
- 请求组件在分类切换、重试和离开页面时取消旧请求，并防止旧响应写回已卸载的视图；请求超时有可恢复的反馈。图片读取失败有替代展示。
- 新增 Java 集成测试覆盖分类、列表排序、筛选、未知分类、参数绑定、素材要求、404 / 400 和本地封面读取。当前阶段执行结果见开发日志。
- 第二阶段本机验证：前端 lint、类型检查、生产构建通过；容器内 9 个 Java 集成测试及 `mvn verify` 通过；前端、后端、MySQL 三个独立容器均健康。正式 3000 端口的页面、分类、列表、分类筛选、详情、本地封面和 404 已完成 HTTP 联调检查。
- 第三阶段已将素材位接成真实上传，支持本地选择、示例图片、预览、替换、移除、上传中与失败重试。上传位按模板数量生成，账号切换会取消请求并清空选择；当时制作按钮禁用；第四阶段已接通真实任务，未伪造历史。
- 浏览器 UI 使用临时 fixture 做过布局与交互检查；正式 Docker 网站的浏览器预览因工具会话错误未完成，不能把 HTTP 联调当作完整浏览器端到端验收。
- 第二阶段收尾已固定本机关闭遥测的入口，普通 `npm run build` 和更新后的 Docker 构建均通过。临时 3100 / 18080 服务已停止并验证端口关闭，正式入口为 3000。正式浏览器检查再次尝试时，内置预览未能打开、本机 Chrome 访问未获授权，仍按未验证记录。
- 第三阶段本机检查：6 个前端上传状态测试、lint、类型与构建通过；Java 共 18 个集成测试通过；现有独立容器组已重建且全部健康。正式 3000 端口的会话签发、双图真实上传、服务端图片读取、跨用户 404 与旧会话失效已完成 HTTP 验证。用户另已简单手工试用切换用户、上传、替换、移除，反馈基础操作正常；慢网、异常恢复、快速切换和小屏等场景尚未做系统的浏览器验收。
- 第四阶段：27 个 Java 集成测试、10 个前端状态测试、lint、类型检查和构建通过；正式三容器均健康。真实后台 HTTP 验收观察到三个阶段、排队、指定失败中断、结果字节、历史与跨用户隔离，保留两条非个人示例任务。用户随后提供截图确认正常制作、结果图片及模拟生成失败中断的页面表现，并反馈刷新页面／切回用户后可手动查询恢复记录。完整浏览器验收仍未完成，慢网、查询异常、快速切换及小屏等场景待系统检查。
- 第五阶段：详情与个人历史自动加载、未完成任务轮询、任务结束停止、独立查询错误和恢复、用户／页面请求清理已接入。21 个前端、28 个 Java 测试通过；实际控制器配合真实同源 HTTP 验证自动恢复、查询异常、其他任务继续、终态停止和用户隔离。三个正式容器健康，测试 MySQL 已停止。用户随后参考第五阶段页面清单试用并反馈暂未发现问题；未将概括反馈扩大为所有异常、网络请求和小屏场景逐项验收通过。
- 待完成：新增页面的浏览器系统验收、小屏与异常交互核对、最终干净环境验收及交付整理。当前历史最多最近 100 条加全部未完成任务，无更早已结束任务的翻页；自动化控制器／HTTP 检查不等同于浏览器验收。
- 按题目编号维护的实现与验证边界见 [要求验收表](docs/requirements.md)，不会把前端上传测试冒充制作任务测试。
- 实际开发投入按开发阶段记录；尚未统计用户自行操作、阅读或后续开发的时间，不将自动生成时间等同于人工投入。

## 部署与回滚

本地部署使用 `docker compose up --build -d`，以健康检查确认服务就绪。当前不要求公网部署。

后续代码采用分阶段 Git commit。发布前记录验收 commit 并备份数据库与素材数据卷。需要回滚应用时，在单独工作目录检出上一个已验证 commit，使用同一项目名和配置重建镜像；保留数据卷，不执行 `down -v`。若数据库结构发生变化，必须先评估向后兼容性，不能假定仅回滚代码就能回滚数据库。当前尚未引入数据库版本迁移工具。

## AI 使用与来源

使用 Codex 辅助分析要求、设计架构、生成和修改代码、编写文档及执行验证。工作流是：按要求拆分阶段 → 提供题目和当前仓库上下文 → 生成一块可检查的实现 → 查看差异并执行检查 → 根据真实错误修正 → 同步更新文档。用户负责审阅、理解与最终交付。

已明确的修正例子：初始准备采用全容器开发，结合本机已有 Node.js 的情况，调整为前端可本机开发、Java/MySQL 使用容器；保留完整 Compose 作为最终验收入口。

代码验证的具体例子：第二阶段 UI 检查正常，但真实 Java / MySQL 测试发现中文分类乱码。通过查询 `HEX(category)` 和 `CHAR_LENGTH(category)`，确认 4 个汉字被存成 12 个乱码字符，定位到种子导入时的客户端字符集。随后在 SQL 和 CI 导入命令中明确 UTF-8、将种子改为可幂等导入，修复现有演示记录，并重跑全部 9 个集成测试与 Java 构建，通过后才记录为修复完成。

当前工程手工搭建，使用 Next.js、React、Spring Boot、MyBatis 等开源依赖及其官方 API，没有复制第三方业务项目。6 张模板 SVG 封面由本项目编写矢量图形代码生成，无外部图片引用、字体或第三方素材依赖，随源码提供，可用于本项目演示。第三阶段的两张 PNG 同样由本项目的标准库绘图代码生成，随源码提供，无外部图片或字体依赖。后续新增素材的来源、许可和复用范围在加入时登记。不提交私人聊天记录、账号或真实凭据。

交付接受源码压缩包或可读取仓库。若使用仓库交付，最终补充验收 commit；当前尚无交付 commit。
