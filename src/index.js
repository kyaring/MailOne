function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

async function streamToString(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
}

function getHeader(headers, name) {
  try {
    return headers.get(name) || "";
  } catch {
    return "";
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    }

    const to = (url.searchParams.get("to") || "").trim().toLowerCase();
    if (!to) return json({ error: "missing query param: to" }, 400);

    const row = await env.DB.prepare(
      `SELECT recipient, id, sender, nexthop, subject, content, received_at
       FROM latest_emails
       WHERE recipient = ?
       LIMIT 1`
    ).bind(to).first();

    if (!row) return json(null);

    if (Date.now() - row.received_at > ONE_DAY_MS) {
      return json(null);
    }

    return json({
      id: row.id,
      recipient: row.recipient,
      sender: row.sender,
      nexthop: row.nexthop,
      subject: row.subject,
      content: row.content,
      received_at: row.received_at
    });
  },

  async email(message, env) {
    const recipient = (message.to || "").toLowerCase();
    const sender = message.from || "";
    const subject = getHeader(message.headers, "subject");
    const id = getHeader(message.headers, "message-id") || crypto.randomUUID();
    const nexthop = recipient.includes("@") ? recipient.split("@")[1] : "";
    const content = await streamToString(message.raw);
    const received_at = Date.now();

    await env.DB.prepare(
      `INSERT INTO latest_emails
       (recipient, id, sender, nexthop, subject, content, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(recipient) DO UPDATE SET
         id = excluded.id,
         sender = excluded.sender,
         nexthop = excluded.nexthop,
         subject = excluded.subject,
         content = excluded.content,
         received_at = excluded.received_at`
    ).bind(recipient, id, sender, nexthop, subject, content, received_at).run();
  },

  async scheduled(_event, env) {
    const cutoff = Date.now() - ONE_DAY_MS;
    await env.DB.prepare(`DELETE FROM latest_emails WHERE received_at < ?`).bind(cutoff).run();
  }
};
