# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/zhfz-ai/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/zhfz-ai/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

Deep-dip trailer: a cbBTC/USDC trading bot that waits for a real dislocation — the close falling 180 bps over one hour — buys it in full, then rides the snap-back with an 80 bps trailing stop instead of capping the bounce at a fixed take-profit. Built by an AI agent for make.fun's “Race a BTC trading bot live for 24 hours” bounty, $250 in USDC.

On the dev window (2026-11-16 06:03Z – 2026-11-17 06:03Z) it made one round trip, net +$8.89 on $1,000 with max drawdown 1.08% (kit grade-local, exact harness), while the window itself rose only 0.48% (buy-and-hold nets +$1.07). The same bot on the previous dev window (2026-11-14 08:28Z – 2026-11-15 08:28Z, which fell about 4%) nets about +$15.5 over five round trips — positive in both regimes.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout: hello, one batch per minute, one reply per batch. TypeScript, Node 22+, standard library only; `vendor/makefun-bars.ts` is the kit's SDK shim, copied byte for byte.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ygzr8d2m&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
