# Ooty Inventory

A mobile-first inventory management PWA for a small (~6 person) team, with a
shared live backend so every phone sees the same data.

## Stack

- **React + Vite**, Tailwind CSS v4 (mobile-first, large tap targets)
- **Supabase**: Postgres + Auth + Row Level Security + Realtime, wrapped
  behind a single data-access module (`src/db/storage.js`) so no screen
  talks to Supabase directly. A few server-side Edge Functions (see below)
  handle the Shopify integration.
- **PWA**: manifest + service worker (via `vite-plugin-pwa`) for offline use
  and "Add to Home Screen"
- **Scanning**: [html5-qrcode](https://github.com/mebjas/html5-qrcode) for
  camera barcode/QR scanning, [qrcode.react](https://github.com/zpao/qrcode.react)
  to generate/print per-product QR labels

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

Open the dev/preview URL on your phone (same Wi-Fi) to test on a real device,
or use Chrome DevTools' device toolbar for a quick mobile preview. The app
needs a real Supabase project (see `src/db/supabaseClient.js`) — there's no
offline/local-only mode anymore.

## Sign-in and roles

Each team member has a real Supabase Auth account tied to a row in
`team_members`, which carries their display name and an `admin`/`staff`
access level — `admin` unlocks revenue/cost figures and a handful of
settings screens; everyone else shares the same inventory/orders access.
There's no shared/anonymous login.

## Project layout

```
src/
  db/
    supabaseClient.js  Supabase client setup
    storage.js         All data access — the only file screens talk to
  context/             Auth + team-member (current user) + toast providers
  components/          Shared UI primitives (ui.jsx) + icons + bottom nav
  screens/             One folder per feature area (products, stock,
                       orders, shopify, tracking, po, suppliers, settings)
supabase/
  schema.sql           Baseline schema reference (not auto-synced — see
                       manual-sql/ below for what's actually been applied)
  manual-sql/          Hand-run SQL changes against the live project,
                       numbered/blocked for the Supabase SQL Editor
  functions/           Edge Functions (see below)
```

## Supabase Edge Functions

### How they're deployed

There is no `supabase/config.toml` in this repo and no CI workflow that deploys
functions (`.github/workflows/` only deploys the frontend to GitHub Pages).
Every function so far has been deployed directly via the Supabase MCP server's
`deploy_edge_function` tool during a Claude Code session — a direct call to
Supabase's Management API, not the `supabase` CLI.

This matters for `verify_jwt`: the CLI's `functions deploy` reads
`[functions.<slug>] verify_jwt = ...` from `config.toml`. The MCP tool does
not read that file at all — `verify_jwt` is a required parameter on the
deploy call itself, set explicitly every time a function is created or
redeployed. A `config.toml` would do nothing on this project's actual deploy
path and would risk looking authoritative while silently not being applied —
so the source of truth for intent lives here and in each function's own
header comment instead, and the MCP tool's `verify_jwt` parameter being
required (not optional, no implicit default relied on) is what makes "pass
it explicitly" enforced in practice: there's no way to call that tool without
stating true or false.

If deploys ever move to the CLI/CI, a `config.toml` should be introduced at
that point and this table kept in sync with it.

### Intended vs. live `verify_jwt`, per function

Live values below were read from the project on 2026-10-08 via
`list_edge_functions`.

| Function | Source in repo | Intended `verify_jwt` | Live `verify_jwt` | Match |
|---|---|---|---|---|
| `shopify-sync-orders` | `supabase/functions/shopify-sync-orders/` | `true` — requires a signed-in team member | `true` | ✅ |
| `shopify-webhook` | `supabase/functions/shopify-webhook/` | `false` — Shopify calls it with no Supabase session; HMAC signature is the only gate | `false` | ✅ |
| `shopify-payment-diagnostics` | `supabase/functions/shopify-payment-diagnostics/` | `true` — still actively called by the Shopify Orders screen's admin-only "Run payment diagnostics" button | `true` | ✅ |
| `cleanup-test-data` | `supabase/functions/cleanup-test-data/` | `true` — moot; the handler itself refuses every request (`410`) regardless of auth | `true` | ✅ |

All four currently match. If you ever see a mismatch here, something was
redeployed without checking this table first — fix the deploy, then fix this
table.

### Functions that should not be in normal use

- **`cleanup-test-data`** — a one-off tool from Shopify-integration testing.
  Supabase's tools available in this session have no "delete function" call,
  so it can't be removed outright; its code has been replaced with a stub
  that returns `410 Gone` for every request. It is disabled in place, not
  gone — don't redeploy real logic to this slug.
- **`shopify-payment-diagnostics`** — built as a one-off, read-only
  investigation to settle what `payment_hold` should check. It is **not** an
  orphan today: it's still wired to a live admin-only button on the Shopify
  Orders screen (`runShopifyPaymentDiagnostics()` in `src/db/storage.js`).
  Don't disable it without first removing that button and its call site.
