# 第六阶段系统验收

日期：2026-11-03，Asia/Shanghai。被验业务代码基于 c448c47，文档基于 096e90e；本轮新增前端容器检查 target、Compose 检查入口、可复现的生命周期脚本和实际截图，未改动业务行为。本阶段提交为 038b379，用户截图确认 CI #8 通过（1 分 15 秒）；最终交付 commit 仍属于第七阶段。

## 环境隔离与结果

使用 `docker compose -p xiaoying-acceptance` 覆盖默认项目名，端口为前端 3101、Java 8181、MySQL 3308。实际日志确认创建了全新的 mysql-data / media-data 卷和 default 网络，首次执行全部初始化 SQL，三个服务健康。原 xiaoying-studio 的应用库、素材卷与任务不做清空或迁移。

前端 lint、21 个测试、TypeScript 和生产构建全部在 frontend-check 容器通过。Java 28 个集成测试及构建在 backend-check 与独立 mysql-check 通过；检查数据库不与应用共享。最终原演示三个服务健康；验收项目包含的应用与测试 MySQL 均已停止，保留验收卷，不执行 down -v。

## 实际检查记录

日常环境复查由用户确认以下四项均通过：

| 复查项 | 结论 |
| --- | --- |
| 正常任务不手动刷新即可完成并显示图片 | 通过 |
| 刷新页面后历史自动恢复 | 通过 |
| 小陈／小林切换后分别自动加载记录 | 通过 |
| 个人历史页与结果图片预览 | 通过 |

独立验收环境的详细记录如下：

| 项目 | 方法与实际观察 | 结论 |
| --- | --- | --- |
| 干净启动 | 独立空卷首次初始化；首页 6 模板，2 演示用户；Java / 前端 / MySQL 健康 | 通过 |
| 模板筛选 | 浏览器点击萌宠分类，只显示宠物肖像／萌宠日记两项 | 通过 |
| 上传与提交 | 键盘 Enter 激活使用示例图；观察上传中、已上传、开始制作；受理后按钮恢复并出现独立任务卡 | 通过 |
| 自动成功与结果 | 不点刷新，任务从等待处理进入最终成功，三个步骤完成，图片实际加载 | 通过；未捕捉每个阶段的浏览器截图，步骤执行边界另由 Java 测试证明 |
| 失败中断 | 选择 GENERATE 失败，前端显示检查完成、生成失败、整理未开始及中文原因，之前成功结果仍保留 | 通过 |
| 刷新恢复 | 新受理任务后刷新页面，身份和记录自动恢复，上传位清空符合已声明边界 | 通过 |
| 用户与历史 | 切小林自动显示空记录；切回小陈自动出现其任务；历史入口与退出状态正常 | 通过 |
| 双图数量 | 一张上传后提交禁用、两张上传后可用、移除一张再次禁用 | 通过 |
| 不存在模板 | 访问 missing-template，显示中文 404 说明、没有找到模板与返回入口 | 通过 |
| 小屏布局 | 375×812 视口的列表、详情、已加载 6 卡片历史：innerWidth 375、文档 scrollWidth 360，无横向溢出；实际截图可读 | 通过；15px 差为浏览器滚动条 |
| 桌面布局 | 1440×1000 视口，历史双卡并排、结果图加载、文档宽 1425，无横向溢出 | 通过 |
| 基本键盘 | Tab 移动到导航链接，计算样式为 solid 3px 焦点；Enter 导航、上传及提交可用 | 通过；未做完整读屏软件测试 |
| 查询异常／恢复 | 所有验收任务结束后暂时停验收 Java，浏览器点击刷新记录：黄色查询异常及恢复入口，原成功／失败卡不被改写；启动 Java 后恢复查询成功 | 通过；该浏览器案例针对历史请求异常 |
| 单任务查询异常 | 同一实际前端控制器通过真实同源 HTTP，受控抛出一次查询异常，原状态保留、其他任务继续；恢复后终态，终态后不再自动查询 | 脚本 PASS；没有伪称为浏览器 Network 阻断测试 |
| 终态／队列与重启 | 专项脚本创建成功、失败、执行中与排队任务；强制杀验收 Java，正常停止前端／MySQL，再启动三服务 | PASS，详见下节 |

初次浏览器绑定失效时重新绑定独立验收页后正常操作；早期 AX 将分类映射为 checkbox，按 DOM 核对后使用其真实 button 角色。均为工具定位问题，未改工作正常的网页来迎合工具。临时视口已恢复，浏览器演示会话已退出。

## 重启专项

