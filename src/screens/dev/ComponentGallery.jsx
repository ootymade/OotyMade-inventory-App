import { useState } from 'react'
import {
  PageHeader,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  Badge,
  StatusBadge,
  EmptyState,
  Skeleton,
  AdminOnly,
  SegmentedControl,
  SearchBox,
  Sheet,
} from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { BoxIcon, SyncIcon } from '../../components/icons.jsx'

const NEUTRAL_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
const ACCENT_SHADES = ['50', '100', '400', '500', '600', '700', '900']

function Section({ title, sub, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

export default function ComponentGallery() {
  const { push } = useToast()
  const [segValue, setSegValue] = useState('a')
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="space-y-8 px-4 pb-8 pt-4">
      <PageHeader title="Component gallery" subtitle="Stage 2a — temporary, admin-only, removed later" back />

      <AdminOnly
        fallback={<EmptyState title="Admins only" subtitle="This page is a temporary design-review tool." />}
      >
        <div className="space-y-8">
          <div className="rounded-[var(--radius-md)] border border-brand-100 bg-brand-50 p-4 text-sm text-slate-600">
            Mock content only — every component here reads no real data. This whole screen and its route are
            removed once Stage 2a is approved.
          </div>

          <Section title="Color tokens" sub="Neutral scale (stone) + the one swappable accent (emerald placeholder).">
            <div className="flex flex-wrap gap-2">
              {NEUTRAL_SHADES.map((s) => (
                <div key={s} className="w-16 text-center">
                  <div
                    className="h-10 rounded-[var(--radius-sm)] border border-slate-200"
                    style={{ background: `var(--color-slate-${s})` }}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">slate-{s}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SHADES.map((s) => (
                <div key={s} className="w-16 text-center">
                  <div
                    className="h-10 rounded-[var(--radius-sm)]"
                    style={{ background: `var(--color-brand-${s})` }}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">brand-{s}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Typography" sub="System font only. Every input/button is 16px+.">
            <div className="divide-y divide-slate-100 rounded-[var(--radius-lg)] bg-white p-4 shadow-sm">
              <p className="py-2 text-2xl font-extrabold">Heading — text-2xl</p>
              <p className="py-2 text-lg font-bold">Subheading — text-lg</p>
              <p className="py-2 text-base">Body — text-base (16px)</p>
              <p className="py-2 text-sm text-slate-500">Secondary — text-sm (14px, non-actionable only)</p>
              <p className="py-2 text-xs text-slate-400">Caption — text-xs (12px, non-actionable only)</p>
            </div>
          </Section>

          <Section title="Buttons">
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="icon" variant="outline" aria-label="Sync">
                <SyncIcon className="h-5 w-5" />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </Section>

          <Section title="Inputs">
            <div className="max-w-sm space-y-3">
              <Field label="Text input">
                <Input placeholder="e.g. Priya Raman" />
              </Field>
              <Field label="Select">
                <Select defaultValue="">
                  <option value="" disabled>
                    Pick a courier…
                  </option>
                  <option>Blue Dart</option>
                  <option>India Post</option>
                </Select>
              </Field>
              <Field label="Textarea">
                <Textarea rows={2} placeholder="Add a note…" />
              </Field>
            </div>
          </Section>

          <Section title="Card & stat tile">
            <div className="grid max-w-sm grid-cols-2 gap-3">
              <Card className="!p-4">
                <p className="text-xs font-medium text-slate-400">Total products</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">112</p>
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-medium text-slate-400">Low stock</p>
                <p className="mt-1 text-2xl font-bold text-danger-600">4</p>
              </Card>
            </div>
          </Section>

          <Section title="Badge" sub="Generic badge — no dot by default.">
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">Slate</Badge>
              <Badge tone="brand">Brand</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="warn">Warn</Badge>
              <Badge tone="ok">Ok</Badge>
            </div>
          </Section>

          <Section
            title="StatusBadge"
            sub="One shared vocabulary for Shopify, Direct and Purchase order status — mapped from the existing database values below, nothing stored changed."
          >
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Shopify (workflow_status)</p>
                <div className="flex flex-wrap gap-2">
                  {['new', 'packing', 'packed', 'shipped', 'delivered'].map((v) => (
                    <StatusBadge key={v} kind="shopify" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Direct orders (invoices.status)</p>
                <div className="flex flex-wrap gap-2">
                  {['draft', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((v) => (
                    <StatusBadge key={v} kind="direct" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Purchase orders (purchase_orders.status)</p>
                <div className="flex flex-wrap gap-2">
                  {['draft', 'ordered', 'partially_received', 'received'].map((v) => (
                    <StatusBadge key={v} kind="po" value={v} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="SegmentedControl" sub="Replaces the 4 hand-rolled pill/tab rows (PO, Shopify, Daily Orders, Stock In/Out).">
            <SegmentedControl
              options={[
                { value: 'a', label: 'All' },
                { value: 'b', label: 'New' },
                { value: 'c', label: 'Packing' },
                { value: 'd', label: 'Packed' },
              ]}
              value={segValue}
              onChange={setSegValue}
            />
          </Section>

          <Section title="SearchBox" sub="Replaces the 4 duplicated search-input blocks.">
            <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU" className="max-w-sm" />
          </Section>

          <Section title="EmptyState">
            <EmptyState icon={<BoxIcon className="h-10 w-10" />} title="No products found" subtitle="Try adjusting filters" />
          </Section>

          <Section title="Skeleton" sub="Shared loading placeholder — respects reduced-motion globally.">
            <div className="max-w-sm space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </Section>

          <Section title="Toast" sub="Tap to fire a real toast via the existing ToastContext.">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => push('Saved', { tone: 'success' })}>
                Success
              </Button>
              <Button size="sm" variant="outline" onClick={() => push('Something needs attention', { tone: 'warn' })}>
                Warn
              </Button>
              <Button size="sm" variant="outline" onClick={() => push('Could not save', { tone: 'error' })}>
                Error
              </Button>
            </div>
          </Section>

          <Section title="Sheet" sub="Bottom sheet — new, not wired into any screen yet.">
            <Button variant="outline" onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Example sheet">
              <p className="text-sm text-slate-600">
                Bottom-aligned, safe-area aware, closes on backdrop tap. Ready for 2b+ to use for filters or
                confirmations.
              </p>
              <Button className="mt-4 w-full" onClick={() => setSheetOpen(false)}>
                Close
              </Button>
            </Sheet>
          </Section>

          <Section title="AdminOnly" sub="This entire gallery is itself wrapped in one — you're seeing it because you're an admin.">
            <p className="text-sm text-slate-500">
              <code>{'<AdminOnly fallback={...}>'}</code> replaces the inline <code>{'{member?.isAdmin && (...)}'}</code>{' '}
              checks previously repeated across Courier settings, SKU mapping, the Dashboard stock-value card, the
              product GST field, and three blocks on the Shopify orders screen. Same flag, same visibility — just one
              place to read it.
            </p>
          </Section>

          <Section title="AppBar & BottomNav" sub="Both visible live on this very page — the header above and the nav below.">
            <p className="text-sm text-slate-500">
              AppBar is the restyled PageHeader (same component, new name in the design system). BottomNav is now a
              floating pill — scroll this page to the bottom to see it stay clear of the last item below.
            </p>
          </Section>
        </div>
      </AdminOnly>
    </div>
  )
}
