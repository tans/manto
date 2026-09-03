import { db } from "./db";
import { scoreFor } from "./accounts";
import { chooseSponsored } from "./promotions";
function toFtsQuery(raw: unknown): string {
  const cleaned = String(raw || "").trim().replace(/"/g, '""');
  if (!cleaned) throw new Error("query_required");
  return `"${cleaned}"`;
}
export function search(input: any) {
  const query = toFtsQuery(input.query);
  const limit = Math.min(50, Math.max(1, Number(input.limit || 10))); const since = input.since ? new Date(input.since).toISOString() : null;
  const rows = db.query(`SELECT c.*, a.valid_post_count, a.founding_post_number, bm25(contents_fts,4.0,1.0) AS relevance FROM contents_fts JOIN contents c ON c.id=contents_fts.content_id JOIN accounts a ON a.id=c.account_id WHERE contents_fts MATCH ?1 AND c.status='published' AND (c.expires_at IS NULL OR c.expires_at > ?2) AND (?3 IS NULL OR c.published_at >= ?3) ORDER BY relevance LIMIT ?4`).all(query, new Date().toISOString(), since, limit * 3) as any[];
  const sponsored = chooseSponsored(query, rows);
  const seen = new Set<string>(); const counts = new Map<string,number>();
  const results = rows.filter(r => !sponsored || r.id !== sponsored.content_id).filter(r => { const n = counts.get(r.account_id) || 0; if(n>=3) return false; counts.set(r.account_id,n+1); return true; }).slice(0,limit).map(r => { const relevance = 1 / (1 + Math.max(0, -Number(r.relevance))); return ({ content_id:r.id,title:r.title,excerpt:input.include_content ? r.content : r.content.slice(0,240),url:r.url,score:Number((relevance * (0.75 + 0.20 * scoreFor(r) + 0.05)).toFixed(4)),published_at:r.published_at,publisher_score:scoreFor(r),...(input.include_content?{content:r.content}:{}) }); });
  return { sponsored: sponsored ? { content_id:sponsored.content_id,title:sponsored.title,url:sponsored.url,placement:"sponsored" } : null, results };
}
