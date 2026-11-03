# 架构与实施步骤

## 职责边界

浏览器通过 Next.js 同源 `/api` 代理访问 Java。Next.js 不承担业务执行、用户会话认证或数据库写入。Java 使用 MyBatis 访问 MySQL，使用本地数据卷存放上传与结果。

## 阶段

1. 工程骨架：Docker、真实数据库连通性、依赖锁定、CI 和 README。
2. 模板浏览：模板接口、本地封面、列表和详情。
3. 身份与素材：预置演示用户、服务端会话、素材上传及校验。
4. 任务执行：持久化队列、单个后台线程领取已提交任务、三阶段边界、失败中断和配置快照。
5. 前端异步状态：上传与提交分离、按用户／任务隔离状态、仅跟踪未完成任务、取消旧请求、刷新恢复、独立历史页和结果预览。
6. 验证完善（当前阶段）：容器内完整检查、独立空卷启动、实际浏览器桌面／小屏／键盘操作、查询异常恢复和重启持久化。范围与证据见 system-acceptance.md。
7. 交付整理：完整 README、素材来源、配置示例、部署回滚和验收 commit。

测试、CI 和文档在所有阶段持续维护，不留到第 6 / 7 阶段才开始。

## 已编写的模板接口

- `GET /api/templates/categories`、`GET /api/templates?category=...`、`GET /api/templates/{id}`
- Java 本地封面静态资源 `/demo/*.svg`

## 已编写的身份与素材接口

- `GET /api/auth/demo-users`、`POST /api/auth/session`、`GET /api/auth/me`、`DELETE /api/auth/session`
- `POST /api/assets`（multipart，返回服务端素材 ID）、`GET /api/assets`
- `GET /api/assets/{id}`、`GET /api/assets/{id}/content`（按会话归属校验）
- 两张公开本地示例 PNG：`/demo/sample-1.png`、`/demo/sample-2.png`

## 已编写的任务接口
- `POST /api/tasks`（模板 ID、按顺序的素材 ID、开发模拟参数）
- `GET /api/tasks`、`GET /api/tasks/{id}`（只查询当前用户）
- `GET /api/tasks/{id}/result`（成功图片，按会话归属校验）

采用数据库排队 + 单线程顺序执行，无额外消息队列。每个阶段开始、结束独立短事务，查询使用一致性快照读取任务与步骤。文件复制在事务外，最后短事务发布成功。仅支持单个 Java 应用实例；启动时将中断的 RUNNING 标为失败，不做续跑。执行期间数据库写入失败等边界见 [异步任务说明](async-tasks.md)。

## 前端查询与测试隔离

详情页按标准模板 ID 过滤，`/history` 读取跨模板记录。React 用 `useSyncExternalStore` 订阅可测试的查询控制器；控制器在页面 effect 中启动，清理时取消。状态按用户 ID、会话 generation 和模板重新建立，不跨用户复用。先加载历史（最近 100 条 + 所有未完成），再只查询未完成 ID；每轮结束 2 秒后继续，最多并发 4 个请求。终态与旧时间戳合并保护避免进度回退。

查询异常与执行失败分开；某 ID 查询失败只暂停它，列表请求失败暂停自动跟踪，均保留上次记录并可恢复。取消信号及请求实例检查同时生效，即使迟到响应忽略 abort，也不能写入新的用户／页面状态。具体测试与边界见 [前端异步状态](frontend-async.md)。

Compose 的 checks profile 使用独立 mysql-check（tmpfs、不映射端口），避免运行中的应用领取测试夹具任务；CI 本身的 MySQL 服务也与应用隔离。正常启动仍只有 frontend / backend / mysql 三个服务。

## 必须保持的行为

- 任务状态与阶段由后端保存，查询不能驱动执行。
- 素材数量、真实格式、大小、所有权与制作参数都在服务端校验。
- 终态不可回退，每个阶段失败后停止后续执行。
- 查询异常只影响查询反馈，不把任务标记为失败。
- 每个任务独立，切换用户后旧请求不得写入新用户视图。
- 未完成任务存在时才自动跟踪，全部结束或页面卸载时清理。
- 不扩展会员、积分、真实 AI 或复杂模板后台。
