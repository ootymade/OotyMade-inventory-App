import { useRef, useState } from 'react'
import { exportAll, bulkImportProducts } from '../../db/storage.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Button, Spinner, AdminOnly, EmptyState } from '../../components/ui.jsx'
import { DownloadIcon, UploadIcon } from '../../components/icons.jsx'

export default function DataSync() {
  const { push } = useToast()
  const { member } = useTeamMember()
  const fileInput = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const doExport = async () => {
    setExporting(true)
    try {
      const payload = await exportAll()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `ooty-inventory-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      push('Export ready — check your downloads', { tone: 'success' })
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const { created, updated } = await bulkImportProducts(payload, member)
      push(`Added ${created} new product${created === 1 ? '' : 's'}, updated ${updated}`, { tone: 'success' })
    } catch (err) {
      push(`Import failed: ${err.message}`, { tone: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Export & bulk import" back />

      <AdminOnly fallback={<EmptyState title="Admins only" subtitle="Ask an admin for a data export or bulk import" />}>
      <div className="space-y-4 px-4 py-4">
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Export data</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Downloads a JSON snapshot of every product, supplier, purchase order and stock movement —
              useful as a backup, or for building a report offline. Since all phones now share the same
              live data, you don't need this to keep phones in sync anymore.
            </p>
          </div>
          <Button className="w-full" onClick={doExport} disabled={exporting}>
            {exporting ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-5 w-5" />}
            Export data
          </Button>
        </Card>

        <Card className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Bulk import products</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Upload a JSON file with a <code>products</code> list to add many products at once. Existing
              products are matched and updated by SKU; new SKUs are added as new products.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => fileInput.current?.click()} disabled={importing}>
            {importing ? <Spinner className="h-4 w-4" /> : <UploadIcon className="h-5 w-5" />}
            Choose file to import
          </Button>
          <input ref={fileInput} type="file" accept="application/json" className="hidden" onChange={onFileChosen} />
        </Card>
      </div>
      </AdminOnly>
    </div>
  )
}
