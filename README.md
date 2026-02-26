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

## 部署步骤

1. 创建 D1 数据库
2. 在 `wrangler.toml` 填入真实 `database_id`
3. 执行建表

```bash
wrangler d1 execute mailone --file=./schema.sql
```

4. 部署 Worker

```bash
wrangler deploy
```

5. Cloudflare Dashboard → Email Routing
   - 开启 Email Routing
   - 将域名的 Catch-all 路由到本 Worker

---

## 数据策略

- 每封新邮件到达时，对同一 `recipient` 执行 UPSERT（覆盖）
- 定时任务每小时执行一次，清理超过 24 小时的数据
- API 读取时也会做 24 小时有效期判断

---

## 注意事项

- 本项目默认**不启用 API Key 鉴权**（按需求）
- `content` 为原始邮件内容（raw），如需只返回正文可在后续版本增加解析逻辑
