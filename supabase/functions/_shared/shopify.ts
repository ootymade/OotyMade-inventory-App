// Shared Shopify Admin API client-credentials helper + idempotent order
// upsert. Used by shopify-sync-orders (backfill / manual refresh / polling)
// and shopify-webhook (orders/create, orders/updated) so there is exactly
// one code path that talks to Shopify and exactly one that writes
// shopify_orders — this never touches `products` quantities.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const API_VERSION = '2026-10'

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function fetchNewToken(domain: string, clientId: string, clientSecret: string) {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) {
    // Never include the response body — it can echo back request params.
    throw new Error(`Shopify OAuth token request failed with status ${res.status}`)
  }
  const body = await res.json()
  return { accessToken: body.access_token as string, expiresIn: body.expires_in as number }
}

// Returns a valid access token, reusing the cached one while it still has
// more than 2 minutes left, otherwise fetching and caching a fresh one.
// client_credentials tokens are valid ~24h. The token is never logged.
export async function getAccessToken(supabase: SupabaseClient): Promise<string> {
  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN')!
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID')!
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET')!

  const { data: cached } = await supabase
    .from('shopify_token_cache')
    .select('access_token, expires_at')
    .eq('id', true)
    .maybeSingle()

  if (cached && new Date(cached.expires_at).getTime() - Date.now() > 2 * 60 * 1000) {
    return cached.access_token as string
  }

  const { accessToken, expiresIn } = await fetchNewToken(domain, clientId, clientSecret)
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  await supabase.from('shopify_token_cache').upsert({ id: true, access_token: accessToken, expires_at: expiresAt })

  return accessToken
}

export async function shopifyGraphql(supabase: SupabaseClient, query: string, variables?: Record<string, unknown>) {
  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN')!
  const token = await getAccessToken(supabase)

  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  })

  const json = await res.json()
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`)
  }
  return json.data
}

export const ORDER_FIELDS = `
  id
  name
  createdAt
  updatedAt
  cancelledAt
  displayFinancialStatus
  displayFulfillmentStatus
  currencyCode
  email
  phone
  tags
  note
  shippingAddress { name address1 address2 city province zip country phone }
  billingAddress { name address1 address2 city province zip country phone }
  subtotalPriceSet { shopMoney { amount } }
  totalTaxSet { shopMoney { amount } }
  totalPriceSet { shopMoney { amount } }
  lineItems(first: 50) {
    edges {
      node {
        id
        sku
        title
        variantTitle
        quantity
        unfulfilledQuantity
        originalUnitPriceSet { shopMoney { amount } }
      }
    }
  }
`

export const GET_ORDER_QUERY = `
  query GetOrder($id: ID!) {
    order(id: $id) { ${ORDER_FIELDS} }
  }
`

const WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED']

// Idempotently makes sure our orders/create + orders/updated webhooks are
// registered, pointing at this project's shopify-webhook function. Safe to
// call on every sync — skips topics that are already registered correctly.
export async function ensureWebhooks(supabase: SupabaseClient) {
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')!}/functions/v1/shopify-webhook`

  const existing = await shopifyGraphql(
    supabase,
    `query ExistingWebhooks($topics: [WebhookSubscriptionTopic!]) {
      webhookSubscriptions(first: 20, topics: $topics) { edges { node { id topic uri } } }
    }`,
    { topics: WEBHOOK_TOPICS },
  )
  const have = new Set(
    (existing.webhookSubscriptions.edges as any[])
      .filter((e) => e.node.uri === callbackUrl)
      .map((e) => e.node.topic),
  )

  for (const topic of WEBHOOK_TOPICS) {
    if (have.has(topic)) continue
    const result = await shopifyGraphql(
      supabase,
      `mutation EnsureWebhook($topic: WebhookSubscriptionTopic!, $uri: String!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { uri: $uri, format: JSON }) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      { topic, uri: callbackUrl },
    )
    const errors = result.webhookSubscriptionCreate.userErrors
    if (errors?.length) {
      console.error(`ensureWebhooks: couldn't register ${topic}:`, JSON.stringify(errors))
    }
  }
}

// Maps one Shopify Order node (GraphQL shape above) into shopify_orders +
// shopify_order_items, matched to the existing catalog via shopify_sku_map
// (admin-confirmed) or, failing that, an exact SKU match. Idempotent on
// shopify_order_id, so re-delivering the same webhook or re-running a
// backfill never duplicates a row. SKUs with no mapping are left unmapped
// (product_id null) rather than failing the sync.
export async function upsertOrder(supabase: SupabaseClient, node: any): Promise<string> {
  const row = {
    shopify_order_id: node.id,
    order_number: node.name ?? '',
    shopify_created_at: node.createdAt,
    shopify_updated_at: node.updatedAt,
    cancelled_at: node.cancelledAt,
    financial_status: node.displayFinancialStatus ?? '',
    fulfillment_status: node.displayFulfillmentStatus ?? '',
    currency: node.currencyCode ?? 'INR',
    customer_name: node.shippingAddress?.name ?? '',
    customer_phone: node.phone ?? node.shippingAddress?.phone ?? '',
    customer_email: node.email ?? '',
    shipping_address: node.shippingAddress ?? null,
    billing_address: node.billingAddress ?? null,
    subtotal_price: Number(node.subtotalPriceSet?.shopMoney?.amount ?? 0),
    total_tax: Number(node.totalTaxSet?.shopMoney?.amount ?? 0),
    total_price: Number(node.totalPriceSet?.shopMoney?.amount ?? 0),
    tags: (node.tags ?? []).join(', '),
    note: node.note ?? '',
    raw: node,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: order, error } = await supabase
    .from('shopify_orders')
    .upsert(row, { onConflict: 'shopify_order_id' })
    .select('id')
    .single()
  if (error) throw error

  const items = (node.lineItems?.edges ?? []).map((e: any) => e.node)
  for (const li of items) {
    let productId: string | null = null
    if (li.sku) {
      // An admin-confirmed mapping always wins (Shopify and this catalog
      // don't share a SKU format) — fall back to an exact SKU match only
      // if the two ever happen to line up for a given product.
      const { data: mapping } = await supabase.from('shopify_sku_map').select('product_id').eq('shopify_sku', li.sku).maybeSingle()
      if (mapping) {
        productId = mapping.product_id
      } else {
        const { data: product } = await supabase.from('products').select('id').eq('sku', li.sku).maybeSingle()
        productId = product?.id ?? null
      }
    }
    const { error: itemError } = await supabase.from('shopify_order_items').upsert(
      {
        order_id: order.id,
        shopify_line_item_id: li.id,
        sku: li.sku ?? '',
        title: li.title ?? '',
        variant_title: li.variantTitle ?? '',
        quantity: li.quantity ?? 0,
        unfulfilled_quantity: li.unfulfilledQuantity ?? 0,
        unit_price: Number(li.originalUnitPriceSet?.shopMoney?.amount ?? 0),
        product_id: productId,
      },
      { onConflict: 'order_id,shopify_line_item_id' },
    )
    if (itemError) throw itemError
  }

  await supabase.from('shopify_sync_ping').update({ last_synced_at: new Date().toISOString() }).eq('id', true)

  return order.id as string
}
