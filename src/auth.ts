import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = (prefix: string) => `${prefix}${randomBytes(24).toString("base64url")}`;

export function accountFromApiKey(apiKey?: string) {
  if (!apiKey) return null;
  return db.query("SELECT * FROM accounts WHERE api_key_hash = ?1").get(hash(apiKey)) as any;
}
export function requestId() { return randomUUID(); }
