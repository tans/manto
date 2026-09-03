import { createHash, randomUUID } from "node:crypto";
import { db, now, today, transaction } from "./db";
import { quotaFor, scoreFor } from "./accounts";

const digest = (title: string, content: string, url?: string) => createHash("sha256").update(JSON.stringify([title,content,url || ""])).digest("hex");
export function publish(account: any, input: any) {
  const title = String(input.title || "").trim(), content = String(input.content || "").trim();
  if (!title || !content) throw new Error("title_and_content_required");
  const externalId = input.external_id ? String(input.external_id).trim() : null;
  const hashValue = digest(title, content, input.url);
  const existing = externalId ? db.query("SELECT * FROM contents WHERE account_id=?1 AND external_id=?2").get(account.id, externalId) as any : null;
  const usageDate = today();
  return transaction(() => {
    if (existing && existing.content_hash === hashValue && existing.status === "published") return result(existing, "unchanged", account);
    const usage = db.query("SELECT post_count FROM daily_usage WHERE account_id=?1 AND usage_date=?2").get(account.id, usageDate) as any;
    if ((usage?.post_count || 0) >= quotaFor(account)) throw new Error("daily_quota_exceeded");
    const at = now(); const id = existing?.id || randomUUID();
    if (existing) db.query("UPDATE contents SET title=?1,content=?2,url=?3,content_hash=?4,status='published',expires_at=?5,updated_at=?6 WHERE id=?7").run(title,content,input.url || null,hashValue,input.expires_at || null,at,id);
    else db.query("INSERT INTO contents(id,account_id,external_id,title,content,url,content_hash,status,expires_at,published_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,'published',?8,?9,?9)").run(id,account.id,externalId,title,content,input.url || null,hashValue,input.expires_at || null,at);
    db.query("INSERT INTO daily_usage(account_id,usage_date,post_count) VALUES(?1,?2,1) ON CONFLICT(account_id,usage_date) DO UPDATE SET post_count=post_count+1").run(account.id,usageDate);
    db.query("DELETE FROM contents_fts WHERE content_id=?1").run(id);
    db.query("INSERT INTO contents_fts(content_id,title,content) VALUES(?1,?2,?3)").run(id,title,content);
    if (!account.founding_post_number) db.query("UPDATE accounts SET founding_post_number=(SELECT COALESCE(MAX(founding_post_number),0)+1 FROM accounts),valid_post_count=valid_post_count+1 WHERE id=?1").run(account.id);
    else db.query("UPDATE accounts SET valid_post_count=valid_post_count+1 WHERE id=?1").run(account.id);
    const updated = db.query("SELECT * FROM contents WHERE id=?1").get(id) as any;
    return result(updated, existing ? "updated" : "created", { ...account, valid_post_count: account.valid_post_count + 1, founding_post_number: account.founding_post_number || 1 });
  });
}
function result(row: any, operation: string, account: any) { const used = (db.query("SELECT post_count FROM daily_usage WHERE account_id=?1 AND usage_date=?2").get(account.id,today()) as any)?.post_count || 0; return { content_id: row.id, operation, quota: { used, limit: quotaFor(account) }, account_score: scoreFor(account) }; }
export function removeContent(account: any, id: string) { const r = db.query("UPDATE contents SET status='removed',updated_at=?1 WHERE id=?2 AND account_id=?3").run(now(),id,account.id); if (!r.changes) throw new Error("content_not_found"); return { content_id:id, status:"removed" }; }
export function listPublicContent(accountId: string, limit = 20, includeContent = false) {
  const account = db.query("SELECT id FROM accounts WHERE id=?1").get(accountId);
  if (!account) throw new Error("account_not_found");
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
  const rows = db.query("SELECT id AS content_id,title,content,url,published_at,updated_at,expires_at FROM contents WHERE account_id=?1 AND status='published' AND (expires_at IS NULL OR expires_at > ?2) ORDER BY published_at DESC LIMIT ?3").all(accountId, now(), safeLimit) as any[];
  return rows.map(row => includeContent ? row : (({ content, ...summary }) => summary)(row));
}

export function recentContent(limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
  const rows = db.query("SELECT c.id AS content_id, c.title, c.content, c.url, c.published_at, a.id AS account_id, a.email FROM contents c JOIN accounts a ON a.id=c.account_id WHERE c.status='published' AND (c.expires_at IS NULL OR c.expires_at > ?1) ORDER BY c.published_at DESC LIMIT ?2").all(now(), safeLimit) as any[];
  return rows.map(r => ({ content_id:r.content_id, title:r.title, excerpt:r.content.slice(0,240), url:r.url, published_at:r.published_at, account_id:r.account_id, email:r.email }));
}

export function getContent(id: string) {
  const row = db.query("SELECT c.id AS content_id, c.title, c.content, c.url, c.published_at, a.id AS account_id, a.email FROM contents c JOIN accounts a ON a.id=c.account_id WHERE c.id=?1 AND c.status='published' AND (c.expires_at IS NULL OR c.expires_at > ?2)").get(id, now()) as any;
  if (!row) throw new Error("content_not_found");
  return row;
}
