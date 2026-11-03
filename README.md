# 拾影 · 素材工作室

小影科技 2027 校招全栈开发笔试项目。目标是完成「浏览模板 → 上传素材 → 创建异步任务 → 查询阶段 → 查看个人结果」闭环。

源码仓库：[Fei-Luomeng/xiaoying-studio](https://github.com/Fei-Luomeng/xiaoying-studio)。交付入口、源码包与版本标识方式见 [交付说明](docs/delivery.md)。

**当前阶段：第 7 / 7 阶段，功能、系统验收及交付材料整理已完成，提供可复核的源码导出。交付版本以提交方附带的完整 SHA 或包内 SOURCE_INFO.json 为准；交付前确认对应提交的 CI。实际投入按两天聊天及工作记录粗估约 11 小时，统计口径见下文。** 未实现和未验证的边界见下文及验收文档。

## 项目定位与界面参考

这是模板驱动的图片素材制作网站：浏览模板、准备图片、提交任务，在 Java 后台制作期间继续使用网站，最后查看个人进度、历史和结果。模拟生成器代替真实 AI；当前结果按规则复制第一张输入图。重点是 Java 多步骤异步执行与持久化，以及前端多任务、请求异常和刷新恢复。

按题目 R-11，参考截图用于对应页面的主要布局、层级、间距和状态反馈，不要求逐像素或品牌素材一致。本项目使用原创品牌、封面与示例图片，保留以下布局关系：

| 参考 | 本项目对应实现 |
| --- | --- |
| UI-01 模板列表与分类 | 顶部导航、分类筛选、封面卡片网格与详情入口 |
| UI-02 普通模板详情与上传位 | 桌面左侧模板／上传／提交，右侧作品记录；小屏上下排列 |
| UI-03 制作中与历史结果 | 独立任务卡、等待／处理阶段、失败原因和成功预览；另提供个人历史页 |

用户身份按 R-10 自行设计为演示账号选择和私有记录，不要求复刻账号设置截图。截图里的积分、会员、支付、语言切换、删除与重新制作等功能不扩展正文要求。

## 分阶段完成记录与取舍

每阶段完成后同步本表、实际投入、验证结果和剩余事项，再由用户执行 Git 提交／推送；CI 和手动反馈到达后继续补记。README 汇总当前结论，逐次问题、修正和工具记录见 [开发日志](docs/development-log.md)，按题目编号核对见 [要求验收表](docs/requirements.md)。以下 7 步是项目的实施拆分。

| 步骤 | 状态与交付 | 验证与提交 | 本阶段主要取舍 |
| --- | --- | --- | --- |
| 1. 工程骨架 | 已完成 Next.js / Java / MySQL、SQL、Compose、依赖锁文件及 CI 入口 | `22ec58b`，CI #1 通过；最初本地 Java 因镜像下载未验证，后续阶段补验 | 前端允许用本机 Node 开发，保留全容器交付；不添加 Redis 或消息队列 |
| 2. 模板浏览 | 已完成 3 类 6 模板、Java 筛选与详情、列表及本地封面 | `152bc97`，CI #2 通过；Java 9 项与前端检查通过；运行收尾 `495ecec` | 使用数据库种子和原创本地 SVG，不做模板管理后台；显式 UTF-8 修复中文种子乱码 |
| 3. 身份与上传 | 已完成演示用户会话、真实图片上传、预览／替换／移除、双端校验与私有素材 | `9c0e469`，CI #3 通过；Java 18 项、前端 6 项，用户基础页面试用正常 | 使用两名演示用户，不扩展注册／密码；文件保存在本地卷；移除选择不物理删除素材 |
| 4. Java 异步任务 | 已完成受理、三阶段、失败中断、耗时／失败配置快照、持久化结果和手动查询 | `311e998`，CI #4 通过；Java 27 项、前端 10 项，真实 HTTP 及成功／失败页面检查通过 | MySQL 排队、单 Java 工作线程串行执行；模拟结果复制第一张图片；不做执行中续跑 |
| 5. 自动跟踪与历史 | 已完成自动恢复、未完成任务轮询、异常保留／恢复、用户请求隔离及个人历史页 | `c448c47`，CI #5 通过；最终 Java 28 项、前端 21 项，实际控制器 HTTP 通过；用户基础试用暂未发现问题 | 2 秒轮询、最多 4 个查询并发，终态停止；异常项暂停后可手动恢复；测试 MySQL 与应用隔离 |
| 6. 系统验收 | 已完成独立空卷启动、容器检查、浏览器操作、异常恢复、进程中断及重启验证，未发现需修复的功能问题 | 038b379，用户截图确认 CI #8 通过（1 分 15 秒）；21 个前端、28 个 Java 测试及生命周期脚本通过，实际截图见系统验收记录 | 保留演示环境，验收使用独立项目和端口；前后端完整检查均可在容器执行 |
| 7. 最终交付 | 已完成交付清单、完成／未完成项、配置、来源与投入说明，以及源码导出和校验 | 最近已确认系统验收与 CI 为 038b379；仓库交付附实际完整 SHA，源码包记录实际版本和文件哈希 | 仓库或源码包二选一；不编造工时；不提交依赖缓存或运行数据；不要求公网部署 |

表中的测试数量是各阶段当时的结果，当前测试数量以第 5 步为准。CI 通过只证明对应提交的流水线检查，基础手动反馈不等同全量浏览器验收。各阶段可核验的投入记录见下文「实际投入记录」，不是将 Git 提交间隔当作工时。

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
tools/package-source.py   源码打包与校验（Python 标准库）
release/                  本机生成的源码包及校验文件，Git 忽略
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

`checks` profile 包含临时 `frontend-check / backend-check` 和专用 `mysql-check`，不属于日常三个容器。前端检查也可完全在容器内执行；测试 MySQL 不映射宿主机端口，数据放在 512MB tmpfs，初始化全部 SQL，不共享应用数据库或素材卷。检查后停止它，停止后测试数据库即清空；下次检查重新初始化。

## 开发与检查

前端可使用本机 Node.js 22.18+（22.x）开发；最低版本用于内置测试运行器直接读取纯 TypeScript 状态模块：

```bash
docker compose up --build -d backend
cd frontend
npm ci
npm run dev
```

前端默认转发 `/api/*` 至 `http://localhost:8080`。若修改后端映射端口，在启动前端时设置 `BACKEND_ORIGIN=http://localhost:新端口`。它是服务端配置，不使用 `NEXT_PUBLIC_*` 暴露内部地址。容器生产构建通过 build arg 将该地址设为 `http://backend:8080`；修改时需重建前端镜像。

验收时优先使用容器执行前端完整检查（仓库根目录）：

```bash
docker compose --profile checks run --build --rm frontend-check
```

本机开发的前端检查命令（在 `frontend/` 内）：

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

第六阶段在独立 `xiaoying-acceptance` 项目及全新 MySQL／素材卷上重复完成上述容器检查，21 个前端、28 个 Java 测试和构建均通过。实际浏览器验证了分类、上传、自动制作、失败中断、刷新恢复、用户隔离、双图数量限制、模板 404、查询异常恢复，以及 1440px 桌面和 375px 小屏布局与键盘操作。进程强制中断和整组容器重启验证也通过。命令、逐项证据、范围与实际截图见 [系统验收记录](docs/system-acceptance.md)。

日常环境手动复查通过：正常任务自动完成并展示结果、刷新页面自动恢复历史、用户切换后分别加载记录，以及个人历史页和结果预览。

2026-11-03 最终复核后修复查询控制器的停止状态：取消请求及定时器时同步复位 `polling`、`historyLoading`，保留已有任务；重复停止不重复更新快照。补强原有生命周期用例，验证停止／重新启动和旧响应迟到时的状态一致性，测试数量仍为 21。本次前端 lint、全部测试、类型检查和生产构建在临时检查容器通过，日常前端容器已更新并健康；Java 未修改，本轮未重跑 Java 测试或完整浏览器验收。此修复及投入说明需随新提交确认 CI，再更新交付 SHA 与源码包。

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

- 业务闭环已实现：Java 模板与素材接口、服务端身份与归属校验、三阶段异步任务、可控制耗时／失败、个人历史与结果；前端支持上传、连续提交、自动跟踪、刷新恢复、查询异常保留与恢复。
- 自动检查：21 个前端测试、28 个真实 MySQL Java 测试，lint、类型检查和两端构建通过；核心用例验证步骤顺序与失败中断、多任务独立、请求异常与执行失败的区分、终态停止及迟到请求清理。
- CI 在 push / pull request 运行。最新已由截图确认的系统验收提交为 `038b379`（CI #8，1 分 15 秒）；交付版本的 CI 以该提交的实际结果为准。
- 独立空卷环境首次初始化、桌面／375px 小屏、基本键盘、浏览器查询异常恢复、强制中断和 stop/start 持久化已通过。日常环境的正常制作、刷新、用户切换、历史预览四项手动复查通过。
- 源码导出包含 109 个源文件，已检查文件校验、完整性及权限；解压目录 Compose 配置与前后端镜像构建通过。该构建可复用已有依赖／构建缓存，不等同于再次运行全部测试。
- 未实现边界：真实 AI／多图合成、生产账号、幂等、任务自动重试、执行中续跑、集群、容量限制、孤立文件清理、更早终态历史分页；未验证全浏览器／真机／读屏、压力、磁盘损坏及全部断网组合。部分属于题目明确不要求的扩展，具体取舍见 [交付说明](docs/delivery.md)。
- 人工净投入未单独统计，统计范围见下文；仓库交付由提交方附上完整验收 SHA。最终提交与发送材料由开发者执行。

逐项实现与证据见 [要求验收表](docs/requirements.md)，实际截图和方法见 [系统验收记录](docs/system-acceptance.md)，历史问题与修正见 [开发记录](docs/development-log.md)。

## 实际投入记录

**截至 2026-11-03 中午，按开发者确认的“根据聊天时间粗估”口径，本项目投入约 11 小时。** 估算依据为 11 月 2 日约 10:28–19:13（约 8 小时 45 分）及 11 月 3 日约 10:06–12:02（约 2 小时），涵盖需求讨论、AI 辅助开发与审阅、环境配置、测试验证、交付整理和最后复核。

这是两天工作窗口的粗略经过时间，包含镜像／依赖下载、构建等待和期间间歇，不包含跨日休息；没有单独统计连续人工操作或纯编码净工时，未计时的零散操作也可能遗漏。它用于说明本次开发的实际时间量级，不作为精确工时记录。

开发者补充：每轮功能完成后，按提供的步骤手动检查页面，通常在 5 分钟以内；累计轮次及页面测试总时长未单独统计。这部分已包含在上述整体工作窗口中，不另行重复相加。

以下只汇总现有可核验的辅助开发会话记录，第 1–5 阶段日期为 2026-11-02，第 6–7 阶段为 2026-11-03，时区 Asia/Shanghai。它们包含生成、检查、授权、网络下载等等待，也可能漏掉未计时工作，不能相加后充当人工总工时。

| 阶段 | 已有时间记录 | 统计边界 |
| --- | --- | --- |
| 1 | 10:28–10:39 约 11 分钟；10:47–10:52 约 5 分钟 | 两个局部窗口，此前需求讨论、用户安装及 Git 配置未完整计时 |
| 2 | 11:44 开始；16:13 起另有运行入口收尾记录 | 含长时间下载、工具等待和多次打断，没有可用的阶段净投入合计 |
| 3 | 16:28–17:31，经过约 63 分钟 | 辅助开发会话经过时间，用户独立操作未计入 |
| 4 | 首次测试日志 18:02，收尾 18:19，可核验窗口约 17 分钟 | 不是完整阶段起点，之前的实现时间未完整记录 |
| 5 | 18:40–19:13，经过约 33 分钟 | 辅助会话窗口；后续用户自行试用及提交时间未计入 |
| 6 | 2026-11-03 10:06–10:41，可核验窗口约 35 分钟 | 含构建、浏览器操作及授权等待的辅助会话，不是人工净工时 |
| 7 | 2026-11-03 11:02–11:15，可核验窗口约 13 分钟 | 材料整理、导出校验与容器构建等待，不是人工净工时 |

逐次记录及问题修正见 [开发日志](docs/development-log.md)。上表保留各阶段当时的局部记录；约 11 小时的整体估算另包含阶段间讨论、用户操作与最终复核，不由局部窗口简单相加得出。阶段取舍已列在前面的表格，架构及未实现边界见相应章节。

本轮对 R-13 的逐项检查、已覆盖位置及待补材料见 [README 要求核对](docs/readme-audit.md)。

## 部署与回滚

本地部署使用 `docker compose up --build -d`，以健康检查确认服务就绪。当前不要求公网部署。

后续代码采用分阶段 Git commit。发布前记录验收 commit 并备份数据库与素材数据卷。需要回滚应用时，在单独工作目录检出上一个已验证 commit，使用同一项目名和配置重建镜像；保留数据卷，不执行 `down -v`。若数据库结构发生变化，必须先评估向后兼容性，不能假定仅回滚代码就能回滚数据库。当前尚未引入数据库版本迁移工具。

备份示例、发布顺序和回滚检查见 [交付说明](docs/delivery.md)。本项目没有进行生产部署或生产数据回滚。

## AI 使用与来源

使用 Codex 辅助分析要求、设计架构、生成和修改代码、编写文档及执行验证。工作流是：按要求拆分阶段 → 提供题目和当前仓库上下文 → 生成一块可检查的实现 → 查看差异并执行检查 → 根据真实错误修正 → 同步更新文档。用户负责审阅、理解与最终交付。

已明确的修正例子：初始准备采用全容器开发，结合本机已有 Node.js 的情况，调整为前端可本机开发、Java/MySQL 使用容器；保留完整 Compose 作为最终验收入口。

代码验证的具体例子：第二阶段 UI 检查正常，但真实 Java / MySQL 测试发现中文分类乱码。通过查询 `HEX(category)` 和 `CHAR_LENGTH(category)`，确认 4 个汉字被存成 12 个乱码字符，定位到种子导入时的客户端字符集。随后在 SQL 和 CI 导入命令中明确 UTF-8、将种子改为可幂等导入，修复现有演示记录，并重跑全部 9 个集成测试与 Java 构建，通过后才记录为修复完成。

当前工程手工搭建，使用 Next.js、React、Spring Boot、MyBatis 等开源依赖及其官方 API，没有复制第三方业务项目。6 张模板 SVG 封面由本项目编写矢量图形代码生成，无外部图片引用、字体或第三方素材依赖，随源码提供，可用于本项目演示。第三阶段的两张 PNG 同样由本项目的标准库绘图代码生成，随源码提供，无外部图片或字体依赖。后续新增素材的来源、许可和复用范围在加入时登记。不提交私人聊天记录、账号或真实凭据。

## 源码导出与交付版本

题目接受可读取仓库或源码压缩包。功能与系统验收最近通过的提交为 `038b379`（CI #8）；本轮整理材料的最终 SHA 在提交后确定，仓库交付时将完整 SHA 与仓库链接一起回复，不以旧提交冒充新的材料版本。

```bash
# 导出源码，不安装依赖或运行应用
python3 tools/package-source.py
# 最后提交后，取得完整验收 SHA 并重新导出
git rev-parse HEAD
python3 tools/package-source.py
```

生成 `release/xiaoying-studio-source.zip` 和 `.zip.sha256`。包内 `SOURCE_INFO.json` 记录 HEAD、工作区是否干净及每个源文件的 SHA-256；工作区有改动时明确标为 working-tree，不将其 HEAD 当成完整交付版本。最后提交后的干净导出标为 commit。源码包不包含 `.git`、依赖目录、构建缓存、本机 `.env`、备份或运行素材／数据库；初始化素材仍完整包含。

最终选择仓库或源码包，确认对应提交 CI 后，通过收到题目的沟通渠道交付。具体材料、已知限制和最终操作见 [交付说明](docs/delivery.md)。
