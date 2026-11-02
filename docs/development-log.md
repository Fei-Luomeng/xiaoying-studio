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

## 2026-11-02 · 第二阶段：模板分类、列表与详情

- 用户确认第一笔提交已推送，Actions 截图显示 `22ec58b` 的第一次 CI 通过。此证据只对应第一阶段代码。
- 已编写 Java 模板分类、按分类筛选的列表、详情接口；MyBatis 使用绑定参数读取真实种子表，将 JSON 素材类型转换为响应数组。不存在的模板返回中文说明的 404，过长分类返回 400，数据库访问失败返回通用 503。
- 已加入 6 张原创 SVG 插画封面，由 Java 提供本地静态资源。前端同源代理 `/api/*` 与 `/demo/*`。
- 前端完成分类按钮、模板卡片、详情、素材要求、按数量展示的素材占位、加载骨架、空数据、请求失败和重试入口。上传、制作、用户会话和历史任务仍未实现，不使用伪造历史替代。
- 请求在切换分类、重试和卸载时取消，旧响应不能更新卸载后的组件，15 秒超时有中文反馈。组件按 URL / 重试次数设置 key，隔离每次读取的状态。
- 前端 `npm run lint`、`npm run typecheck` 均通过。生产构建一次因 Next.js 尝试写宿主机偏好路径而遇到沙箱 EPERM；设置 `NEXT_TELEMETRY_DISABLED=1` 后，`npm run build` 通过。
- Next.js 开发服务器自动生成了 `frontend/AGENTS.md`。已阅读本地依赖自带的路由、导航、图片和 loading 文档，避免使用已弃用的图片 priority 属性，改为显式 eager / lazy 加载，并补充详情路由的 loading 边界。
- 浏览器 UI 检查使用 `/private/tmp` 中的临时接口 fixture，从同一 SQL 种子生成数据，不属于交付代码：确认 6 卡片展示、萌宠分类 2 卡片、1 / 2 张素材详情、404 返回入口；1440px 下详情双栏，375px 下上下排列且无横向溢出。后续错误／重试场景的预览连接中断，未记录为通过。以上不等同于 Java 联调或自动化端到端测试。
- 临时 UI 预览使用 3100 端口，fixture 使用 18080 端口；停止请求被工具拒绝，服务可能仍运行。正式 Compose 使用 3000 / 8080 / 3307，与临时预览分离；临时预览不作为交付运行入口。
- Docker：已直接拉取 MySQL、Maven 与 Java 运行时官方镜像，绕过本机构建器单独拉取元数据时的超时问题。独立创建 `xiaoying-studio` 网络、MySQL 数据卷及 `xiaoying-studio-mysql-1`；容器健康，真实 SQL 查询确认 3 类各 2 条模板。
- 首次发现 `dependency:go-offline` 预下载了无关构建插件与云 SDK，拖慢启动。已获授权中断旧测试构建，改为正常编译生命周期、锁定共享 Maven 缓存，并在测试镜像中保留已下载依赖。正在重跑 Java 测试及完整 Compose，最终结果待补充。
- Java 新增 7 个模板集成测试，与原有 2 个基础测试一起运行；尚未以编写完成代替执行通过。
- 本阶段 11:44 开始，期间多次用户中断、工具授权等待和长时间镜像／依赖下载。净人工投入尚未统计，不把完整经过时间作为用户人工编码工时；第一阶段已有计时窗口继续保留。
- 真实集成测试首次结果为 9 项中 7 项通过、2 项失败：分类返回乱码且中文筛选无结果。查询 HEX 和字符长度确认数据库已存入误解码的文本。已在 SQL 加入 `SET NAMES utf8mb4`，CI 导入命令显式设置 UTF-8，种子改为按 6 个演示 ID 幂等更新；重新导入修复现有记录，未重建或清空数据卷。
- 修复后重跑 `docker compose --progress plain --profile checks run --build --rm backend-check`：**9 个测试全部通过（7 个模板测试 + 2 个基础测试），`mvn verify` 构建成功**，日志结束于 15:30:31（Asia/Shanghai）。详情测试也增加了标题和描述的中文断言。
- 完整 Compose 构建遇到 Ubuntu 软件源超时。检查官方 Java 运行时镜像，确认已包含 curl，移除重复 apt 安装；前端容器安装关闭额外 audit / fund 请求并优先使用 npm 缓存。新 Compose 构建启动验证仍在进行。
- 更新后的完整 `docker compose --progress plain up --build -d` 已成功。前端首次容器依赖安装约 8 分钟；Next.js 容器内生产构建成功，Java 运行镜像构建成功。`xiaoying-studio-frontend-1`、`xiaoying-studio-backend-1`、`xiaoying-studio-mysql-1` 均为 healthy，端口分别为本机 3000 / 8080 / 3307，两个数据卷独立保留。
- 正式运行镜像的 Java 分类和详情响应均为正确中文。从宿主机正式 3000 端口完成断言：页面正常、分类数组正确、模板 6 条、萌宠筛选 2 条、旅行明信片详情和双图要求正确、封面代理返回 SVG、缺失模板 API 返回中文 404。证明 Next.js → Java → MySQL 的真实 HTTP 链路已连通。
- 正式 Docker 网站尝试在浏览器预览中打开时仍遇到工具会话错误，未记录为完整浏览器联调通过。可直接在普通浏览器访问 `http://localhost:3000` 按验收文档操作；不提供伪造截图。
- 只读检查确认临时 3100 UI 预览仍响应 200，先前停止请求未获授权，未改用其他方式终止；正式入口明确为 3000。
- 第二阶段已达到本地 Git 提交节点，尚未替用户创建第二笔提交或推送；新增代码的 GitHub CI 需在后续 push 后核对。
- 后续用户已自行提交并 push 第二阶段代码：`152bc97`（`feat: 实现模板分类、列表与详情`）。用户提供的 Actions 截图确认 CI #2 绿色通过，耗时 1 分 10 秒；第一阶段 `22ec58b` 也保持通过。CI 检查结果已确认，正式浏览器验收与临时预览清理另行跟进，不与 CI 混为一项。

