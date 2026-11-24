// Discovery only: indexed USD prices are not executable swap quotes.
const assets=[
 ['ethereum','WETH','0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
 ['bsc','WBNB','0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
 ['solana','WSOL','So11111111111111111111111111111111111111112'],
 ['base','WETH','0x4200000000000000000000000000000000000006'],
 ['arbitrum','WETH','0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'],
 ['polygon','WPOL','0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'],
 ['avalanche','WAVAX','0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'],
 ['optimism','WETH','0x4200000000000000000000000000000000000006']
];
const stable={
 ethereum:['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7'],
 bsc:['0x55d398326f99059ff775485246999027b3197955'],
 solana:['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
 base:['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'],
 arbitrum:['0xaf88d065e77c8cc2239327c5edb3a432268e5831'],
 polygon:['0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'],
 avalanche:['0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'],
 optimism:['0x0b2c639c533813f4aa9d7837caf62653d097ff85']
};
const norm=(chain,a)=>chain==='solana'?a:String(a||'').toLowerCase();
let cached,at=0,pending;
async function fresh(){
 const results=await Promise.allSettled(assets.map(async([chain,symbol,address])=>{
  const r=await fetch('https://api.dexscreener.com/token-pairs/v1/'+chain+'/'+address,{signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(!Array.isArray(data))throw Error('Invalid response');
  return {chain,symbol,pools:data.filter(p=>p.chainId===chain&&norm(chain,p.baseToken?.address)===norm(chain,address)&&stable[chain].includes(norm(chain,p.quoteToken?.address))&&Number(p.liquidity?.usd)>=100000&&Number(p.volume?.h24)>=10000&&Number(p.priceUsd)>0&&Number.isFinite(Number(p.priceUsd))).map(p=>({chain,symbol,dex:String(p.dexId),pool:String(p.pairAddress),quoteAddress:norm(chain,p.quoteToken.address),quoteSymbol:String(p.quoteToken.symbol),priceUsd:Number(p.priceUsd),liquidityUsd:Number(p.liquidity.usd),volume24h:Number(p.volume.h24)})).slice(0,40)};
 }));
 const pools=results.flatMap(r=>r.status==='fulfilled'?r.value.pools:[]);
 const candidates=[];
 for(const a of pools)for(const b of pools){
 if(a.chain!==b.chain||a.symbol!==b.symbol||a.quoteAddress!==b.quoteAddress||a.dex===b.dex||a.pool===b.pool||b.priceUsd<=a.priceUsd)continue;
 candidates.push({chain:a.chain,symbol:a.symbol,quote:a.quoteSymbol,buyDex:a.dex,sellDex:b.dex,buyPool:a.pool,sellPool:b.pool,buyPriceUsd:a.priceUsd,sellPriceUsd:b.priceUsd,grossSpreadPct:(b.priceUsd/a.priceUsd-1)*100,minLiquidityUsd:Math.min(a.liquidityUsd,b.liquidityUsd),requiresExecutableQuote:true});
 }
 candidates.sort((a,b)=>b.grossSpreadPct-a.grossSpreadPct);
 return {updatedAt:new Date().toISOString(),sources:assets.map((a,i)=>({chain:a[0],status:results[i].status==='fulfilled'?'ok':'unavailable'})),poolCount:pools.length,dexes:[...new Set(pools.map(p=>p.dex))],pools,candidates:candidates.slice(0,100),tradingEnabled:false,disclaimer:'Indexed indicative USD prices, not executable quotes. Same chain and identical quote token only. Gas, pool fees, price impact, MEV and freshness require independent validation.'};
}
export async function scanDex(){if(cached&&Date.now()-at<30000)return cached;if(!pending)pending=fresh().then(x=>{cached=x;at=Date.now();return x}).finally(()=>pending=null);return pending;}
