import { describe, expect, test } from "bun:test";
import { app } from "../src/index";

describe("Manto HTTP API", () => {
  test("health and passwordless account flow", async () => {
    const health = await app.request("http://manto.local/api/health");
    expect(health.status).toBe(200);
    const account = await app.request("http://manto.local/v1/accounts", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:`test-${Date.now()}@example.com`})});
    expect(account.status).toBe(200);
    const data: any = await account.json(); expect(data.api_key).toStartWith("manto_");
    const lookup = await app.request(`http://manto.local/v1/accounts/by-email?email=${encodeURIComponent(data.email)}`);
    expect(lookup.status).toBe(200);
    expect(((await lookup.json()) as any).account_id).toBe(data.account_id);
    const publish = await app.request("http://manto.local/v1/content", {method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${data.api_key}`},body:JSON.stringify({external_id:"smoke-1",title:"AI Agent 新闻",content:"Manto smoke content"})});
    expect(publish.status).toBe(200);
    const articles = await app.request(`http://manto.local/v1/accounts/${data.account_id}/articles`);
    expect(articles.status).toBe(200);
    expect(((await articles.json()) as any)[0].title).toBe("AI Agent 新闻");
    const search = await app.request("http://manto.local/v1/search?query=Agent"); expect(search.status).toBe(200); expect(((await search.json()) as any).results.length).toBeGreaterThan(0);
  });

  test("search tolerates FTS5 syntax characters without 500", async () => {
    const malicious = 'Agent" OR "';
    const res = await app.request(`http://manto.local/v1/search?query=${encodeURIComponent(malicious)}`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
  });

  test("crawler and agent discovery", async () => {
    const robots = await app.request("http://manto.local/robots.txt");
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await app.request("http://manto.local/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("content-type")).toContain("application/xml");
    expect(await sitemap.text()).toContain("<urlset");

    const llms = await app.request("http://manto.local/llms.txt");
    expect(llms.status).toBe(200);
    expect(await llms.text()).toContain("Remote MCP server");
  });

  test("feed returns recent articles and homepage exposes lookup UI", async () => {
    const feed = await app.request("http://manto.local/v1/feed?limit=5");
    expect(feed.status).toBe(200);
    expect(Array.isArray(await feed.json())).toBe(true);

    const home = await app.request("http://manto.local/");
    const html = await home.text();
    expect(html).toContain('id="feed-list"');
    expect(html).toContain('id="lookup-form"');
    expect(html).toContain("信息流");
    expect(html).toContain("按邮箱查看文章");
  });
});
