# 第二阶段：模板浏览与验收

## 范围

模板分类、列表、详情、封面和素材要求由 Java / MySQL 提供。前端不保存一份硬编码模板列表。此阶段不包含上传、身份、任务执行和真实历史记录。

## 启动与操作

在项目根目录执行 `docker compose up --build -d`。Docker Desktop 中出现独立 `xiaoying-studio` 项目，日常运行含 frontend、backend、mysql 三个容器。

1. 打开 `http://localhost:3000`，应展示 6 张模板卡片及本地封面。
2. 点击「创意图片」「萌宠时刻」「生活记录」，分别应展示 2 个模板；点击「全部模板」恢复 6 个。
3. 点击「旅行明信片」，进入 `/templates/travel-postcard`，应显示 2 张素材、JPEG / PNG、每张不超过 5 MB。
4. 返回列表，进入「宠物肖像」，应显示 1 张素材要求。
5. 直接打开 `/templates/missing`，应显示模板不存在及返回列表链接，不应一直显示加载中。
6. 缩小到手机宽度，分类可换行、列表为两列、详情上下排列，键盘可访问分类和卡片。
7. 暂停 backend 后刷新页面，列表应显示请求失败和重试按钮；恢复服务后点击重试，应重新读取数据。
8. 快速切换分类，应始终显示最后选中的分类，旧请求不能覆盖当前结果。

其中依赖真实后端运行的步骤只有完成运行验证后才记为通过；不把静态构建当作浏览器或数据库联调结果。

## API 示例

```bash
curl http://localhost:8080/api/templates/categories
curl http://localhost:8080/api/templates
curl --get --data-urlencode 'category=萌宠时刻' http://localhost:8080/api/templates
curl http://localhost:8080/api/templates/travel-postcard
curl -i http://localhost:8080/api/templates/missing
```

分类响应：

```json
["创意图片", "萌宠时刻", "生活记录"]
```

详情响应：

```json
{
  "id": "travel-postcard",
  "title": "旅行明信片",
  "category": "创意图片",
  "description": "用两张旅途照片，留下属于你的旅行记忆。",
  "coverUrl": "/demo/travel-postcard.svg",
  "requiredImageCount": 2,
  "acceptedMimeTypes": ["image/jpeg", "image/png"],
  "maxFileSizeBytes": 5242880
}
```

空白分类表示全部；未知分类返回 `200 []`；超过 64 个字符的分类返回 400。参数通过 MyBatis 绑定，不拼接 SQL。模板不存在返回 404，数据库不可用返回 503，响应 `detail` 提供中文说明。

## 自动检查

- 前端：`npm run lint`、`npm run typecheck`、`npm run build`。
- Java：`docker compose --profile checks run --build --rm backend-check`。
- `TemplateApiIntegrationTest` 通过实际 HTTP 和真实 MySQL 验证分类、列表、筛选、参数绑定、详情要求、错误状态以及全部种子封面的本地可访问性。
- GitHub CI 的 Java job 会初始化同一套 SQL 并执行全部测试，前端 job 会使用锁文件安装并检查。

## 素材来源

6 张 SVG 是本项目原创的代码绘制插画（旅行、宠物、城市、双人纪念、日常主题），无远程资源、嵌入脚本和外部字体。无需付费或公司内部资源。它们是展示封面，不能作为 JPEG / PNG 上传校验的替代品。
