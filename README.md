# Zoca AM Transition

Live dashboard for tracking AM transitions across the active customer book (~927 customers, 13 AMs, 5 pods). Mirrors the architecture of [`zoca-performance-report`](https://zoca-performance-report.vercel.app).

## Stack
- Next.js 14 (App Router) · TypeScript · Tailwind
- Reads live from Metabase Dataset API (`POST /api/dataset` with `x-api-key`)
- BaseSheet via the public Metabase CSV endpoint (no auth)
- Vercel deployment

## Phase 1 (this version)

Read-only dashboard. Pulls all data live from Metabase per request:
- Active customers (`BaseSheet` public CSV)
- Composite health (`cx.health_score_snapshots`)
- Open tickets (`cx.open_issues`)
- Comms summary (`cx.communication_summary`)
- Existing handover brief (`cx.handover_brief`)
- Product usage (`mixpanelzocaappdata.export`)
- Performance: leads, click trend, rankings, reviews
- GBP audit (`entities.location_insights.gbp_audit`)

Moving To assignments live in browser localStorage (single-user). Phase 2 wires Vercel Postgres for shared state.

## Quick start

```bash
git clone https://github.com/<your-org>/zoca-am-transition.git
cd zoca-am-transition
npm install
cp .env.example .env.local
# add your METABASE_API_KEY
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

| Var | Where used | Default |
|---|---|---|
| `METABASE_API_KEY` | `lib/metabase.ts` (sent as `x-api-key` header) | required |
| `METABASE_BASE_URL` | `lib/metabase.ts` | `https://metabase.zoca.ai` |

## Deploy to Vercel

```bash
git push origin main
```

In Vercel: connect the GitHub repo, set both env vars (Production, Preview, Development), and deploy. Auto-detects as Next.js.

## Project layout

```
app/
  layout.tsx
  page.tsx                # renders <Dashboard />
  globals.css
  api/customers/route.ts  # /api/customers — composes the full dataset
components/
  Dashboard.tsx           # the entire dashboard UI (client component)
lib/
  metabase.ts             # Dataset API client (POST /api/dataset, x-api-key)
  basesheet.ts            # BaseSheet public-CSV fetcher + parser
  queries.ts              # All SQL strings (mirrors prep_metabase.py)
  fetchers.ts             # 13 typed fetchers, one per data source
  compose.ts              # Per-customer enrichment & risk derivation
  pods.ts                 # AM list + Pod 1–5 mapping (Taanya in Pod 4)
  types.ts                # Shared TypeScript shapes
```

## Data flow

1. Browser hits `/`.
2. `<Dashboard />` calls `/api/customers`.
3. The API route runs `composeDataset()`:
   - Fetch BaseSheet CSV → filter to 927 active customers under the 13 active AMs
   - Run 13 Metabase queries in parallel against the entity_id list
   - Merge and derive (engagement tier, dip%, risks, dormant flag, pod)
4. Returns JSON to the browser.
5. Dashboard renders table + filters + drill-in panel.

Cold response time ≈ 5–8 seconds (limited by the slowest Metabase query — usually mixpanel or rankings). Vercel caches per route at 5-minute granularity.

## Pods

Hardcoded in `lib/pods.ts` because pods aren't yet a field in any Zoca data system. Mapping:

- **Pod 1**: Kanak sharma · Sudha Goutami · Santhosh V
- **Pod 2**: Hubern C · Sakshi Mamgain
- **Pod 3**: Bikash Mishra · Anu Srivastava
- **Pod 4**: Apurvaa Biswas · Atharv Y · Shruti Sinha · Taanya Solanki *(incoming)*
- **Pod 5**: Siddhi Shetty · Kripali Suri
- **Floating**: Nikita Singh

When pods land in a data system, replace `podForAm()` with a query.

## Roadmap

- **Phase 2**: Vercel Postgres for transition state (`Moving To`, `Handoff Status`, notes) — shared across users with audit log
- **Phase 3**: On-demand exports — `/api/customer/<eid>/brief.docx`, `/api/am/<am>/deck.pptx`, `/api/export/tracker.xlsx`
- **Phase 4**: Auth (NextAuth + Google SSO restricted to Zoca workspace)
- **Pods integration**: replace hardcoded mapping with a live query when pods land in BaseSheet/Metabase

## Related projects

- [`zoca-performance-report`](https://zoca-performance-report.vercel.app) — per-customer SEO + growth report. The `Performance` section in this dashboard mirrors that project's data logic exactly (no parallel definitions, no drift).
