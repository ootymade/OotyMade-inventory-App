import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, SegmentedControl } from '../../components/ui.jsx'
import ShopifyOrderList from '../shopify/ShopifyOrderList.jsx'
import DirectOrderList from './DirectOrderList.jsx'

// Interim merged Orders destination (Stage 2b) — Shopify and Direct orders
// are still two separate tables/screens/status columns under the hood
// (unifying that is Stage 2c), but staff now reach both from one tab via
// a channel switch instead of two separate places. Each embedded list
// keeps its own existing behavior untouched (search, status tabs, refresh,
// admin controls) — this just arranges them under one shared header.
const CHANNELS = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'direct', label: 'Direct' },
]

export default function OrdersHub() {
  const [params, setParams] = useSearchParams()
  const [channel, setChannel] = useState(params.get('channel') === 'direct' ? 'direct' : 'shopify')

  const setChannelAndParam = (v) => {
    setChannel(v)
    const next = new URLSearchParams(params)
    next.set('channel', v)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader title="Orders" />
      <div className="px-4 pt-3">
        <SegmentedControl options={CHANNELS} value={channel} onChange={setChannelAndParam} />
      </div>
      {channel === 'shopify' ? <ShopifyOrderList embedded /> : <DirectOrderList embedded />}
    </div>
  )
}
