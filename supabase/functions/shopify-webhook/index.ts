// Receives Shopify's orders/create and orders/updated webhooks. Verifies
// the HMAC signature first — nothing else runs on an unverified request.
// The webhook body itself is only used to find *which* order changed; the
// actual data always comes from a fresh GraphQL fetch of that one order
// (same shape, same upsertOrder as the manual-refresh/polling path), so
// there's exactly one mapping from Shopify's data into shopify_orders no
// matter which path triggered it. verify_jwt is OFF for this function —
// Shopify calls it directly with no Supabase session, authenticating via
// HMAC instead.
//
// verify_jwt: false (intended and live) — HMAC is the only gate.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { adminClient, shopifyGraphql, upsertOrder, getSyncSettings, GET_ORDER_QUERY } from '../_shared/shopify.ts'

async function verifyHmac(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)))
  if (computed.length !== header.length) return false
  // Constant-time compare.
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Use POST', { status: 405 })
  }

  const rawBody = await req.text()
  const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256')
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET')!

  const valid = await verifyHmac(rawBody, hmacHeader, secret)
  if (!valid) {
    console.error('shopify-webhook: HMAC verification failed')
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody)
    const orderGid: string | undefined =
      payload.admin_graphql_api_id ?? (payload.id ? `gid://shopify/Order/${payload.id}` : undefined)

    if (!orderGid) {
      return new Response(JSON.stringify({ ok: false, error: 'No order id in payload' }), { status: 400 })
    }

    const supabase = adminClient()
    const { firstOrderNumber } = await getSyncSettings(supabase)
    const data = await shopifyGraphql(supabase, GET_ORDER_QUERY, { id: orderGid })
    if (data.order) {
      await upsertOrder(supabase, data.order, firstOrderNumber)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('shopify-webhook failed:', err instanceof Error ? err.message : err)
    // Still 200 on our own processing error so Shopify doesn't treat a bug
    // on our side as reason to disable the webhook — the next poll/webhook
    // delivery will retry this order anyway since upserts are idempotent.
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }
})
