# 交付说明

## 材料与入口

项目：拾影 · 素材工作室，小影科技 2027 校招全栈笔试项目。

源码仓库：[Fei-Luomeng/xiaoying-studio](https://github.com/Fei-Luomeng/xiaoying-studio)。可选提交源码压缩包；题目不要求同时提交两种形式。

```bash
# 仓库根目录启动，包含前端、Java、MySQL 与首次初始化数据
docker compose up --build -d --wait
# 容器隔离检查
docker compose --profile checks run --build --rm frontend-check
docker compose --profile checks run --build --rm backend-check
docker compose --profile checks stop mysql-check
```

入口为 http://localhost:3000，选择预置用户后可上传项目内示例并制作。详细配置、接口、模拟成功／失败、耗时、多任务、身份与历史恢复均见 README 与专项验收文档。

## 材料清单

| 内容 | 位置 |
| --- | --- |
| 完整前后端代码、依赖与锁文件 | frontend/、backend/，package-lock.json、pom.xml |
| 数据库结构与初始化数据 | database/init/001–005 SQL |
| 可访问的本地素材 | backend/src/main/resources/static/demo/，6 SVG、2 PNG |
| Compose、Dockerfile、无真实凭据配置 | compose.yaml、两端 Dockerfile、.env.example |
| CI | .github/workflows/ci.yml，push / pull_request 检查 |
| 架构、接口／演示、要求对照、投入／取舍、AI 和来源 | README、docs/ |
| 实际系统验收与截图 | docs/system-acceptance.md、docs/acceptance/ |
| 可复现 HTTP／生命周期检查与源码导出 | tools/ |

生成的源码包不包含 .git、node_modules、构建缓存、运行中的 MySQL／素材卷、本机 .env、Cookie、备份或真实凭据。独立环境里的演示任务不作为数据库种子发货，接收方从空历史开始演示。

## 完成程度与取舍

R-01～R-12 的业务／工程实现与 R-14 容器支持已提供，具体证据见 requirements.md；R-13 的文档、AI 工作流和来源已提供，实际投入按开发者确认的聊天及工作窗口口径粗估约 11 小时，详见 README。

验证证据：21 项前端、28 项 Java 测试，lint、类型和构建通过；独立空卷启动、实际桌面／375px 小屏与基本键盘操作、查询异常恢复、强制中断和 stop/start 持久化均通过。最近一次已由截图确认的流水线为第六阶段 038b379 的 CI #8。交付整理这笔提交的 CI 以实际推送结果为准。

已知限制：

- 两个可自由选择的演示用户，非生产账号系统。
- 模拟生成结果是首张输入图片副本；不接真实 AI，不合成多图。
- 单 Java 实例、数据库队列、串行执行；执行中任务重启标失败，排队任务可继续，无执行中续跑。
- 无幂等提交、自动任务重试、队列容量／速率限制、孤立文件清理和集群支持。
- 最近 100 条加全部未完成历史，无更早终态分页；其他标签页的新任务需刷新发现。
- 查询错误暂停对应查询并保留状态，提供恢复入口，无无限自动重试。
- 未覆盖全浏览器／真机、读屏、压力、磁盘损坏及所有网络组合；不声称生产环境就绪。

实际投入：截至 2026-11-03 中午，按两天聊天及工作记录粗估约 11 小时，包含需求、开发、验证、交付与复核，也包含下载／构建等待和间歇，不包含跨日休息。不是精确的人工操作或纯编码净工时；估算依据和分阶段记录见 README。

## 打包与版本标识

仅需 Python 3 标准库和 Git，在项目根目录执行源码导出（不安装依赖或运行应用）：

```bash
python3 tools/package-source.py
```

产物为 release/xiaoying-studio-source.zip 及其 .sha256 文件，release 被 Git 忽略。解压后顶层目录为 xiaoying-studio，内有完整源码和 SOURCE_INFO.json。后者记录 Git HEAD、工作区是否干净，以及每个源码文件的 SHA-256；导出时逐文件校验并检查 ZIP CRC。

当前未提交的导出标为 working-tree，不能把其 git_head 冒充最终验收 commit。最后提交后应重新打包，干净工作区的导出标为 commit；SOURCE_INFO.json 的完整 git_head 即该源码包对应的提交。源码包按题目无需另附验收 commit，但保留此信息便于复核。

仓库交付时，在回复招聘方的材料中注明实际完整 SHA，而不在同一份源码中硬编码它自己的提交 hash：

```bash
git status --short
git rev-parse HEAD
```

若工作区仍有源码／文档改动，先提交再记录 SHA，不以第六阶段提交代替尚未提交的最终材料。提交后确认 CI 通过；再次修改源码／文档后需重新确定 SHA 和打包。

## 部署与回滚

1. 首次或更新时，在固定目录配置端口、数据库和代理，运行 compose up --build -d --wait，检查三个服务健康。
2. 更新前记录上一个已验证的完整 SHA，备份数据库和素材。可在根目录执行以下示例；backups 已忽略，不纳入源码包：

```bash
mkdir -p backups
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --no-tablespaces --single-transaction --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' > backups/database.sql
docker compose cp backend:/app/storage backups/storage
```

3. 回滚时在单独目录检出上一个已验证 SHA，使用原项目名与配置重建，保留原命名卷，不执行 down -v。现有卷不会自动重复初始化 SQL，涉及数据库结构变化时先评估兼容性。
4. 本项目没有自动迁移／降级脚本；需恢复备份时应单独安排维护并验证恢复结果。本轮没有对用户数据库执行备份还原或生产回滚。

## 提交前确认

- 本轮材料提交、CI 结果与完整验收 SHA 由最终执行结果确定。
- 投入已按开发者确认的口径记录粗估值及统计边界，后续持续工作时据实更新。
- 选择仓库或最终源码包，确认仓库对招聘方可读取，并附启动／检查入口；不提供本机数据卷或真实账号凭据。
- 源码包可独立解压构建；详细导出核对结果在开发记录中保存。
- 由开发者通过收到题目的沟通渠道交付；当前未向招聘方发送或提交任何材料。

## 沟通渠道回复示例

将完整 SHA 替换为实际输出后使用；仓库可读取时，提交链接即可，不强制附压缩包：

> 您好，现提交全栈笔试项目「拾影 · 素材工作室」。
>
> 源码仓库：https://github.com/Fei-Luomeng/xiaoying-studio
>
> 验收 commit：〈git rev-parse HEAD 的完整输出〉
>
> 启动：docker compose up --build -d --wait，页面为 http://localhost:3000。
>
> README 包含技术、接口、模拟演示、身份与历史方案、投入统计边界、已知限制、AI 工作流及素材来源。构建／测试及系统验收记录随源码提供。
>
> 如需源码包，可提供对应提交导出的 zip 与 SHA-256 校验文件。
