import { Hono } from "hono";
import { cors } from "hono/cors";
import { mcp } from "./mcp";
import { accountFromApiKey } from "./auth";
import { createAccount, accountView, publicAccountByEmail } from "./accounts";
import { publish, removeContent, listPublicContent } from "./contents";
import { search } from "./search";
import { createRecharge, getRecharge, handleCallback } from "./payments";
import { setPromotion } from "./promotions";
import { homePage } from "./home";
import "./db";

const app = new Hono();
app.use("/*", cors());
app.get("/", c => c.html(homePage()));
app.get("/api/health", c => c.json({ok:true,service:"manto",time:new Date().toISOString()}));
app.route("/mcp", mcp);
function auth(c:any){ const account=accountFromApiKey(c.req.header("authorization")?.replace(/^Bearer\s+/i,"")); if(!account) throw new Error("authorization_required"); return account; }
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
app.post("/v1/recharges", async c => { try{const body=await c.req.json();return c.json(await createRecharge(auth(c),Number(body.amount_cents)));}catch(e){return jsonError(c,e);} });
app.get("/v1/recharges/:id", c => { try{return c.json(getRecharge(auth(c),c.req.param("id")));}catch(e){return jsonError(c,e);} });
app.post("/v1/payments/onepay/callback", async c => { try{const body=await c.req.json();return c.json(await handleCallback(String(body.recharge_id),String(body.callback_token)));}catch(e){return jsonError(c,e);} });
app.post("/v1/promotions", async c => { try{return c.json(setPromotion(auth(c),await c.req.json()));}catch(e){return jsonError(c,e);} });

export default { port:Number(Bun.env.PORT||41875), fetch:app.fetch };
export { app };
