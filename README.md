# MailOne

MailOne 是一个基于 Cloudflare Email Worker + D1 的临时邮箱 API：

- Catch-all 收件
- `/?to=<email>` 直接返回该收件箱最近一封邮件
- 同一收件箱只保留最新一封
- 邮件仅保留 24 小时

## API

```bash
GET https://<your-worker>.workers.dev/?to=test@your-domain.com
```

返回：

```json
{
  "id": "...",
  "recipient": "test@your-domain.com",
  "sender": "sender@example.com",
  "nexthop": "your-domain.com",
  "subject": "Hello",
  "content": "raw email content",
  "received_at": 1760000000000
}
```

若无邮件或已过期（>24h），返回 `null`。

## Deploy

1. 创建 D1 数据库并把 `database_id` 写入 `wrangler.toml`
2. 执行建表：
   ```bash
   wrangler d1 execute mailone --file=./schema.sql
   ```
3. 部署：
   ```bash
   wrangler deploy
   ```
4. Cloudflare Email Routing 设置 catch-all -> 该 Worker

## Notes

- 已移除 API key 鉴权（按需求）
- 清理策略：
  - 读取时超过 24h 直接视为无数据
  - 每小时 cron 清理数据库中的过期记录
