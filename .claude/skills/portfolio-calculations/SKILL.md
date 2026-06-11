---
name: portfolio-calculations
description: Canonical formulas and rules for all portfolio analytics in this Trading Journal app — current value, net P&L, return %, drawdown, win rate, profit factor, snapshots. Use whenever computing, displaying, or testing any financial metric so every layer (DB, API, UI, charts) agrees.
---

# Portfolio Calculation Reference

All money is `Decimal(18,2)` in INR. Never use JS `number` for stored money math — use Prisma.Decimal or a decimal lib. Round only at display time.

## Transaction sign convention
- Deposit: increases portfolio, is capital in (not profit)
- Withdrawal: decreases portfolio, is capital out (not loss)
- Profit: increases portfolio AND counts toward P&L
- Loss: decreases portfolio AND counts toward P&L

## Core formulas
| Metric | Formula |
|---|---|
| Current Portfolio Value | `Deposits + Profits − Losses − Withdrawals` |
| Net Portfolio Value | same as Current Portfolio Value |
| Net P&L | `Profits − Losses` |
| Portfolio Return % | `(Net P&L / Total Deposits) × 100` (0 if no deposits) |
| Daily / Weekly / Monthly P&L | `Profits − Losses` within that period |
| Daily / Weekly / Monthly Return % | period Net P&L / equity at period start × 100 |

## Trading statistics (computed over Profit/Loss entries, or over JournalEntry trades)
- **Peak Equity** = max running portfolio value over time
- **Lowest Equity** = min running portfolio value over time
- **Maximum Drawdown** = max over time of `(peak_so_far − equity) / peak_so_far × 100`
- **Average Profit** = mean amount of profit entries
- **Average Loss** = mean amount of loss entries
- **Win Rate** = `wins / (wins + losses) × 100` where a win is a profit entry/trade
- **Profit Factor** = `Total Profits / Total Losses` (∞ / show "—" if losses = 0)
- **Recovery Factor** = `Net P&L / Maximum Drawdown (absolute)`
- **Risk Reward Ratio** = `Average Profit / Average Loss`

## Snapshot engine rules
- Charts render from `PortfolioSnapshot`, never from raw transactions at read time.
- A snapshot row = { date, granularity (DAY/WEEK/MONTH), portfolioValue, equity, returnPct }.
- Recompute affected snapshots inside the same DB transaction as any mutation.
- Running equity is cumulative and ordered by date — compute peak/drawdown from the ordered snapshot series.

## Display rules
- INR formatting: `₹` prefix, Indian grouping (₹1,25,000), 2 decimals for amounts, whole/1-decimal for percentages.
- Positive values render green, negative red, neutral default.
- Net P&L shows sign and percent: `+₹24,500 (+24%)`.

## Edge cases
- Total Deposits = 0 → all return %s are 0, not NaN/∞.
- No losses → Profit Factor and Risk Reward show "—".
- Empty data → metrics are 0, charts render empty state, never crash.
