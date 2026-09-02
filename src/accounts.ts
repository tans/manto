import { db, now, transaction } from "./db";
import { hash, newToken } from "./auth";
import { randomUUID } from "node:crypto";

function scoreFor(account: any) {
  const n = Number(account.valid_post_count || 0);
  const founding = Number(account.founding_post_number || 1);
  const multiplier = founding <= 100 ? 2 : founding <= 1000 ? 1.5 : founding <= 10000 ? 1.2 : 1;
  const raw = multiplier * Math.log2(n + 2);
  return raw / (raw + 10);
}
export function quotaFor(account: any) { return Math.min(30, 3 + Math.floor(Math.log2(Number(account.valid_post_count || 0) + 1)) * 2); }
export function accountView(account: any) {
  const balance = (db.query("SELECT COALESCE(SUM(amount_cents),0) AS cents FROM balance_ledger WHERE account_id = ?1").get(account.id) as any).cents;
  return { account_id: account.id, email: account.email, account_score: scoreFor(account), valid_post_count: account.valid_post_count, quota_limit: quotaFor(account), balance_cents: balance, recent_content: db.query("SELECT id AS content_id,title,url,status,published_at FROM contents WHERE account_id=?1 ORDER BY published_at DESC LIMIT 10").all(account.id) };
}
export function createAccount(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error("invalid_email");
  const existing = db.query("SELECT id FROM accounts WHERE email=?1").get(normalized);
  if (existing) {
    const token = newToken("recover_");
    db.query("INSERT INTO email_tokens(id,account_id,token_hash,kind,expires_at) VALUES(?1,?2,?3,'recovery',?4)").run(randomUUID(), (existing as any).id, hash(token), new Date(Date.now() + 24 * 3600 * 1000).toISOString());
    return { existing: true, email_verification_sent: Boolean(Bun.env.SMTP_URL) };
  }
  const id = randomUUID(); const apiKey = newToken("manto_"); const createdAt = now();
  const verifyToken = newToken("verify_");
  transaction(() => {
    db.query("INSERT INTO accounts(id,email,api_key_hash,created_at) VALUES(?1,?2,?3,?4)").run(id, normalized, hash(apiKey), createdAt);
    db.query("INSERT INTO email_tokens(id,account_id,token_hash,kind,expires_at) VALUES(?1,?2,?3,'verify',?4)").run(randomUUID(), id, hash(verifyToken), new Date(Date.now() + 24 * 3600 * 1000).toISOString());
  });
  return { account_id: id, api_key: apiKey, email: normalized, email_verification_sent: Boolean(Bun.env.SMTP_URL), mcp_url: Bun.env.PUBLIC_MCP_URL || "/mcp" };
}
export { scoreFor };
