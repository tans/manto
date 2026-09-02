import { describe, expect, test } from "bun:test";
import { app } from "../src/index";

describe("Manto HTTP API", () => {
  test("health and passwordless account flow", async () => {
    const health = await app.request("http://manto.local/api/health");
    expect(health.status).toBe(200);
    const account = await app.request("http://manto.local/v1/accounts", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:`test-${Date.now()}@example.com`})});
    expect(account.status).toBe(200);
    const data: any = await account.json(); expect(data.api_key).toStartWith("manto_");
    const publish = await app.request("http://manto.local/v1/content", {method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${data.api_key}`},body:JSON.stringify({external_id:"smoke-1",title:"AI Agent 新闻",content:"Manto smoke content"})});
    expect(publish.status).toBe(200);
    const search = await app.request("http://manto.local/v1/search?query=Agent"); expect(search.status).toBe(200); expect(((await search.json()) as any).results.length).toBeGreaterThan(0);
  });
});
