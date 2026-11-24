# BMverse Arbitrage Pro — live quote monitor

**Current mode: public market monitoring only. Real-money order execution is disabled.**

The same responsive `index.html` is served by GitHub Pages and from the Render backend root. The dashboard automatically requests top-of-book quotes from the private-hosted Node.js backend every 20 seconds and shows indicative Binance ↔ KuCoin cross-exchange spreads, estimates after configurable fees/slippage, and estimated P&L. It does **not** place orders or show realized trading profits.

## Services
- Repository: https://github.com/beautifullminds/bmverse-arbitrage-pro
- Render (expected): https://bmverse-arbitrage-pro.onrender.com/
- Health: https://bmverse-arbitrage-pro.onrender.com/health
- Live scanner: https://bmverse-arbitrage-pro.onrender.com/api/markets
- GitHub Pages (if enabled): https://beautifullminds.github.io/bmverse-arbitrage-pro/

## Run locally

Requires Node.js 20+.

```sh
npm install
npm start
# Open http://localhost:10000/
# curl http://localhost:10000/health
# curl http://localhost:10000/api/markets
```

For Render, create/link a Node.js web service with root directory empty, build `npm install --omit=dev`, start `npm start`, health check `/health`, and auto-deploy latest commit from `main`. The included `render.yaml` declares a starter service. The public dashboard works without private exchange credentials.

## Optional KuCoin account connection diagnostic

Configure secrets ONLY in Render → Environment, never in GitHub or the browser:

```ini
KUCOIN_API_KEY=...
KUCOIN_API_SECRET=...
KUCOIN_API_PASSPHRASE=...
KUCOIN_API_KEY_VERSION=3
ADMIN_API_TOKEN=<long random value>
LIVE_TRADING_ENABLED=false
```

Use a read-only KuCoin API key. Withdrawal permissions should remain disabled. A private diagnostic is available with `Authorization: Bearer <ADMIN_API_TOKEN>` at `GET /api/admin/kucoin/status`. Do not send API keys or admin tokens to anybody or paste them into public sites.

## Limits and risk disclosures

- Quotes are **public, indicative top-of-book quotes**, not fills; real execution depends on depth, latency, inventory on each exchange, fees and network costs.
- Dashboard cost inputs are assumptions. A positive estimated spread is NOT guaranteed profit.
- Live trading, withdrawals, flash loans, real positions, and realized P&L tracking are NOT implemented.
- Some regions, IP addresses, and hosting providers may be blocked from one or both exchange public APIs. The backend returns HTTP 503 rather than fabricating data when feeds are unavailable.
- Live account access and real order placement require separate authenticated execution services, audit, pre-funded exchange balances, risk limits, kill switch, and user-approved order settings.

## Validation
1. Visit `/health` and verify `ok: true`, `tradingEnabled: false`.
2. Visit `/api/markets` and verify updatedAt, sources, and opportunities. An error indicates unavailable exchange connectivity.
3. Visit `/` on Render (or GitHub Pages) and confirm **LIVE MARKET DATA** appears only after the API successfully responds.
4. Change fee and slippage inputs; estimated net results should update without changing raw prices.
5. Confirm no trading action exists and no secrets are present in the public repository.
