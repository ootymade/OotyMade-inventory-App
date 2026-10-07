import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCustomers, listProducts, createDirectOrder } from '../../db/storage.js'
import { DEFAULT_GST_RATE } from '../../db/businessInfo.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Field, Input, Select, Textarea, Button, Card, Spinner } from '../../components/ui.jsx'
import { PlusIcon, TrashIcon } from '../../components/icons.jsx'

export default function DirectOrderForm() {
  const navigate = useNavigate()
  const { member } = useTeamMember()
  const { push } = useToast()

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [customerMode, setCustomerMode] = useState('existing')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', state: 'Tamil Nadu', gstin: '' })
  const [lines, setLines] = useState([{ productId: '', name: '', hsnCode: '1806', quantity: 1, unitPrice: 0, gstRate: DEFAULT_GST_RATE }])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listCustomers().then(setCustomers)
    listProducts().then(setProducts)
  }, [])

  const updateLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const addLine = () =>
    setLines((ls) => [...ls, { productId: '', name: '', hsnCode: '1806', quantity: 1, unitPrice: 0, gstRate: DEFAULT_GST_RATE }])
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx))

  const onProductPick = (idx, productId) => {
    const p = products.find((pr) => pr.id === productId)
    if (!p) {
      updateLine(idx, { productId: '', name: '' })
      return
    }
    updateLine(idx, {
      productId,
      name: p.name,
      hsnCode: p.hsnCode || '1806',
      unitPrice: p.unitCost || 0,
      gstRate: p.gstRate != null ? p.gstRate : DEFAULT_GST_RATE,
    })
  }

  const validLines = lines.filter((l) => l.name && Number(l.quantity) > 0)
  const subtotal = validLines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0)
  const taxTotal = validLines.reduce(
    (s, l) => s + (Number(l.quantity) * Number(l.unitPrice) * (Number(l.gstRate) || 0)) / 100,
    0,
  )

  const submit = async (e) => {
    e.preventDefault()
    if (customerMode === 'existing' && !customerId) {
      push('Select a customer or add a new one', { tone: 'error' })
      return
    }
    if (customerMode === 'new' && !newCustomer.name.trim()) {
      push('Enter the customer name', { tone: 'error' })
      return
    }
    if (!validLines.length) {
      push('Add at least one product with a quantity', { tone: 'error' })
      return
    }
    setSaving(true)
    try {
      const order = await createDirectOrder({
        customerId: customerMode === 'existing' ? customerId : undefined,
        newCustomer: customerMode === 'new' ? newCustomer : undefined,
        items: validLines,
        note,
        member,
      })
      push('Order saved as proforma', { tone: 'success' })
      navigate(`/direct-orders/${order.id}`)
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="New order" back />

      <form onSubmit={submit} className="space-y-4 px-4 py-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">Customer</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
              className={`tap rounded-xl py-3 text-sm font-semibold ${customerMode === 'existing' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
            >
              Existing customer
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode('new')}
              className={`tap rounded-xl py-3 text-sm font-semibold ${customerMode === 'new' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
            >
              New customer
            </button>
          </div>

          {customerMode === 'existing' ? (
            <Field label="Customer">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone && `(${c.phone})`}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Card className="space-y-3">
              <Field label="Name">
                <Input value={newCustomer.name} onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={newCustomer.phone} onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))} />
              </Field>
              <Field label="Address">
                <Textarea
                  rows={2}
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, address: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <Input value={newCustomer.state} onChange={(e) => setNewCustomer((c) => ({ ...c, state: e.target.value }))} />
                </Field>
                <Field label="GSTIN (optional)">
                  <Input value={newCustomer.gstin} onChange={(e) => setNewCustomer((c) => ({ ...c, gstin: e.target.value }))} />
                </Field>
              </div>
            </Card>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">Products</p>
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <Card key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={line.productId} onChange={(e) => onProductPick(idx, e.target.value)} className="flex-1">
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </Select>
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                      <TrashIcon className="h-4.5 w-4.5 text-danger-600" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="GST %"
                    value={line.gstRate}
                    onChange={(e) => updateLine(idx, { gstRate: e.target.value })}
                  />
                </div>
                <Input
                  placeholder="HSN code"
                  value={line.hsnCode}
                  onChange={(e) => updateLine(idx, { hsnCode: e.target.value })}
                  className="!text-xs"
                />
              </Card>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addLine}>
            <PlusIcon className="h-4 w-4" /> Add another product
          </Button>
        </div>

        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery instructions..." />
        </Field>

        <Card className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-medium text-slate-700">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tax (est.)</span>
            <span className="font-medium text-slate-700">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>₹{(subtotal + taxTotal).toFixed(2)}</span>
          </div>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : 'Save as proforma'}
        </Button>
      </form>
    </div>
  )
}
