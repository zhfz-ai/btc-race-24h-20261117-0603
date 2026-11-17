# Candidate scorecard — btc-race-24h-20261117-0603

Dev window: 2026-11-16 06:03Z – 2026-11-17 06:03Z (1,440 bars, +0.48%,
worst 10-bar drop only 96 bps — a CALM window). Second window for
robustness: 2026-11-14 08:28Z – 2026-11-15 08:28Z (fell ~4%, volatile).
Simulator: decision at bar close, fill at next open, +9 bps slip/impact
and 4 bps fee per side (~26 bps/round trip). Final pick re-graded with
the kit's exact harness (`grade-local --driver process`).

Scored against the playbook's race-bot gate, in order:
1. net PnL > 0 on dev (the dev gate — otherwise the bot never races),
2. ≤ 6 trades per 24h (fee bleed kills frequent traders),
3. max drawdown ≤ 2% on dev,
4. reward:risk ≥ 1:1 (never a fixed TP smaller than the SL),
5. ≥ 1 trade even on a calm window (staged fallback; 0 trades = no prize).

## Round 1 — seven distinct families (simulator)

| # | Candidate | Dev PnL | Dev trades | Dev DD | Old-window PnL | Verdict |
|---|---|---|---|---|---|---|
| A | Band-revert (Bollinger 20, 2σ) | −$75.04 | 44 | 7.38% | −$83.43 | FAIL 1, 2, 3 — overtrades |
| B | Breakout, 60-bar high | −$5.24 | 12 | 2.09% | −$11.70 | FAIL 1, 2, 3 |
| C | EMA 5/13 cross | −$130.54 | 112 | 13.44% | −$170.32 | FAIL everything |
| D | Dip-buy, loose 50 bps/10 bars + fallback | −$17.36 | 16 | 2.32% | −$63.10 | FAIL 1, 2, 3 |
| E | RSI(14) swing | −$33.95 | 22 | 3.36% | −$77.91 | FAIL 1, 2, 3 |
| F | Mean-reversion to EMA-60, −60 bps | −$6.65 | 6 | 0.86% | −$46.31 | FAIL 1 (close, but negative) |
| G | Momentum-dip (24-bar rise + pullback) | −$12.00 | 2 | 1.26% | −$5.60 | FAIL 1 |

Lesson of round 1: on a calm +0.48% window, every mean-reversion and
trend system that trades more than a few times bleeds the ~26 bps
round-trip cost. Only rare, big dislocations pay.

## Round 2 — deep-dip sweep (simulator)

| Candidate | Dev PnL | Dev trades | Dev DD | Old-window PnL | Verdict |
|---|---|---|---|---|---|
| Snap-back scalper (20261115 entry, re-run) | $0.00 | 0 | 0% | +$10.96 | FAIL 1, 5 — its 120 bps/10-bar trigger never fires here |
| Slow 30-bar dip ≥170 bps, TP 150 | +$14.25 | 2 | 0.63% | −$7.31 | FAIL 5 on old window (loses there) |
| 60-bar dip ≥180 bps, trailing 80 bps | +$9.89 | 2 | 1.06% | +$15.49 | PASS all five — **the pick** |
| 60-bar dip ≥200 bps, trailing 80 bps | +$9.30 | 2 | 1.06% | +$29.19 | PASS all five (plateau with the pick) |
| 60-bar dip ≥180 bps, trailing 60 bps | +$6.97 | 2 | 0.83% | +$13.67 | PASS, worse than pick |
| 60-bar dip ≥180 bps, trailing 100 bps | +$8.89 | 2 | 1.24% | +$13.25 | PASS, worse than pick |
| 60-bar dip ≥180 bps, trailing 80 + cooldown 120 after EVERY exit | +$9.89 | 2 | 1.06% | −$13.04 | FAIL 5 — cooldown kills profitable re-buys |
| 60-bar dip ≥180 bps, trailing 80 + TP 300 cap | +$9.89 | 2 | 1.06% | +$6.39 | PASS, but TP caps big bounces |

## The pick — "Deep-dip trailer"

- Entry: 60-bar drop ≥ 180 bps, all-in. Staged fallback if never traded:
  ≥ 120 bps from bar 720, ≥ 80 bps from bar 1080; from bar 1200 buy a
  30-bar dip ≥ 30 bps or rise ≥ 50 bps; at bar 1380 buy unconditionally.
- Exit: trailing stop 80 bps below the peak close since entry; hard stop
  −250 bps vs cost; max hold 720 bars; 120-bar cooldown after a hard
  stop only.
- Distinct from "Snap-back scalper" (10/30-bar triggers, fixed TP 60 /
  SL 150, 5-bar cooldown) and "Washout-bounce" (600-bar-high dip +
  120-bar breakout, TP 100 / SL 200): different trigger window,
  different exit (trailing, no fixed TP), different cooldown rule.
- Exact-harness grade: **net +$8.89, 2 trades (1 round trip, 1.00 win
  rate), max drawdown 1.08%, fees $0.80, guardrails met** — passes the
  dev gate with margin over buy-and-hold (+$1.07).
