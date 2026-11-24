import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {checkKucoinConnection, authorized} from './kucoin.js';

const PORT=Number(process.env.PORT||10000);
const allowedOrigin=process.env.ALLOWED_ORIGIN||'https://beautifullminds.github.io';
const pairs=[['BTCUSDT','BTC-USDT','BTC/USDT'],['ETHUSDT','ETH-USDT','ETH/USDT'],['SOLUSDT','SOL-USDT','SOL/USDT']];
const cacheDurationMs=10000;
let lastScan=null, lastScanAt=0, inFlight=null;

async function readJson(url){
 const response=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(8500)});
 if(!response.ok)throw new Error('Upstream HTTP '+response.status);
 return response.json();
}
async function scanFresh(){
 const [binance,kucoin]=await Promise.allSettled([
   readJson('https://api.binance.com/api/v3/ticker/bookTicker'),
   readJson('https://api.kucoin.com/api/v1/market/allTickers')
 ]);
 const b=new Map(binance.status==='fulfilled'&&Array.isArray(binance.value)?binance.value.map(t=>[t.symbol,t]):[]);
 const k=new Map(kucoin.status==='fulfilled'&&kucoin.value?.code==='200000'&&Array.isArray(kucoin.value.data?.ticker)?kucoin.value.data.ticker.map(t=>[t.symbol,t]):[]);
 const opportunities=[];
 for(const [bSymbol,kSymbol,label] of pairs){
   const x=b.get(bSymbol),y=k.get(kSymbol);
   if(!x||!y)continue;
   const ba=Number(x.askPrice),bb=Number(x.bidPrice),ka=Number(y.sell),kb=Number(y.buy);
   if(![ba,bb,ka,kb].every(n=>Number.isFinite(n)&&n>0))continue;
   for(const direction of [{buy:'Binance',sell:'KuCoin',ask:ba,bid:kb},{buy:'KuCoin',sell:'Binance',ask:ka,bid:bb}]){
     opportunities.push({pair:label,buyExchange:direction.buy,sellExchange:direction.sell,buyPrice:direction.ask,sellPrice:direction.bid,grossSpreadPct:Number(((direction.bid/direction.ask)-1)*100).toFixed(6)});
   }
 }
 const result={updatedAt:new Date().toISOString(),sources:{binance:binance.status==='fulfilled'?'ok':'unavailable',kucoin:k.size>0?'ok':'unavailable'},opportunities,mode:'public-market-monitoring',tradingEnabled:false,disclaimer:'Indicative top-of-book quotes only. Depth, fill risk, fees, slippage, rebalancing and transfer costs are not guaranteed. Not executable quotes or realized P&L.'};
 if(!opportunities.length)throw new Error('No valid cross-exchange quotes available');
 return result;
}
async function scan(){
 if(lastScan&&Date.now()-lastScanAt<cacheDurationMs)return lastScan;
 if(!inFlight)inFlight=scanFresh().then(data=>{lastScan=data;lastScanAt=Date.now();return data}).finally(()=>{inFlight=null});
 return inFlight;
}
function respond(res,status,data,origin,extra={}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin',...extra};
 res.writeHead(status,headers);res.end(JSON.stringify(data));
}
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url||'/', 'http://localhost').pathname;
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'});return res.end()}
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
 if(path==='/health')return respond(res,200,{ok:true,mode:'public-market-monitoring',tradingEnabled:false});
 if(path==='/api/markets'){
   try{return respond(res,200,await scan())}
   catch{return respond(res,503,{error:'Live cross-exchange quotes are unavailable. Retry shortly.',updatedAt:new Date().toISOString(),tradingEnabled:false})}
 }
 if(path==='/api/admin/kucoin/status'){
   if(!authorized(req))return respond(res,401,{error:'Unauthorized'});
   const result=await checkKucoinConnection();
   return respond(res,result.connected?200:503,result);
 }
 if(path==='/'||path==='/index.html'){
   try{
     const html=await readFile(fileURLToPath(new URL('./index.html',import.meta.url)));
     res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
     return res.end(html);
   }catch{return respond(res,500,{error:'Dashboard unavailable'})}
 }
 return respond(res,404,{error:'Not found'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('BMverse market monitor listening on '+PORT+' (real orders disabled)'));
