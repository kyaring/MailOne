CREATE TABLE IF NOT EXISTS latest_emails (
  recipient TEXT PRIMARY KEY,
  id TEXT,
  sender TEXT,
  nexthop TEXT,
  subject TEXT,
  content TEXT,
  received_at INTEGER NOT NULL
);
