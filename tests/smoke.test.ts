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

  test("feed page renders lookup UI and homepage links to browse content", async () => {
    const feed = await app.request("http://manto.local/v1/feed?limit=5");
    expect(feed.status).toBe(200);
    expect(Array.isArray(await feed.json())).toBe(true);

    const feedPageRes = await app.request("http://manto.local/feed");
    expect(feedPageRes.status).toBe(200);
    const feedHtml = await feedPageRes.text();
    expect(feedHtml).toContain('id="feed-list"');
    expect(feedHtml).toContain('id="lookup-form"');
    expect(feedHtml).toContain("信息流");
    expect(feedHtml).toContain("按邮箱查看文章");
    expect(feedHtml).toContain('class="topnav"');
    expect(feedHtml).toContain("/articles/");

    const home = await app.request("http://manto.local/");
    const homeHtml = await home.text();
    expect(homeHtml).toContain("浏览内容");
    expect(homeHtml).toContain('href="/feed"');
    expect(homeHtml).toContain('href="/rss.xml"');
  });

  test("recharge checkout lives on its own page", async () => {
    const home = await app.request("http://manto.local/");
    const homeHtml = await home.text();
    expect(home.status).toBe(200);
    expect(homeHtml).toContain('href="/pay"');
    expect(homeHtml).toContain("进入充值页面");
    expect(homeHtml).not.toContain('id="recharge-form"');

    const pay = await app.request("http://manto.local/pay");
    const payHtml = await pay.text();
    expect(pay.status).toBe(200);
    expect(payHtml).toContain('id="recharge-form"');
    expect(payHtml).toContain('id="recharge-email"');
    expect(payHtml).toContain('id="recharge-amount"');
    expect(payHtml).not.toContain("API Key");
  });

  test("article page, rss feed and sitemap expose published content", async () => {
    const account = await app.request("http://manto.local/v1/accounts", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:`article-${Date.now()}@example.com`})});
    const acc: any = await account.json();
    const publishRes = await app.request("http://manto.local/v1/content", {method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${acc.api_key}`},body:JSON.stringify({external_id:"smoke-article",title:"Manto 多页重构测试",content:"用于验证文章承载页与 RSS 的占位内容。"})});
    const pub: any = await publishRes.json();
    const id = pub.content_id;

    const article = await app.request(`http://manto.local/articles/${id}`);
    expect(article.status).toBe(200);
    const articleHtml = await article.text();
    expect(articleHtml).toContain("Manto 多页重构测试");
    expect(articleHtml).toContain('class="article-body"');
    expect(articleHtml).toContain("返回信息流");

    const missing = await app.request("http://manto.local/articles/does-not-exist");
    expect(missing.status).toBe(404);

    const rss = await app.request("http://manto.local/rss.xml");
    expect(rss.status).toBe(200);
    expect(rss.headers.get("content-type")).toContain("application/rss+xml");
    const rssText = await rss.text();
    expect(rssText).toContain("<rss");
    expect(rssText).toContain("Manto 多页重构测试");

    const sitemap = await app.request("http://manto.local/sitemap.xml");
    const smText = await sitemap.text();
    expect(smText).toContain("/feed");
    expect(smText).toContain("/rss.xml");
    expect(smText).toContain(`/articles/${id}`);
  });
});
