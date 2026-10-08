// Read-only Shopify order sync. Called by the app's manual "Refresh" button
// and by a periodic client-side poll while the Shopify Orders screen is
// open (polling fallback for when a webhook is missed). Also ensures our
// webhook subscriptions exist. Fetches the most recently updated orders and
// idempotently upserts them — never writes to `products`, never creates a
// Shopify fulfillment. Requires a valid Supabase session (verify_jwt stays
// on), so only signed-in team members can trigger it.
//
// verify_jwt: true (intended and live).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  adminClient,
  shopifyGraphql,
  upsertOrder,
  ensureWebhooks,
  getSyncSettings,
  getCallerTeamMember,
  ORDER_FIELDS,
  InvalidShopifyDomainError,
  CORS_HEADERS,
} from '../_shared/shopify.ts'

const QUERY = `
  query RecentOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges { node { ${ORDER_FIELDS} } }
    }
  }
`

// Supabase Edge Functions are killed at a hard wall-clock limit (observed
// around 150s, returned as a 546/504 with no body this function ever gets
// to produce). A sync over a large backlog can genuinely take longer than
// that, so this stops itself well short of the hard limit and returns
// whatever it has as a clean, parseable partial result — the next
// Refresh (or the next poll) picks up where this one left off, since
// upserts are idempotent and sorted newest-updated-first.
const DEADLINE_MS = 100_000

Deno.serve(async (req: Request) => {
  // The browser sends this before the real POST (different origin, custom
  // headers) and never attaches auth to it, so it must be answered here,
  // before anything else, with no auth check.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // verify_jwt only proves this is *some* signed-in Supabase session, not
  // one of our team members. The Refresh button and the background poll
  // are both open to any team member, admin or staff, so this only checks
  // membership, not role.
  const caller = await getCallerTeamMember(req)
  if (!caller) {
    return new Response(JSON.stringify({ ok: false, error: 'Not a team member' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  let fetched = 0
  let created = 0
  let updated = 0
  let skipped = 0
  let webhooksRegistered: string[] = []
  let partial = false

  try {
    const supabase = adminClient()
    webhooksRegistered = await ensureWebhooks(supabase)
    const { firstOrderNumber, cutoffDate } = await getSyncSettings(supabase)
    // Efficiency only — Shopify's `name:` search can't do a numeric ">="
    // comparison, so this just keeps a cold backfill from paging through
    // years of pre-cutoff orders. upsertOrder's numeric check is what
    // actually enforces the cutoff, regardless of whether this is set.
    const shopifyQuery = cutoffDate ? `created_at:>=${cutoffDate}` : undefined

    let after: string | null = null
    // One page (50) is enough for a day-to-day poll/manual refresh; a cold
    // backfill on a quiet store like this one finishes within a few pages,
    // the deadline check below covers the rest.
    const maxPages = 5

    pageLoop: for (let page = 0; page < maxPages; page++) {
      const data = await shopifyGraphql(supabase, QUERY, { first: 50, after, query: shopifyQuery })
      const edges = data.orders.edges as any[]
      for (const edge of edges) {
        const result = await upsertOrder(supabase, edge.node, firstOrderNumber)
        if ('skipped' in result) {
          skipped++
        } else {
          fetched++
          if (result.created) created++
          else updated++
        }
        if (Date.now() - startedAt > DEADLINE_MS) {
          partial = true
          break pageLoop
        }
      }
      if (!data.orders.pageInfo.hasNextPage) break
      after = data.orders.pageInfo.endCursor
    }

    return new Response(JSON.stringify({ ok: true, partial, fetched, created, updated, skipped, webhooksRegistered }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('shopify-sync-orders failed:', err instanceof Error ? err.message : err)
    // The domain-format error names a non-sensitive config value, so it's
    // safe (and useful) to return verbatim — every other error stays generic.
    const message = err instanceof InvalidShopifyDomainError ? err.message : 'Sync failed'
    return new Response(
      JSON.stringify({ ok: false, error: message, fetched, created, updated, skipped, webhooksRegistered }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  }
})
