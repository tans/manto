import { db, now, transaction } from "./db";
import { newToken, hash } from "./auth";

const onepayBaseUrl = () => (Bun.env.ONEPAY_BASE_URL || "https://onepay.minapp.xin").replace(/\/+$/, "");
const publicBaseUrl = () => (Bun.env.PUBLIC_URL || "http://localhost:41875").replace(/\/+$/, "");

function absolutePaymentUrl(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return new URL(value, `${onepayBaseUrl()}/`).toString();
}

export async function createRecharge(account:any, amountCents:number) {
  if(!Number.isInteger(amountCents)||amountCents<100) throw new Error("invalid_amount");
  const accountId=account.id || account.account_id;
  const id=crypto.randomUUID();
  const callbackToken=newToken("cb_");
  const callbackUrl=`${publicBaseUrl()}/v1/payments/onepay/callback?recharge_id=${encodeURIComponent(id)}&callback_token=${encodeURIComponent(callbackToken)}`;
  const endpoint=Bun.env.ONEPAY_CREATE_URL || `${onepayBaseUrl()}/api/create-order`;
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    fee:amountCents,
    outTradeNo:id,
    title:"Manto 充值",
    email:account.email,
    redirectUrl:`${publicBaseUrl()}/?recharge_id=${encodeURIComponent(id)}`,
    notifyUrl:callbackUrl,
    fields:["email"]
  })});
  if(!response.ok) throw new Error("payment_service_unavailable");
  const data=await response.json() as any;
  const order=data.order || data;
  const onepayOrderId=String(order.id || order._id || data.order_id || "");
  const paymentUrl=absolutePaymentUrl(data.paymentUrl || data.payment_url);
  if(!onepayOrderId || !paymentUrl) throw new Error("payment_service_unavailable");
  transaction(()=>db.query("INSERT INTO recharges(id,account_id,onepay_order_id,amount_cents,callback_token_hash,payment_url,created_at) VALUES(?,?,?,?,?,?,?)").run(id,accountId,onepayOrderId,amountCents,hash(callbackToken),paymentUrl,now()));
  return {recharge_id:id,amount_cents:amountCents,status:"pending",payment_url:paymentUrl};
}

function markPaid(id:string, accountId:string, amountCents:number) {
  transaction(()=>{
    const current=db.query("SELECT status FROM recharges WHERE id=?1 AND account_id=?2").get(id,accountId) as any;
    if(current?.status==='pending'){
      db.query("UPDATE recharges SET status='paid',paid_at=?1 WHERE id=?2 AND account_id=?3").run(now(),id,accountId);
      db.query("INSERT OR IGNORE INTO balance_ledger(id,account_id,amount_cents,reference_type,reference_id,created_at) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(),accountId,amountCents,'recharge',id,now());
    }
  });
}

async function queryPaid(recharge:any) {
  const configured=Bun.env.ONEPAY_QUERY_URL;
  if(configured){
    const response=await fetch(`${configured}${configured.includes("?") ? "&" : "?"}order_id=${encodeURIComponent(recharge.onepay_order_id)}`);
    if(!response.ok) throw new Error("payment_service_unavailable");
    const data=await response.json() as any;
    return data.status === true || data.status === "paid" || data.order?.status === "paid";
  }
  const response=await fetch(`${onepayBaseUrl()}/api/${encodeURIComponent(recharge.onepay_order_id)}/check`);
  if(!response.ok) throw new Error("payment_service_unavailable");
  const data=await response.json() as any;
  return data.status === true || data.status === "paid";
}

async function refreshRecharge(id:string, accountId:string, recharge:any) {
  if(recharge.status==='pending' && await queryPaid(recharge)) markPaid(id,accountId,recharge.amount_cents);
  return db.query("SELECT id AS recharge_id,amount_cents,status,payment_url,created_at,paid_at FROM recharges WHERE id=?1 AND account_id=?2").get(id,accountId);
}

export async function getRecharge(id:string, accountId?:string){
  const r=accountId
    ? db.query("SELECT * FROM recharges WHERE id=?1 AND account_id=?2").get(id,accountId) as any
    : db.query("SELECT * FROM recharges WHERE id=?1").get(id) as any;
  if(!r) throw new Error("recharge_not_found");
  return refreshRecharge(id,r.account_id,r);
}

export async function handleCallback(id:string, token:string){
  const r=db.query("SELECT * FROM recharges WHERE id=?1").get(id) as any;
  if(!r || hash(token)!==r.callback_token_hash) throw new Error("invalid_callback");
  if(r.status==='paid') return {status:'paid'};
  if(!await queryPaid(r)) throw new Error("payment_not_confirmed");
  markPaid(id,r.account_id,r.amount_cents);
  return {status:'paid'};
}
