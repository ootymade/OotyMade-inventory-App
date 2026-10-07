import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listSuppliers,
  listCategories,
  setProductPackSize,
  setProductGstRate,
} from '../../db/storage.js'
import { PageHeader, Field, Input, Select, Button, Spinner } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { BoxIcon, TrashIcon } from '../../components/icons.jsx'

const UNITS = ['pcs', 'kg', 'g', 'box', 'ltr', 'ml', 'pack', 'dozen']

function resizeImage(file, maxDim = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function ProductForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { push } = useToast()
  const { member } = useTeamMember()
  const fileInput = useRef(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [categories, setCategories] = useState([])
  const [original, setOriginal] = useState(null)
  const [conversionQuantity, setConversionQuantity] = useState('')
  const [conversionNote, setConversionNote] = useState('')
  const [form, setForm] = useState({
    sku: searchParams.get('sku') || '',
    name: '',
    category: '',
    unit: 'pcs',
    quantity: 0,
    lowStockThreshold: 5,
    supplierId: '',
    unitCost: '',
    photo: '',
    packSizeGrams: '',
    gstRate: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    listSuppliers().then(setSuppliers)
    listCategories().then(setCategories)
  }, [])

  useEffect(() => {
    if (!isEdit) return
    getProduct(id).then((p) => {
      if (p) {
        setForm(p)
        setOriginal(p)
      }
      setLoading(false)
    })
  }, [id, isEdit])

  const packSizeChanged = isEdit && original && (Number(form.packSizeGrams) || null) !== (original.packSizeGrams || null)
  const needsConversion = packSizeChanged && Number(original?.quantity) !== 0
  const gstRateChanged = isEdit && original && (form.gstRate === '' ? null : Number(form.gstRate)) !== (original.gstRate ?? null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizeImage(file)
    setForm((f) => ({ ...f, photo: dataUrl }))
  }

  const validate = () => {
    const errs = {}
    if (!form.sku.trim()) errs.sku = 'SKU is required'
    if (!form.name.trim()) errs.name = 'Name is required'
    if (needsConversion && (conversionQuantity === '' || !conversionNote.trim())) {
      errs.conversion = 'Enter the new pack count and a note to convert existing stock'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateProduct(id, form)
        if (packSizeChanged) {
          await setProductPackSize({
            productId: id,
            packSizeGrams: form.packSizeGrams,
            newQuantity: needsConversion ? conversionQuantity : null,
            note: needsConversion ? conversionNote : null,
          })
        }
        if (gstRateChanged) {
          await setProductGstRate(id, form.gstRate)
        }
        push('Product updated', { tone: 'success' })
        navigate(`/products/${id}`)
      } else {
        const created = await createProduct(form, member)
        push('Product added', { tone: 'success' })
        navigate(`/products/${created.id}`)
      }
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!confirm(`Delete "${form.name}"? This also removes its stock history.`)) return
    await deleteProduct(id)
    push('Product deleted')
    navigate('/products')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit product' : 'Add product'}
        back
        right={
          isEdit && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete product">
              <TrashIcon className="h-5 w-5 text-danger-600" />
            </Button>
          )
        }
      />

      <form onSubmit={submit} className="space-y-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100"
          >
            {form.photo ? (
              <img src={form.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <BoxIcon className="h-8 w-8 text-slate-400" />
            )}
          </button>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              {form.photo ? 'Change photo' : 'Add photo'}
            </Button>
            <p className="mt-1 text-xs text-slate-400">Optional</p>
          </div>
          <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </div>

        <Field label="Product name" error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Basmati Rice 5kg" />
        </Field>

        <Field label="SKU / barcode" error={errors.sku} hint="Used for scanning and lookup">
          <Input value={form.sku} onChange={set('sku')} placeholder="e.g. RICE-5KG" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={form.category} onChange={set('category')} placeholder="e.g. Grains" list="category-list" />
            <datalist id="category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={set('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isEdit ? (
          <Field label="Current quantity" hint="Adjust from the product page, not here">
            <Input value={`${form.quantity} ${form.unit}`} disabled className="bg-slate-50 text-slate-500" />
          </Field>
        ) : (
          <Field label="Starting quantity">
            <Input type="number" min="0" value={form.quantity} onChange={set('quantity')} />
          </Field>
        )}

        <Field label="Low-stock threshold" hint="Flagged when quantity drops to or below this">
          <Input type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} />
        </Field>

        <Field
          label="Pack size (grams)"
          hint="Only for products sold as fixed-weight packs, counted in Nos — e.g. 500. Leave blank otherwise. Shows the total weight on hand automatically (Nos × pack size)."
        >
          <Input type="number" min="0" value={form.packSizeGrams} onChange={set('packSizeGrams')} placeholder="e.g. 500" />
        </Field>

        {needsConversion && (
          <div className="space-y-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-xs text-amber-700">
              This product has {original.quantity} {original.unit} on hand under the current pack size. Changing it
              would silently change what that number means, so enter today's actual pack count and a note — it's
              recorded as a stock conversion, same as any other stock change.
            </p>
            <Field label="New pack count" error={errors.conversion}>
              <Input
                type="number"
                min="0"
                value={conversionQuantity}
                onChange={(e) => setConversionQuantity(e.target.value)}
                placeholder="e.g. 18"
              />
            </Field>
            <Field label="Conversion note">
              <Input
                value={conversionNote}
                onChange={(e) => setConversionNote(e.target.value)}
                placeholder="e.g. Repacked 500g into 250g pouches, recounted"
              />
            </Field>
          </div>
        )}

        {isEdit && member?.isAdmin && (
          <Field
            label="GST rate % (optional override)"
            hint="Blank uses the default rate at sale time. Confirm the actual rate with your CA before setting this — admins only."
          >
            <Input type="number" min="0" max="100" step="0.01" value={form.gstRate ?? ''} onChange={set('gstRate')} placeholder="e.g. 5" />
          </Field>
        )}

        <Field label="Unit cost (₹)" hint="Used to estimate total stock value">
          <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={set('unitCost')} />
        </Field>

        <Field label="Supplier">
          <Select value={form.supplierId} onChange={set('supplierId')}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : 'Add product'}
        </Button>
      </form>
    </div>
  )
}
