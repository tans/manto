import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = resolve(Bun.env.MANTO_DB_PATH || "./data/manto.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new Database(dbPath, { create: true });
db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const value = fn(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}

export function now() { return new Date().toISOString(); }
export function today() { return new Date().toISOString().slice(0, 10); }
