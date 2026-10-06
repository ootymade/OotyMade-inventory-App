// One-off, read-only investigation: for every order already in
// shopify_orders, fetch its live payment transactions from Shopify and
// report financial-status/gateway breakdowns, so the payment_hold rule can
// be set from evidence instead of a guess about what AUTHORIZED means.
// Writes nothing — not to shopify_orders, not anywhere else. Admin-only
// (checked explicitly below, not just verify_jwt) since this is a
// diagnostic tool, not part of the normal sync/webhook path.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { adminClient, shopifyGraphql, getSyncSettings, parseOrderNumber, CORS_HEADERS } from '../_shared/shopify.ts'

const QUERY = `
  query OrderPayments($id: ID!) {
    order(id: $id) {
      displayFinancialStatus
      displayFulfillmentStatus
      transactions(first: 10) {
        kind
        status
        gateway
      }
    }
  }
`

// Same self-imposed budget as shopify-sync-orders, for the same reason:
// stop cleanly well short of the platform's hard kill so there's always a
// real, parseable result instead of a dead connection.
const DEADLINE_MS = 100_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not signed in' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = adminClient()
    const { data: caller } = await supabase.from('team_members').select('role').eq('id', userData.user.id).maybeSingle()
    if (caller?.role !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'Admin only' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { firstOrderNumber } = await getSyncSettings(supabase)

    const { data: allOrders, error: ordersError } = await supabase
      .from('shopify_orders')
      .select('shopify_order_id, order_number')
    if (ordersError) throw ordersError

    // Scoped to the same cutoff as the sync/webhook — orders below #16600
    // are out of scope for this integration entirely, diagnostics included.
    const orders = (allOrders ?? []).filter((o) => {
      const n = parseOrderNumber(o.order_number ?? '')
      return n === null || n >= firstOrderNumber
    })

    const byFinancialStatus: Record<string, number> = {}
    const byGateway: Record<string, number> = {}
    const authorizedOrders: { orderNumber: string; captured: boolean; transactions: unknown[] }[] = []
    const fulfilledStillAuthorized: { orderNumber: string; captured: boolean; transactions: unknown[] }[] = []
    let checked = 0
    let failed = 0
    let partial = false
    const startedAt = Date.now()

    for (const o of orders) {
      if (Date.now() - startedAt > DEADLINE_MS) {
        partial = true
        break
      }
      let data
      try {
        data = await shopifyGraphql(supabase, QUERY, { id: o.shopify_order_id })
      } catch (err) {
        failed++
        console.error(`shopify-payment-diagnostics: failed to fetch ${o.order_number}:`, err instanceof Error ? err.message : err)
        continue
      }
      const order = data.order
      if (!order) {
        failed++
        continue
      }
      checked++

      const finStatus = order.displayFinancialStatus as string
      byFinancialStatus[finStatus] = (byFinancialStatus[finStatus] ?? 0) + 1

      const txns = (order.transactions ?? []) as { kind: string; status: string; gateway: string }[]
      const primaryGateway = txns[0]?.gateway ?? 'none'
      byGateway[primaryGateway] = (byGateway[primaryGateway] ?? 0) + 1

      if (finStatus === 'AUTHORIZED') {
        const captured = txns.some((t) => ['CAPTURE', 'SALE'].includes(t.kind) && t.status === 'SUCCESS')
        const entry = { orderNumber: o.order_number, captured, transactions: txns }
        authorizedOrders.push(entry)
        if (order.displayFulfillmentStatus === 'FULFILLED') {
          fulfilledStillAuthorized.push(entry)
        }
      }
    }

    const report = {
      ok: true,
      partial,
      totalOrders: orders.length,
      checked,
      failed,
      byFinancialStatus,
      byGateway,
      authorizedCount: authorizedOrders.length,
      authorizedCaptured: authorizedOrders.filter((o) => o.captured).length,
      authorizedNotCaptured: authorizedOrders.filter((o) => !o.captured).length,
      fulfilledStillAuthorizedCount: fulfilledStillAuthorized.length,
      fulfilledStillAuthorizedCaptured: fulfilledStillAuthorized.filter((o) => o.captured).length,
      authorizedOrders,
      fulfilledStillAuthorized,
    }

    // Full detail (including per-order transaction kind/status/gateway) goes
    // to the function log, not just the summary in the response body.
    console.log('shopify-payment-diagnostics report:', JSON.stringify(report))

    return new Response(JSON.stringify(report), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('shopify-payment-diagnostics failed:', err instanceof Error ? err.message : err)
    return new Response(JSON.stringify({ ok: false, error: 'Diagnostics failed' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
