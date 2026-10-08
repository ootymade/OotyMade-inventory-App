// Disabled — this was a one-off cleanup tool used during Shopify-integration
// verification. Left deployed (no delete-function API) but inert.
//
// verify_jwt: true (intended and live) — irrelevant in practice since the
// handler below refuses every request regardless, but left on rather than
// loosened for a function nobody should be calling at all.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
Deno.serve(() => new Response('Disabled', { status: 410 }))
