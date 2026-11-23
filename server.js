import {checkKucoinConnection, authorized} from './kucoin.js';
import http from 'node:http';
const PORT=Number(process.env.PORT||10000);
const allowedOrigin=process.env.ALLOWED_ORIGIN||'https://beautifullminds.github.io';
const markets=[['BTCUSDT','BTC/USDT'],['ETHUSDT','ETH/USDT'],['SOLUSDT','SOL/USDT']];
async function json(url){const res=await fetch(url,{signal:AbortSignal.timeout(7000)});if(!res.ok)throw Error('upstream '+res.status);return res.json()}
async function scan(){
 const [b,k]=await Promise.allSettled([
 json('https://api.binance.com/api/v3/ticker/bookTicker'),
 json('https://api.kucoin.com/api/v1/market/allTickers')]);
 const bin=b.status==='fulfilled'?new Map(b.value.map(x=>[x.symbol,x])):new Map();
 const ku=k.status==='fulfilled'?new Map((k.value.data?.ticker||[]).map(x=>[x.symbol,x])):new Map();
 const rows=markets.map(([symbol,label])=>{
 const a=bin.get(symbol),c=ku.get(label.replace('/','-'));
 if(!a||!c)return null;
 const ba=Number(a.askPrice),bb=Number(a.bidPrice),ka=Number(c.sell),kb=Number(c.buy);
 if(![ba,bb,ka,kb].every(x=>Number.isFinite(x)&&x>0))return null;
 const directions=[{buy:'Binance',sell:'KuCoin',ask:ba,bid:kb},{buy:'KuCoin',sell:'Binance',ask:ka,bid:bb}];
 return directions.map(d=>({pair:label,buyExchange:d.buy,sellExchange:d.sell,buyPrice:d.ask,sellPrice:d.bid,grossSpreadPct:(d.bid/d.ask-1)*100}));
 }).filter(Boolean).flat();
 return {updatedAt:new Date().toISOString(),sources:{binance:b.status,kucoin:k.status},opportunities:rows,disclaimer:'Gross indicative spreads only. No fees, slippage, withdrawal cost or order-book depth included. Not executable quotes.'};
}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
 if(req.method!=='GET'){res.writeHead(405,headers);return res.end(JSON.stringify({error:'Method not allowed'}))}
 if(req.url==='/api/admin/kucoin/status'){if(!authorized(req)){res.writeHead(401,headers);return res.end(JSON.stringify({error:'Unauthorized'}))}const status=await checkKucoinConnection();res.writeHead(status.connected?200:503,headers);return res.end(JSON.stringify(status))}
 if(req.url==='/health'){res.writeHead(200,headers);return res.end(JSON.stringify({ok:true,mode:'market-data-only',tradingEnabled:false}))}
 if(req.url==='/api/markets'){try{const result=await scan();res.writeHead(200,headers);return res.end(JSON.stringify(result))}catch(e){res.writeHead(502,headers);return res.end(JSON.stringify({error:'Market feed unavailable'}))}}
 res.writeHead(404,headers);res.end(JSON.stringify({error:'Not found'}));
});
server.listen(PORT,'0.0.0.0',()=>console.log('Market data backend listening on '+PORT));
