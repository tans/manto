export async function sendEmail(_to:string,_kind:'verify'|'recovery',_token:string){ return Boolean(Bun.env.SMTP_URL); }
