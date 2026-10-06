// Read-only Shopify order sync. Called by the app's manual "Refresh" button
// and by a periodic client-side poll while the Shopify Orders screen is
// open (polling fallback for when a webhook is missed). Also ensures our
// webhook subscriptions exist. Fetches the most recently updated orders and
// idempotently upserts them — never writes to `products`, never creates a
// Shopify fulfillment. Requires a valid Supabase session (verify_jwt stays
// on), so only signed-in team members can trigger it.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { adminClient, shopifyGraphql, upsertOrder, ensureWebhooks, ORDER_FIELDS, InvalidShopifyDomainError } from '../_shared/shopify.ts'

const QUERY = `
  query RecentOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges { node { ${ORDER_FIELDS} } }
    }
  }
`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 })
  }

  try {
    const supabase = adminClient()
    const webhooksRegistered = await ensureWebhooks(supabase)
    let fetched = 0
    let created = 0
    let updated = 0
    let after: string | null = null
    // One page (50) is enough for a day-to-day poll/manual refresh; a cold
    // backfill on a quiet store like this one finishes within a few pages.
    const maxPages = 5

    for (let page = 0; page < maxPages; page++) {
      const data = await shopifyGraphql(supabase, QUERY, { first: 50, after })
      const edges = data.orders.edges as any[]
      for (const edge of edges) {
        const result = await upsertOrder(supabase, edge.node)
        fetched++
        if (result.created) created++
        else updated++
      }
      if (!data.orders.pageInfo.hasNextPage) break
      after = data.orders.pageInfo.endCursor
    }

    return new Response(JSON.stringify({ ok: true, fetched, created, updated, webhooksRegistered }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('shopify-sync-orders failed:', err instanceof Error ? err.message : err)
    // The domain-format error names a non-sensitive config value, so it's
    // safe (and useful) to return verbatim — every other error stays generic.
    const message = err instanceof InvalidShopifyDomainError ? err.message : 'Sync failed'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
