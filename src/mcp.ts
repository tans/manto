import { Hono } from "hono";
import { z } from "zod";
import { accountFromApiKey } from "./auth";
import { createAccount, accountView, publicAccountByEmail } from "./accounts";
import { publish, removeContent, listPublicContent } from "./contents";
import { search } from "./search";
import { createRecharge, getRecharge } from "./payments";
import { setPromotion } from "./promotions";

const tools = [
  { name:"create_account", description:"Create a passwordless Manto account", inputSchema:{type:"object",properties:{email:{type:"string"}},required:["email"]} },
  { name:"lookup_account", description:"Look up a public account by email; no API key required", inputSchema:{type:"object",properties:{email:{type:"string"}},required:["email"]} },
  { name:"list_account_articles", description:"List an account's published articles; no API key required", inputSchema:{type:"object",properties:{account_id:{type:"string"},limit:{type:"number"},include_content:{type:"boolean"}},required:["account_id"]} },
  { name:"get_account", description:"Get account quota, balance and recent content", inputSchema:{type:"object",properties:{}} },
  { name:"publish", description:"Create or idempotently update content", inputSchema:{type:"object",properties:{external_id:{type:"string"},title:{type:"string"},content:{type:"string"},url:{type:"string"},expires_at:{type:"string"}},required:["title","content"]} },
  { name:"remove_content", description:"Remove your content", inputSchema:{type:"object",properties:{content_id:{type:"string"}},required:["content_id"]} },
  { name:"search", description:"Search published news and messages", inputSchema:{type:"object",properties:{query:{type:"string"},limit:{type:"number"},since:{type:"string"},include_content:{type:"boolean"}},required:["query"]} },
  { name:"create_recharge", description:"Create a recharge order for an account email", inputSchema:{type:"object",properties:{email:{type:"string"},amount_cents:{type:"number"}},required:["email","amount_cents"]} },
  { name:"get_recharge", description:"Get recharge status", inputSchema:{type:"object",properties:{recharge_id:{type:"string"}},required:["recharge_id"]} },
  { name:"set_promotion", description:"Set daily promotion budget; zero pauses", inputSchema:{type:"object",properties:{content_id:{type:"string"},daily_budget_cents:{type:"number"}},required:["content_id","daily_budget_cents"]} }
];
const authRequired = new Set(["get_account","publish","remove_content","set_promotion"]);
const errorMessage = (e:any) => e?.message || "request_failed";
export const mcp = new Hono();
mcp.post("/", async c => {
  let body:any; try { body=await c.req.json(); } catch { return c.json({jsonrpc:"2.0",error:{code:-32700,message:"Invalid JSON"}},400); }
  if(body.method === "initialize") return c.json({jsonrpc:"2.0",id:body.id,result:{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"manto",version:"1.0.3"}}});
  if(body.method === "notifications/initialized") return c.body(null,204);
  if(body.method === "tools/list") return c.json({jsonrpc:"2.0",id:body.id,result:{tools}});
  if(body.method !== "tools/call") return c.json({jsonrpc:"2.0",id:body.id,error:{code:-32601,message:"Method not found"}},404);
  const name=String(body.params?.name||""); const args=body.params?.arguments||{}; if(!tools.some(t=>t.name===name)) return c.json({jsonrpc:"2.0",id:body.id,error:{code:-32602,message:"Unknown tool"}},400);
  const account=accountFromApiKey(c.req.header("authorization")?.replace(/^Bearer\s+/i,"")); if(authRequired.has(name) && !account) return c.json({jsonrpc:"2.0",id:body.id,error:{code:-32001,message:"Authorization required"}},401);
  try {
    let result:any; if(name==='create_account') result=createAccount(z.object({email:z.string()}).parse(args).email);
    else if(name==='lookup_account') result=publicAccountByEmail(String(args.email || ""));
    else if(name==='list_account_articles') result=listPublicContent(String(args.account_id || ""),Number(args.limit || 20),Boolean(args.include_content));
    else if(name==='get_account') result=accountView(account);
    else if(name==='publish') result=publish(account,args);
    else if(name==='remove_content') result=removeContent(account,String(args.content_id));
    else if(name==='search') result=search(args);
    else if(name==='create_recharge') result=await createRecharge(account||publicAccountByEmail(String(args.email||"")),Number(args.amount_cents));
    else if(name==='get_recharge') result=await getRecharge(String(args.recharge_id));
    else result=setPromotion(account,args);
    return c.json({jsonrpc:"2.0",id:body.id,result:{content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result}});
  } catch(e:any) { return c.json({jsonrpc:"2.0",id:body.id,error:{code:-32000,message:errorMessage(e)}},400); }
});
