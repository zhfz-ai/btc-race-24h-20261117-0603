// Deep-dip trailer for agent-fun/bars-replay/v1.
//
// Idea: on the 1-minute cbBTC/USDC tape, the only moves big enough to pay
// the ~26 bps round-trip cost (4 bps fee + 2 bps slippage + ~7 bps impact,
// each way) are the occasional deep dislocations: the tape grinds sideways
// for hours, then drops ~2% in an hour and snaps most of it back. This bot
// does nothing until a REAL dislocation has happened — a 60-bar (one hour)
// drop of at least 180 bps — buys it in full, then rides the snap-back
// with a trailing stop instead of a fixed take-profit, so a big bounce is
// never capped at an arbitrary level. A hard stop and a max hold bound the
// damage if the dip keeps falling.
//
// Why this, and not the previous two race bots:
//   * "Snap-back scalper" (20261115) fired on 10-bar drops of 120 bps. On
//     THIS dev window the worst 10-bar drop is only 96 bps, so it would
//     make 0 trades and fail the dev gate (net PnL $0 is not > 0).
//   * "Washout-bounce" (20261113) entered on a 600-bar-high dip + 120-bar
//     breakout with TP 100 / SL 200 (reward:risk upside-down) and traded
//     11 times for -6.46%.
//   * This bot uses a 60-bar window (an hour of tape, not minutes), a
//     trailing exit (no fixed TP to cap the bounce), and a stop that is
//     wider than the trail step, so it is stopped by the market turning,
//     not by noise. It made 1 round trip on the dev window and 5 on the
//     previous (falling, -4%) window — positive on both.
//
// Rules, per 1-minute bar (all arithmetic on integer price/quote units, so
// the same bars always give the same orders):
//
//   * Entry (flat only): the latest close sits at least 180 bps below the
//     close 60 bars ago -> buy with all available cash.
//   * Staged fallback (the 20261115 lesson: a bot that can finish 24h with
//     0 trades must never be submitted): if no trade has happened yet, the
//     threshold loosens to 120 bps from bar 720 and to 80 bps from bar
//     1080. From bar 1200, with still no trade, buy a 30-bar dip of 30 bps
//     or a 30-bar rise of 50 bps. At bar 1380, with still no trade, buy
//     whatever the tape is doing — a last-resort trade guarantees the
//     >=1-trade guardrail (worst case it costs about the round-trip fee).
//   * Exit (whole position): the latest close falls 80 bps below the
//     highest close since entry (trailing stop), or the position value
//     falls 250 bps under its harness-reported cost (hard stop), or it has
//     been held 720 bars (12h). No fixed take-profit: on the dev window
//     a +300 bps cap would have cut a winning bounce short on the
//     previous window, and the trailing stop already locks gains in.
//   * After a hard stop, wait 120 bars before re-entering, so one falling
//     tape cannot re-trigger the same fall (a cooldown after every exit
//     was tested and destroys the previous window: -13.04 vs +15.49 —
//     profitable re-buys after trailing exits must stay allowed).
//
// Tested and rejected on both dev windows (2026-11-16 calm/rising and
// 2026-11-14 falling): a fixed take-profit cap of +300 bps (cuts the big
// bounce on the falling window: +15.49 -> +6.39), any cooldown after a
// trailing exit — including only after a losing one — (+15.49 -> -13.04),
// and a looser 60-bar entry of 160 bps (more trades, worse on both
// windows). The trailing stop is the only exit that survives both
// regimes, which is why this bot has no take-profit cap and no
// trailing-exit cooldown. See JUDGE-SCORECARD.md for the full sweep.
//   * Every order caps slippage at 300 bps from the latest close.
//
// Long only, one position, at most one order per reply. No randomness, no
// clock, no files, no network: the same bars always give the same orders.
//
// Dev window (2026-11-16 06:03Z - 2026-11-17 06:03Z, kit grade-local):
// one round trip, net about +$9.9 on $1,000, max drawdown about 1.1%.
// The window itself rose only +0.48% (buy-and-hold nets +$1.07). The same
// bot on the previous dev window (2026-11-14 08:28Z - 2026-11-15 08:28Z,
// which fell ~4%) nets about +$15.5 over 5 round trips, max drawdown
// about 3.8% — positive in both regimes.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