`tools/smoke-lifecycle.mjs` 仅用于隔离验收环境，通过 STUDIO_ACCEPTANCE=1 显式启用。prepare 先创建两条终态记录，再创建一个每步 30000ms 的执行中任务和一个排队任务。脚本将仅供本地演示的会话与断言数据存到前端容器 `/tmp`、权限 0600，不提交仓库或输出 Cookie。

强制 SIGKILL Java 后，停止并启动三服务（保留容器和命名卷）。verify 的实际结果为 PASS：

- 会话仍有效，MySQL 历史保留。
- 原成功／失败任务完整响应不变，终态和步骤不回退。
- 原 RUNNING 标为 FAILED，并说明服务重启中断；不声称实现续跑。
- 原 QUEUED 继续执行成功。
- 原素材、原结果及排队任务结果均能读取，SHA-256 与输入字节一致。
- 校验后退出临时会话并删除临时状态文件。

此处证明的是进程强制中断和原容器 stop/start 的保留行为；没有声称测试了所有磁盘损坏、卷删除、集群或容器替换故障。配置确实将 MySQL 和素材挂载到命名卷，勿将 `/tmp` 校验状态文件当作业务存储。

## 重现命令

在仓库根目录执行。建议在浏览器用 `http://127.0.0.1:3101` 访问，避免与 localhost:3000 的 Cookie 作用域混用；不同端口不构成 Cookie 隔离。

```bash
FRONTEND_PORT=3101 BACKEND_PORT=8181 MYSQL_PORT=3308 docker compose -p xiaoying-acceptance up --build -d --wait
docker compose -p xiaoying-acceptance --profile checks run --build --rm frontend-check
docker compose -p xiaoying-acceptance --profile checks run --build --rm backend-check
```

运行实际查询控制器与接口验收（会保留两条非个人示例任务）：

```bash
docker compose -p xiaoying-acceptance cp frontend/src/lib/tasks.ts frontend:/tmp/xiaoying-tasks.ts
docker compose -p xiaoying-acceptance cp tools/smoke-task-feed.mjs frontend:/tmp/xiaoying-smoke-task-feed.mjs
docker compose -p xiaoying-acceptance exec -T -e TASK_MODULE_URL=file:///tmp/xiaoying-tasks.ts frontend node --experimental-default-type=module /tmp/xiaoying-smoke-task-feed.mjs
```

以下会强制停止验收 Java。**只对独立项目执行，不能换成日常项目名。** prepare 与 kill 之间不要人工长时间停留，不要重建／删除容器，以免前端容器的临时断言文件丢失：

```bash
docker compose -p xiaoying-acceptance cp tools/smoke-lifecycle.mjs frontend:/tmp/xiaoying-smoke-lifecycle.mjs
docker compose -p xiaoying-acceptance exec -T -e STUDIO_ACCEPTANCE=1 frontend node /tmp/xiaoying-smoke-lifecycle.mjs prepare && docker compose -p xiaoying-acceptance kill -s SIGKILL backend
docker compose -p xiaoying-acceptance stop frontend mysql
docker compose -p xiaoying-acceptance start --wait frontend backend mysql
docker compose -p xiaoying-acceptance exec -T -e STUDIO_ACCEPTANCE=1 frontend node /tmp/xiaoying-smoke-lifecycle.mjs verify
# 收尾，保留命名卷和验收记录
docker compose -p xiaoying-acceptance --profile checks stop
```

本轮保留了独立验收库中的示例记录。再次 up 不再属于首次空卷验收；需要重做空卷检查时选另一个新项目名和未占用端口，不删除日常演示卷。

## 实际截图

截图为本轮真实浏览器验收、原创示例图片和演示用户，不是设计稿或接口 fixture。视口包含滚动条，JPEG 实际宽度可比设定宽度少 15px。

- [桌面历史](acceptance/desktop-history.jpg)
- [小屏列表](acceptance/mobile-gallery.jpg)
- [小屏详情与结果](acceptance/mobile-detail.jpg)
- [查询异常、已有记录保留](acceptance/query-error.jpg)
- [恢复查询](acceptance/query-recovered.jpg)

## 仍保留的边界

- 检查过桌面和 375px 小屏，不代表所有尺寸、真实触屏设备、Safari／Firefox、读屏或高倍率缩放都已验证。
- 未做并发压力、集群、磁盘满／损坏和所有断网组合；单任务异常／迟到请求／超时等依靠实际控制器用例和 HTTP 脚本补充。
- 不新增题外功能；幂等提交、自动重试、执行中续跑、容量限制和孤立文件清理仍未实现，历史分页限制仍按 README。
- 实际人工投入用户确认未统计；最终材料、验收 commit 和完成／未完成清单在第七阶段核对。本轮 CI 已由用户截图确认 038b379 的 CI #8 通过，未借用旧提交结果。
