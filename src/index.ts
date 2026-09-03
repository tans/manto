import { Hono } from "hono";
import { cors } from "hono/cors";
import { mcp } from "./mcp";
import { accountFromApiKey } from "./auth";
import { createAccount, accountView, publicAccountByEmail } from "./accounts";
import { publish, removeContent, listPublicContent, recentContent, getContent } from "./contents";
import { search } from "./search";
import { createRecharge, getRecharge, handleCallback } from "./payments";
import { setPromotion } from "./promotions";
import { homePage, payPage, feedPage, articlePage, geoPage, rssXml } from "./home";
import { llmsTxt, robotsTxt, sitemapXml } from "./discovery";
import "./db";

const app = new Hono();
const publicBaseUrl = (requestUrl: string) => Bun.env.PUBLIC_URL || new URL(requestUrl).origin;
const publicMcpUrl = (requestUrl: string) => Bun.env.PUBLIC_MCP_URL || `${publicBaseUrl(requestUrl).replace(/\/+$/, "")}/mcp`;

app.use("/*", cors());
app.get("/", c => c.html(homePage()));
app.get("/pay", c => c.html(payPage()));
app.get("/feed", c => c.html(feedPage()));
app.get("/articles/:id", c => { try { return c.html(articlePage(getContent(c.req.param("id")))); } catch(e){ return jsonError(c,e); } });
app.get("/geo", c => c.html(geoPage()));
app.get("/rss.xml", c => {
  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  c.header("Cache-Control", "public, max-age=1800");
  return c.body(rssXml(publicBaseUrl(c.req.url)));
});
app.get("/robots.txt", c => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.text(robotsTxt(publicBaseUrl(c.req.url)));
});
app.get("/sitemap.xml", c => {
  c.header("Content-Type", "application/xml; charset=utf-8");
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(sitemapXml(publicBaseUrl(c.req.url)));
});
app.get("/llms.txt", c => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(llmsTxt(publicBaseUrl(c.req.url), publicMcpUrl(c.req.url)));
});
app.get("/api/health", c => c.json({ok:true,service:"manto",time:new Date().toISOString()}));
app.route("/mcp", mcp);
function auth(c:any){ const account=accountFromApiKey(c.req.header("authorization")?.replace(/^Bearer\s+/i,"")); if(!account) throw new Error("authorization_required"); return account; }
function optionalAuth(c:any){ return accountFromApiKey(c.req.header("authorization")?.replace(/^Bearer\s+/i,"")); }
function jsonError(c:any,e:any){ const message=e?.message||"request_failed"; const status=message==='authorization_required'?401:message.endsWith('_not_found')?404:400; return c.json({error:message},status); }
app.post("/v1/accounts", async c => { try { const body=await c.req.json(); return c.json(createAccount(body.email)); } catch(e){ return jsonError(c,e); } });
app.get("/v1/accounts/by-email", c => { try { return c.json(publicAccountByEmail(c.req.query("email") || "")); } catch(e) { return jsonError(c,e); } });
app.get("/v1/account/by-email", c => { try { return c.json(publicAccountByEmail(c.req.query("email") || "")); } catch(e) { return jsonError(c,e); } });
app.get("/v1/accounts/:accountId/articles", c => { try { return c.json(listPublicContent(c.req.param("accountId"), Number(c.req.query("limit") || 20), c.req.query("include_content") === "true")); } catch(e) { return jsonError(c,e); } });
app.get("/v1/account/:accountId/articles", c => { try { return c.json(listPublicContent(c.req.param("accountId"), Number(c.req.query("limit") || 20), c.req.query("include_content") === "true")); } catch(e) { return jsonError(c,e); } });
app.get("/v1/account", c => { try{return c.json(accountView(auth(c)));}catch(e){return jsonError(c,e);} });
app.post("/v1/content", async c => { try{return c.json(publish(auth(c),await c.req.json()));}catch(e){return jsonError(c,e);} });
app.delete("/v1/content/:id", c => { try{return c.json(removeContent(auth(c),c.req.param("id")));}catch(e){return jsonError(c,e);} });
app.get("/v1/search", c => { try{return c.json(search({query:c.req.query("query"),limit:c.req.query("limit"),since:c.req.query("since"),include_content:c.req.query("include_content")==='true'}));}catch(e){return jsonError(c,e);} });
app.get("/v1/feed", c => { try { return c.json(recentContent(Number(c.req.query("limit") || 20))); } catch(e){ return jsonError(c,e); } });
app.post("/v1/recharges", async c => { try{const body=await c.req.json();const account=optionalAuth(c)||publicAccountByEmail(String(body.email||""));return c.json(await createRecharge(account,Number(body.amount_cents)));}catch(e){return jsonError(c,e);} });
app.get("/v1/recharges/:id", async c => { try{return c.json(await getRecharge(c.req.param("id")));}catch(e){return jsonError(c,e);} });
app.post("/v1/payments/onepay/callback", async c => {
  try {
    let body:any = {};
    try { body = await c.req.json(); } catch {}
    const rechargeId = c.req.query("recharge_id") || body.recharge_id;
    const callbackToken = c.req.query("callback_token") || body.callback_token;
    return c.json(await handleCallback(String(rechargeId || ""), String(callbackToken || "")));
  } catch(e) { return jsonError(c,e); }
});
app.post("/v1/promotions", async c => { try{return c.json(setPromotion(auth(c),await c.req.json()));}catch(e){return jsonError(c,e);} });

export default { port:Number(Bun.env.PORT||41875), fetch:app.fetch };
export { app };
