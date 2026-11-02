# 第三阶段：身份与图片上传验收

## 启动与升级

新环境直接 `docker compose up --build -d`，MySQL 按文件名执行全部初始化脚本。
从已有数据卷升级时，按 README 执行缺少的增量 SQL 后重建应用；身份与上传为 003 / 004，第四阶段任务为 005，无需删除已有数据卷。

## 页面演示

1. 打开 `http://localhost:3000`，右上角选择「小陈 · 演示账号」。
2. 进入「旅行明信片」，应有两个独立上传位，显示 JPEG / PNG、每张 5 MB 要求。
3. 两个位置分别点击「使用示例图」，会真实读取本地 PNG 并提交 Java 上传接口。也可选择自己的 JPEG / PNG。
4. 成功后显示「已上传」，图片通过服务端私有素材地址预览，数量变为 `2 / 2`。
5. 替换第一张图片、移除第二张，再上传；两个位置的状态和错误应独立。
6. 选择 GIF、空文件或超过 5 MB 的文件，前端应给出反馈；服务端独立验证大小和真实格式，不能靠改后缀绕过。
7. 上传中快速替换或移除，旧响应不能把原图片重新写回。若需要观察较慢请求，可在浏览器开发工具中使用网络限速。
8. 切换到「小林」，当前素材选择应立即清空，旧请求取消；新上传素材属于小林。已知小陈的素材地址，也不能以小林会话读取。
9. 刷新页面，服务端应恢复当前用户；当前上传槽位不恢复，但素材文件和元数据仍存于后端。
10. 点击退出，素材区域应提示先选择用户；旧会话不能继续读取私人素材。

第四阶段已接通制作提交和手动任务查询，见 [异步任务验收](async-tasks.md)。自动跟踪与刷新自动恢复留在第五阶段。本页保留身份／上传的专项步骤与第三阶段验证记录。

## API 演示

请求经 Next.js 同源代理转发，全部业务执行、会话与持久化都在 Java。
Cookie jar 放在 `/tmp`，不要提交到仓库；这些是本地演示会话，不需要任何真实账号密码。

```bash
# 获取公开演示账号
curl http://localhost:3000/api/auth/demo-users

# 创建小陈会话，令牌仅通过 Set-Cookie 返回
curl -c /tmp/studio-chen.cookies -H 'X-Studio-Request: 1' \
  -H 'Content-Type: application/json' -d '{"userId":"demo-chen"}' \
  http://localhost:3000/api/auth/session

# 使用相同会话读取身份；浏览器刷新也通过此接口恢复
curl -b /tmp/studio-chen.cookies http://localhost:3000/api/auth/me

# 上传项目自带的真实 PNG
curl -b /tmp/studio-chen.cookies -H 'X-Studio-Request: 1' \
  -F 'templateId=travel-postcard' \
  -F 'file=@backend/src/main/resources/static/demo/sample-1.png;type=image/png' \
  http://localhost:3000/api/assets

# 当前用户的最近素材；其他用户的素材不会出现在这里
curl -b /tmp/studio-chen.cookies http://localhost:3000/api/assets

# 退出并清除会话
curl -X DELETE -b /tmp/studio-chen.cookies -c /tmp/studio-chen.cookies \
  -H 'X-Studio-Request: 1' http://localhost:3000/api/auth/session
```

上传响应字段示例：

```json
{
  "id": "服务端生成的 UUID",
  "ownerId": "demo-chen",
  "templateId": "travel-postcard",
  "originalName": "sample-1.png",
  "mimeType": "image/png",
  "sizeBytes": 12345,
  "width": 480,
  "height": 360,
  "url": "/api/assets/服务端生成的UUID/content",
  "createdAt": "2026-11-02T09:00:00Z"
}
```

`sizeBytes`、时间和 ID 由服务端实际生成，不是固定示例值。客户端不传 ownerId，也不能通过 userId 覆盖会话身份。

## 状态与错误

- 身份：确认中、已选择、切换中、确认失败。切换失败后需重新确认，不猜测 Cookie 是否已更新。
- 每个素材位：空、上传中、成功、失败。替换或移除会取消旧请求；请求 ID 不匹配的响应不会写入当前槽位。
- 浏览器 Blob 地址只用于本地上传中预览；成功状态使用服务端返回的 URL。
- 401：没有有效会话；403：缺少同源请求头；404：模板或所属素材不存在；413：文件超限；415：类型不支持；400：空文件、伪造／损坏图片或像素数超限。
- 本次表单移除不删除物理文件，不影响后续可能引用它的任务。当前未实现素材清理、分页界面或素材管理后台。

## 验证范围

- Java 18 个集成测试（模板 7、基础 2、身份与素材 9），使用真实 MySQL。上传测试检查 PNG / JPEG、Unicode 文件名、UUID 保存名、MIME 与内容不一致、空文件、5 MB 超限、2000 万像素限制，以及私有文件和元数据的归属隔离。
- 前端 6 个原生 Node 状态模型测试，覆盖多槽位并发、旧响应、移除、服务端预览地址、独立表单和校验边界。它们不是浏览器端到端测试，也不冒充任务状态测试。
- 从正式 3000 端口的真实 HTTP 联调已验证两张示例 PNG 的上传、读取字节一致、中文文件名、服务端归属、跨用户 404 和切换后旧会话失效。联调保留了小陈的两条非个人示例素材，测试会话已退出。
- 用户已简单手工试用切换用户、上传、替换和移除，反馈基础操作正常；截图确认提交 `9c0e469` 的 CI #3 通过，耗时 1 分 7 秒。此反馈不是全量浏览器验收，刷新、慢网／失败恢复、快速切换和小屏等仍需按上述步骤系统检查。自动化工具的浏览器授权限制仍存在，不将 HTTP 或模型测试冒充浏览器验收。
