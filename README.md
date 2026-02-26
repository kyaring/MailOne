# MailOne

MailOne 是一个基于 **Cloudflare Email Worker + D1** 的极简临时邮箱 API。

核心规则：
- 域名启用 Catch-all，任意收件地址都可接收
- API 仅返回目标邮箱**最近一封**邮件
- 同一邮箱只保留 1 条记录（新邮件覆盖旧邮件）
- 邮件保留 24 小时（超时视为无邮件）

---

## API

```http
GET /?to=test@your-domain.com
```

示例：
```bash
curl "https://xxx.zimk.workers.dev/?to=test@your-domain.com"
```

返回示例：

```json
{
  "id": "<message-id-or-uuid>",
  "recipient": "test@your-domain.com",
  "sender": "sender@example.com",
  "nexthop": "your-domain.com",
  "subject": "Hello",
  "content": "<raw email content>",
  "received_at": 1760000000000
}
```

无邮件或邮件已过期时返回：

```json
null
```

---

## 项目结构

```text
MailOne/
├─ src/index.js      # Worker 逻辑（fetch + email + scheduled）
├─ schema.sql        # D1 表结构
└─ wrangler.toml     # Worker + D1 + cron 配置
```

---

## 部署步骤（推荐：GitHub Actions 自动部署）

仓库已内置工作流：`.github/workflows/deploy.yml`。

### 1）准备 GitHub Secrets / Variables

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

- `CLOUDFLARE_API_TOKEN`（需包含 Workers + D1 读写权限）
- `CLOUDFLARE_ACCOUNT_ID`

可选变量：

- `AUTO_DEPLOY=true`（默认即为 true；设为 false 可关闭 push 自动部署）

### 2）首次部署（init）

在 GitHub Actions 页面手动运行 `Deploy MailOne [Cloudflare Worker + D1]`，参数：

- `deploy_action = init`
- `apply_schema = true`（或 `auto`）

init 会自动执行：

1. 检查/创建 D1 数据库 `mailone`
2. 自动写入 `wrangler.toml` 中的 `database_id`
3. 执行 `schema.sql`
4. 部署 Worker

### 3）后续更新（update）

- 直接 push 到 `main/master`（修改 `src/**`、`schema.sql` 或 `wrangler.toml`）即可自动部署
- 也可手动触发，`deploy_action = update`

`apply_schema=auto` 时，仅在 `schema.sql` 变更时执行建表 SQL。

### 4）Cloudflare 邮件路由配置（必须）

Cloudflare Dashboard → Email Routing：

- 开启 Email Routing
- 将域名 Catch-all 路由到本 Worker（`mailone`）

完成后即可通过 API 查询邮箱最新邮件。

---

## 手动部署（备用）

```bash
# 1) 创建 D1（首次）
wrangler d1 create mailone

# 2) 执行建表
wrangler d1 execute mailone --remote --file=./schema.sql

# 3) 部署 Worker
wrangler deploy
```

---

## 数据策略

- 每封新邮件到达时，对同一 `recipient` 执行 UPSERT（覆盖）
- 定时任务每小时执行一次，清理超过 24 小时的数据
- API 读取时也会做 24 小时有效期判断

---

## 注意事项

- 本项目默认**不启用 API Key 鉴权**（按需求）
- `content` 为原始邮件内容（raw），如需只返回正文可在后续版本增加解析逻辑