## 2026-11-02 · 第二阶段收尾

- 范围限定为本机运行入口、临时服务清理、正式页面检查和文档；未进入第三阶段，未增加用户身份或图片上传功能。
- 新增 `frontend/scripts/next.mjs`：先关闭遥测，再加载安装版本的 Next.js CLI。`dev / typecheck / build / start` 均通过同一个入口，参数原样转发，不修改全局偏好。无新增依赖，已核对现有锁文件与依赖声明匹配，无需重新安装或修改锁文件。
- 实际运行 `npm run lint`、`npm run typecheck`、普通 `npm run build`，均通过。构建命令没有在 shell 中临时额外设置遥测环境变量，证明此修复已进入源码。
- 按用户本轮授权，通过临时 Python fixture 的精确路径定位其进程及子进程，仅停止本任务的预览进程。只读 HTTP 探测确认 3100 和 18080 均已关闭；正式 Docker 服务保持运行。
- 使用 `docker compose --progress plain up --build -d --wait frontend` 重建并启动，构建成功、三个容器全部 healthy；缓存后的前端依赖安装约 9 秒，Next.js 构建约 4 秒。
- 更新后再次验证正式 3000 入口：页面、详情页、Java 分类代理、本地 SVG 和 6 条模板均正常。Java 业务代码本轮未修改，沿用第二阶段 9 项集成测试通过结果，没有把前端入口修改描述为新增后端行为。
- 正式浏览器验收仍受环境权限限制：应用打开页面仅返回 queued，当前会话无可控标签；本机 Chrome 返回未获 Computer Use 授权。未尝试绕过授权，不将页面打开请求或 HTTP 检查记录为实际浏览器验收通过。
- 本轮开始工具时间为 16:13（Asia/Shanghai），含授权等待与浏览器工具阻塞，不将完整经过时长折算为用户人工编码时间。
- 上述收尾修改尚未提交，适合单独作为第二阶段修复提交；其 CI 需在提交并 push 后核对，`152bc97` 的通过结果不覆盖本轮新修改。
