import { randomUUID } from "node:crypto";
import { db, now, transaction } from "./db";

const MAX_LENGTH = 2000;
const DAILY_LIMIT = 20;

function activeContent(contentId: string) {
  return db.query("SELECT id FROM contents WHERE id=?1 AND status='published' AND (expires_at IS NULL OR expires_at > ?2)").get(contentId, now());
}

export function listComments(contentId: string) {
  if (!activeContent(contentId)) throw new Error("content_not_found");
  return db.query("SELECT id,body,created_at FROM comments WHERE content_id=?1 ORDER BY created_at ASC LIMIT 200").all(contentId) as any[];
}

export function createComment(account: any, contentId: string, input: any) {
  const body = String(input?.body || "").trim();
  if (!body) throw new Error("comment_body_required");
  if (body.length > MAX_LENGTH) throw new Error("comment_too_long");
  if (!activeContent(contentId)) throw new Error("content_not_found");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = db.query("SELECT COUNT(*) AS count FROM comments WHERE account_id=?1 AND created_at>?2").get(account.id, since) as any;
  if (Number(recent?.count || 0) >= DAILY_LIMIT) throw new Error("comment_daily_limit_exceeded");
  const comment = { id: randomUUID(), body, created_at: now() };
  transaction(() => {
    db.query("INSERT INTO comments(id,content_id,account_id,body,created_at) VALUES(?1,?2,?3,?4,?5)").run(comment.id, contentId, account.id, comment.body, comment.created_at);
  });
  return comment;
}
