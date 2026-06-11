# Portfolio Tracker + Trading Journal

A production-grade, multi-user trading analytics dashboard. Manually log deposits,
withdrawals, profit, and loss; the system computes all portfolio analytics, renders
TradingView-style charts, and keeps a full trading journal — with undo/redo, audit
history, CSV import/export, and snapshot-based charting.

> Not a stock screener or broker integration. All transactions are entered manually.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide |
| Charts | TradingView Lightweight Charts v5 |
| Backend | Next.js route handlers + Supabase |
| Database | PostgreSQL via Prisma 7 (pg driver adapter) |
| Auth | Supabase Auth (Google OAuth) |
| State | Zustand (UI) + TanStack React Query (server state) |
| Forms | React Hook Form + Zod |
| CSV | PapaParse |
| Toasts | Sonner |

> The master spec targeted Next 15; `create-next-app` installed the current Next 16 / React 19 / Tailwind v4, which are backward-compatible and used here.

## Features

- **Dashboard** — 10 animated count-up summary cards, trading-stat strip (win rate, profit factor, drawdown, recovery, R:R), recent activity, quick actions.
- **Analytics** — three charts: golden money-flow line (markers for deposits/withdrawals/milestones), black/white % growth, and a colored cash-flow histogram. Each has crosshair, zoom/pan, fullscreen, PNG export, reset, and manual Y-axis limits. Footer tables for Top Profits / Top Losses (search, sort, paginate, sticky header, CSV export).
- **Journal** — trades with type/outcome, mistake/lesson, free-form + suggested tags, screenshot upload (Supabase Storage), outcome filtering.
- **Transactions** — deposit/withdrawal/profit/loss CRUD with optimistic updates.
- **Undo / Redo** — backed by an append-only `AuditLog`, so it survives reloads and works across devices.
- **CSV import** — upload → preview → per-row validation → confirm → rollback, recorded in `ImportHistory`.
- **Snapshot engine** — charts always render from `PortfolioSnapshot`, recomputed atomically with every mutation (never from raw transactions at read time).
- **Responsive** — sidebar (desktop), collapsible (tablet), bottom nav (mobile). Dark mode default with a golden/charcoal financial palette.

## Architecture map

```
src/
├─ app/
│  ├─ (app)/            # authed route group (sidebar shell)
│  │  ├─ page.tsx          dashboard
│  │  ├─ analytics/        charts + tables
│  │  ├─ journal/          trading journal
│  │  └─ settings/         preferences + data
│  ├─ api/              route handlers (transactions, journal, metrics,
│  │                    snapshots, import, export, settings, undo/redo)
│  ├─ auth/             OAuth callback + signout
│  └─ login/            Google sign-in
├─ components/          ui (shadcn), layout, dashboard, charts, journal,
│                       transactions, analytics, modals
├─ hooks/               React Query data hooks
├─ stores/              Zustand UI store
├─ lib/
│  ├─ calc/portfolio.ts    canonical formulas + snapshot derivation
│  ├─ db/                  prisma client, audit engine, snapshot engine, serializers
│  ├─ supabase/            browser / server / proxy clients
│  ├─ validations/         shared Zod schemas (client + server)
│  ├─ format.ts            INR / % / date formatting
│  └─ auth.ts              user resolution + Supabase→Prisma sync
├─ types/               shared DTOs and metrics types
└─ proxy.ts             session refresh + route protection (Next 16 "proxy")
prisma/
├─ schema.prisma        7 models, enums, indexes, Decimal money
├─ migrations/          generated init migration
└─ seed.ts              ~6 months of demo data
```

## Prerequisites

- Node.js 20+
- A Supabase project (free tier works) — provides Postgres + Auth + Storage

## 1. Install

```bash
npm install
```

## 2. Environment variables

Copy the example and fill in your Supabase values:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `DATABASE_URL` | Supabase → Connect → ORMs → "Transaction" pooler URL (port 6543, append `?pgbouncer=true`) — used at runtime |
| `DIRECT_URL` | Supabase → Connect → "Session" / direct URL (port 5432) — used by migrations |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` in dev; your domain in prod |

## 3. Supabase setup

1. **Database** — already provisioned with your project. Run the migration:
   ```bash
   npm run db:deploy      # applies prisma/migrations to your DB
   # or, for iterative dev:
   npm run db:migrate
   ```
2. **Google OAuth** — Supabase → Authentication → Providers → Google → enable.
   - Create OAuth credentials in Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web application).
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Paste the Client ID + Secret into Supabase.
   - Supabase → Authentication → URL Configuration → add `http://localhost:3000/auth/callback` and your production `…/auth/callback` to the redirect allow-list.
3. **Storage** — create a public bucket named `journal` (Supabase → Storage → New bucket → Public). Used for trade screenshots.

## 4. Seed demo data (optional)

```bash
npm run db:seed
```

Creates a `demo@portfolio.local` user with ~6 months of transactions, 40 journal
entries, and pre-built snapshots. (Sign-in is via Google; the seed user is for
inspecting data in `npm run db:studio`.)

## 5. Run

```bash
npm run dev
# http://localhost:3000  → redirects to /login → Continue with Google
```

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (CI/prod) |
| `npm run db:studio` | Prisma Studio data browser |
| `npm run db:seed` | Insert demo data |

## Portfolio math (single source of truth)

Defined in `src/lib/calc/portfolio.ts` and mirrored in `.claude/skills/portfolio-calculations`:

- **Current Value** = Deposits + Profits − Losses − Withdrawals
- **Net P&L** = Profits − Losses
- **Return %** = (Net P&L / Total Deposits) × 100 (0 when no deposits)
- Plus daily/weekly/monthly P&L, max drawdown, peak/lowest equity, average profit/loss, win rate, profit factor, recovery factor, risk/reward.

## Deployment (Vercel)

1. Push to GitHub and import the repo into Vercel.
2. Add all environment variables (from `.env`) in Vercel → Settings → Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to your Vercel domain.
3. Build command is `npm run build` (runs `prisma generate` automatically); output is the default Next.js build.
4. Run migrations against your Supabase DB once: `npm run db:deploy` (locally with prod `DIRECT_URL`, or as a deploy hook).
5. Add your Vercel domain's `…/auth/callback` to Supabase's redirect allow-list and your Google OAuth authorized origins.

## Notes on AI-assisted structure

`.claude/` contains specialized subagent definitions (`database-architect`,
`backend-api`, `frontend-ui`, `chart-specialist`) and a `portfolio-calculations`
skill that encodes the financial formulas so every layer stays consistent.
