import {createHmac, timingSafeEqual} from 'node:crypto';
const base='https://api.kucoin.com';
const sign=(secret,text)=>createHmac('sha256',secret).update(text).digest('base64');
export async function checkKucoinConnection(){
 const key=process.env.KUCOIN_API_KEY,secret=process.env.KUCOIN_API_SECRET,passphrase=process.env.KUCOIN_API_PASSPHRASE;
 if(!key||!secret||!passphrase)return {connected:false,configured:false,reason:'Missing KuCoin environment variables'};
 const version=process.env.KUCOIN_API_KEY_VERSION||'3';
 const path='/api/v1/accounts?type=trade';
 const timestamp=String(Date.now());
 const headers={'KC-API-KEY':key,'KC-API-SIGN':sign(secret,timestamp+'GET'+path),'KC-API-TIMESTAMP':timestamp,'KC-API-PASSPHRASE':sign(secret,passphrase),'KC-API-KEY-VERSION':version,'Content-Type':'application/json'};
 try{
  const response=await fetch(base+path,{headers,signal:AbortSignal.timeout(8000)});
  const body=await response.json();
  if(!response.ok||body.code!=='200000')return {connected:false,configured:true,httpStatus:response.status,exchangeCode:String(body.code||'unknown'),reason:'KuCoin rejected the signed account request'};
  return {connected:true,configured:true,accountCount:Array.isArray(body.data)?body.data.length:0,mode:'read-only-check'};
 }catch{return {connected:false,configured:true,reason:'KuCoin request failed or timed out'}}
}
export function authorized(req){
 const expected=process.env.ADMIN_API_TOKEN;
 const provided=(req.headers.authorization||'').replace(/^Bearer /i,'');
 if(!expected||!provided)return false;
 const a=Buffer.from(expected),b=Buffer.from(provided);
 return a.length===b.length&&timingSafeEqual(a,b);
}