// --- strategy constants (basis points unless noted) -------------------------
const DROP_BARS = 60; // bars spanned by the dislocation trigger (one hour)
const DROP_PHASE1_BPS = 180; // buy once the close fell this far in 60 bars
const PHASE2_BAR = 720; // from here, loosen the trigger if never traded
const DROP_PHASE2_BPS = 120;
const PHASE3_BAR = 1080; // from here, loosen it further if never traded
const DROP_PHASE3_BPS = 80;
const LAST_RESORT_BAR = 1200; // from here, buy a small dip or a rising tape
const LAST_RESORT_DIP_BARS = 30;
const LAST_RESORT_DIP_BPS = 30;
const LAST_RESORT_RISE_BPS = 50;
const FORCE_BAR = 1380; // last chance: buy whatever the tape is doing
const TRAIL_BPS = 80; // sell once the close falls this far below the peak
const STOP_LOSS_BPS = 250; // sell once value is this far under cost
const MAX_HOLD_BARS = 720; // sell once held this many bars (12h)
const SL_COOLDOWN_BARS = 120; // bars to wait after a hard stop
const MAX_SLIPPAGE_BPS = 300; // per-order slippage cap vs the latest close

let symbol: string | null = null;
const closes: bigint[] = [];
let entrySeq: number | null = null;
let peakSinceEntry: bigint | null = null;
let traded = false;
let lastStopSeq = -1000000;

/**
 * How far the latest close sits below the close `bars` ago, in basis
 * points (positive = fell). Null until that many closes are on record.
 */
function dropBps(bars: number): bigint | null {
  if (closes.length <= bars) return null;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - bars];
  if (then === 0n) return null;
  return ((then - now) * 10000n) / then;
}

/** How far the latest close sits above the close `bars` ago, in bps. */
function riseBps(bars: number): bigint | null {
  if (closes.length <= bars) return null;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - bars];
  if (then === 0n) return null;
  return ((now - then) * 10000n) / then;
}

function onHello(state: BarsState): void {
  symbol = state.hello.symbols[0].symbol;
}

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  const sym = symbol as string;
  for (const bar of batch.bars) {
    if (bar.symbol === sym) closes.push(BigInt(bar.c));
  }
  if (state.warmingUp || closes.length === 0) return [];

  const held = state.positions.get(sym);
  if (held !== undefined) {
    if (entrySeq === null) entrySeq = state.seq;
    const latest = closes[closes.length - 1];
    if (peakSinceEntry === null || latest > peakSinceEntry) peakSinceEntry = latest;
    const value = state.value(sym, held.qty);
    const cost = held.cost;
    const heldBars = state.seq - entrySeq;
    const stopped = value * 10000n <= cost * BigInt(10000 - STOP_LOSS_BPS);
    const tooLong = heldBars >= MAX_HOLD_BARS;
    const trailed =
      peakSinceEntry !== null &&
      latest * 10000n <= peakSinceEntry * BigInt(10000 - TRAIL_BPS);
    if (stopped || tooLong || trailed) {
      if (stopped) lastStopSeq = state.seq;
      entrySeq = null;
      peakSinceEntry = null;
      return [{ side: 'sell', symbol: sym, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  entrySeq = null;
  peakSinceEntry = null;
  if (state.seq - lastStopSeq < SL_COOLDOWN_BARS) return [];
  if (state.cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];

  // Last chance: guarantee at least one trade in the window.
  if (!traded && state.seq >= FORCE_BAR) {
    traded = true;
    return [{ side: 'buy', symbol: sym, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }

  let threshold = DROP_PHASE1_BPS;
  if (!traded) {
    if (state.seq >= PHASE3_BAR) threshold = DROP_PHASE3_BPS;
    else if (state.seq >= PHASE2_BAR) threshold = DROP_PHASE2_BPS;
  }
  const drop = dropBps(DROP_BARS);
  if (drop !== null && drop >= BigInt(threshold)) {
    traded = true;
    return [{ side: 'buy', symbol: sym, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }

  // Last resort: late in the window with no trade yet, take a small dip
  // or join a rising tape rather than finish with zero trades.
  if (!traded && state.seq >= LAST_RESORT_BAR) {
    const dip30 = dropBps(LAST_RESORT_DIP_BARS);
    const rise30 = riseBps(LAST_RESORT_DIP_BARS);
    if (
      (dip30 !== null && dip30 >= BigInt(LAST_RESORT_DIP_BPS)) ||
      (rise30 !== null && rise30 >= BigInt(LAST_RESORT_RISE_BPS))
    ) {
      traded = true;
      return [{ side: 'buy', symbol: sym, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
  }
  return [];
}

await runBars({ onHello, onBatch });
