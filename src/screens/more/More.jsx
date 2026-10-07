import { Link } from 'react-router-dom'
import { AdminOnly, Card } from '../../components/ui.jsx'
import {
  ReceiptIcon,
  SyncIcon,
  BellIcon,
  EditIcon,
  TruckIcon,
  BoxIcon,
  ChevronRightIcon,
} from '../../components/icons.jsx'

// Stage 2b: replaces the old row of tiny footer links on the Dashboard
// with a proper screen of large, grouped rows. Every destination here
// already existed — this only changes how they're found. Role-aware rows
// (SKU mapping, courier settings, the temporary component gallery) are
// hidden outright for non-admins rather than shown then blocked.
function Row({ to, icon: Icon, title, subtitle, tag }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
      </div>
      {tag && <span className="shrink-0 text-xs font-semibold text-warn-600">{tag}</span>}
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  )
}

function Group({ title, children }) {
  return (
    <div>
      <p className="mb-2 px-1 text-sm font-semibold text-slate-500">{title}</p>
      <Card className="!p-0 divide-y divide-slate-100">{children}</Card>
    </div>
  )
}

export default function More() {
  return (
    <div className="space-y-5 px-4 pb-8 pt-4">
      <h1 className="px-1 text-xl font-bold text-slate-900">More</h1>

      <Group title="Sales">
        <Row to="/daily-orders" icon={ReceiptIcon} title="Daily orders" subtitle="Order counts by channel" />
      </Group>

      <Group title="Inventory">
        <Row to="/data-sync" icon={SyncIcon} title="Export / import data" subtitle="Backup or bulk-add products" />
      </Group>

      <Group title="Team">
        <Row to="/team-board" icon={BellIcon} title="Team board" subtitle="Announcements" />
        <Row to="/change-password" icon={EditIcon} title="Change password" />
      </Group>

      <AdminOnly>
        <Group title="Admin">
          <Row to="/courier-settings" icon={TruckIcon} title="Courier settings" />
          <Row to="/shopify-sku-mapping" icon={EditIcon} title="Shopify SKU mapping" />
          <Row to="/component-gallery" icon={BoxIcon} title="Component gallery" tag="Temp" />
        </Group>
      </AdminOnly>
    </div>
  )
}
