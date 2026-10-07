// Data-access layer. Every screen in the app talks to storage through this
// module only — never to Supabase directly. That's what let the app move
// from on-device IndexedDB to a shared Supabase backend without any screen
// needing to change.
import { supabase } from './supabaseClient.js'
import { sortByCategoryOrder } from './categoryOrder.js'
import { BUSINESS, DEFAULT_GST_RATE } from './businessInfo.js'

const clean = (str) => (str ?? '').toString().trim()

// ---------------------------------------------------------------------------
// Row <-> app-object mapping (Postgres uses snake_case; the app uses camelCase)
// ---------------------------------------------------------------------------

function rowToProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category || '',
    unit: row.unit,
    quantity: Number(row.quantity),
    lowStockThreshold: Number(row.low_stock_threshold),
    supplierId: row.supplier_id || '',
    unitCost: Number(row.unit_cost),
    photo: row.photo || '',
    hsnCode: row.hsn_code || '1806',
    packSizeGrams: row.pack_size_grams != null ? Number(row.pack_size_grams) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: Number(row.quantity),
    reason: row.reason,
    note: row.note || '',
    memberName: row.member_name || '',
    memberRole: row.member_role || '',
    poId: row.po_id || '',
    timestamp: row.timestamp,
    updatedAt: row.updated_at,
  }
}

function rowToPO(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id || '',
    status: row.status,
    items: row.items || [],
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function must(error) {
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts({ search = '', category = '', supplierId = '' } = {}) {
  let query = supabase.from('products').select('*').order('name')
  if (category) query = query.eq('category', category)
  if (supplierId) query = query.eq('supplier_id', supplierId)
  const { data, error } = await query
  must(error)
  let items = data.map(rowToProduct)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    )
  }
  return items
}

export async function getProduct(id) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
  must(error)
  return data ? rowToProduct(data) : undefined
}

export async function getProductByCode(code) {
  const c = clean(code)
  if (!c) return undefined
  const { data, error } = await supabase.from('products').select('*').ilike('sku', c).maybeSingle()
  must(error)
  return data ? rowToProduct(data) : undefined
}

export async function listCategories() {
  const { data, error } = await supabase.from('products').select('category')
  must(error)
  return sortByCategoryOrder([...new Set(data.map((r) => r.category).filter(Boolean))])
}

export async function createProduct(data, member) {
  const sku = clean(data.sku)
  if (!sku) throw new Error('SKU is required')
  const existing = await getProductByCode(sku)
  if (existing) throw new Error(`SKU "${sku}" is already in use`)

  const quantity = Number(data.quantity) || 0
  const { data: inserted, error } = await supabase
    .from('products')
    .insert({
      sku,
      name: clean(data.name),
      category: clean(data.category),
      unit: clean(data.unit) || 'pcs',
      quantity,
      low_stock_threshold: Number(data.lowStockThreshold) || 0,
      supplier_id: data.supplierId || null,
      unit_cost: Number(data.unitCost) || 0,
      photo: data.photo || '',
      hsn_code: clean(data.hsnCode) || '1806',
      pack_size_grams: data.packSizeGrams ? Number(data.packSizeGrams) : null,
    })
    .select()
    .single()
  must(error)
  const product = rowToProduct(inserted)

  if (quantity > 0) {
    await supabase.from('movements').insert({
      product_id: product.id,
      type: 'in',
      quantity,
      reason: 'adjustment',
      note: 'Initial stock on product creation',
      member_name: member?.name || '',
      member_role: member?.role || '',
    })
  }
  return product
}

export async function updateProduct(id, data) {
  if (data.sku) {
    const dupe = await getProductByCode(data.sku)
    if (dupe && dupe.id !== id) throw new Error(`SKU "${data.sku}" is already in use`)
  }
  const row = {}
  if (data.sku !== undefined) row.sku = clean(data.sku)
  if (data.name !== undefined) row.name = clean(data.name)
  if (data.category !== undefined) row.category = clean(data.category)
  if (data.unit !== undefined) row.unit = data.unit
  if (data.lowStockThreshold !== undefined) row.low_stock_threshold = Number(data.lowStockThreshold) || 0
  if (data.supplierId !== undefined) row.supplier_id = data.supplierId || null
  if (data.unitCost !== undefined) row.unit_cost = Number(data.unitCost) || 0
  if (data.photo !== undefined) row.photo = data.photo
  if (data.hsnCode !== undefined) row.hsn_code = clean(data.hsnCode) || '1806'
  if (data.packSizeGrams !== undefined) row.pack_size_grams = data.packSizeGrams ? Number(data.packSizeGrams) : null
  row.updated_at = new Date().toISOString()

  const { data: updated, error } = await supabase.from('products').update(row).eq('id', id).select().single()
  must(error)
  return rowToProduct(updated)
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  must(error)
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers({ search = '' } = {}) {
  const { data, error } = await supabase.from('suppliers').select('*').order('name')
  must(error)
  let items = data.map(rowToSupplier)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter((s) => s.name.toLowerCase().includes(q))
  }
  return items
}

export async function getSupplier(id) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle()
  must(error)
  return data ? rowToSupplier(data) : undefined
}

export async function listProductsBySupplier(supplierId) {
  const { data, error } = await supabase.from('products').select('*').eq('supplier_id', supplierId).order('name')
  must(error)
  return data.map(rowToProduct)
}

export async function createSupplier(data) {
  const name = clean(data.name)
  if (!name) throw new Error('Supplier name is required')
  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert({
      name,
      contact_name: clean(data.contactName),
      phone: clean(data.phone),
      email: clean(data.email),
      notes: clean(data.notes),
    })
    .select()
    .single()
  must(error)
  return rowToSupplier(inserted)
}

export async function updateSupplier(id, data) {
  const row = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) row.name = clean(data.name)
  if (data.contactName !== undefined) row.contact_name = clean(data.contactName)
  if (data.phone !== undefined) row.phone = clean(data.phone)
  if (data.email !== undefined) row.email = clean(data.email)
  if (data.notes !== undefined) row.notes = clean(data.notes)

  const { data: updated, error } = await supabase.from('suppliers').update(row).eq('id', id).select().single()
  must(error)
  return rowToSupplier(updated)
}

export async function deleteSupplier(id) {
  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', id)
  must(countError)
  if (count > 0) throw new Error(`Cannot delete: ${count} product(s) still linked to this supplier`)

  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  must(error)
}

// ---------------------------------------------------------------------------
// Movements (stock in/out log)
// ---------------------------------------------------------------------------

export async function listMovements({ productId = '', limit = 0 } = {}) {
  let query = supabase.from('movements').select('*').order('timestamp', { ascending: false })
  if (productId) query = query.eq('product_id', productId)
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  must(error)
  return data.map(rowToMovement)
}

// Adjusts a product's stock and writes a movement entry as a single atomic
// database operation (see adjust_stock in supabase/schema.sql) — this keeps
// concurrent edits from two phones at once from silently overwriting each
// other. Returns { product, crossedBelowThreshold }.
export async function adjustStock({ productId, type, quantity, reason, note, member }) {
  const qty = Math.abs(Number(quantity))
  if (!qty) throw new Error('Quantity must be greater than zero')
  const delta = type === 'out' ? -qty : qty

  const before = await getProduct(productId)
  if (!before) throw new Error('Product not found')

  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason || 'adjustment',
    p_note: clean(note),
    p_member_name: member?.name || '',
    p_member_role: member?.role || '',
  })
  must(error)
  const product = rowToProduct(data)

  const wasAbove = before.quantity > before.lowStockThreshold
  const crossedBelowThreshold = wasAbove && product.quantity <= product.lowStockThreshold
  return { product, crossedBelowThreshold }
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

export async function listPurchaseOrders({ status = '' } = {}) {
  let query = supabase.from('purchase_orders').select('*').order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  must(error)
  return data.map(rowToPO)
}

export async function getPurchaseOrder(id) {
  const { data, error } = await supabase.from('purchase_orders').select('*').eq('id', id).maybeSingle()
  must(error)
  return data ? rowToPO(data) : undefined
}

export async function createPurchaseOrder({ supplierId, items, note }) {
  if (!supplierId) throw new Error('Supplier is required')
  if (!items?.length) throw new Error('Add at least one product')
  const { data: inserted, error } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: supplierId,
      status: 'draft',
      items: items.map((it) => ({
        productId: it.productId,
        qtyOrdered: Number(it.qtyOrdered) || 0,
        qtyReceived: 0,
        unitCost: Number(it.unitCost) || 0,
      })),
      note: clean(note),
    })
    .select()
    .single()
  must(error)
  return rowToPO(inserted)
}

export async function updatePurchaseOrderStatus(id, status) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  must(error)
  return rowToPO(data)
}

export async function deletePurchaseOrder(id) {
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
  must(error)
}

// Receive some/all items of a PO, atomically (see receive_purchase_order in
// supabase/schema.sql). `received` is [{productId, qty}] for the quantities
// being received *in this action* (not cumulative totals).
export async function receivePurchaseOrder(id, received, member) {
  const { data, error } = await supabase.rpc('receive_purchase_order', {
    p_po_id: id,
    p_received: received.map((r) => ({ productId: r.productId, qty: Number(r.qty) || 0 })),
    p_member_name: member?.name || '',
    p_member_role: member?.role || '',
  })
  must(error)
  return rowToPO(data)
}

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------

export async function getLowStockProducts() {
  const items = await listProducts()
  return items.filter((p) => p.quantity <= p.lowStockThreshold).sort((a, b) => a.quantity - b.quantity)
}

export async function getDashboardStats() {
  const [products, recentActivity] = await Promise.all([listProducts(), listMovements({ limit: 10 })])
  const totalProducts = products.length
  const totalStockValue = products.reduce((s, p) => s + p.quantity * (p.unitCost || 0), 0)
  const lowStock = products.filter((p) => p.quantity <= p.lowStockThreshold)
  return {
    totalProducts,
    totalStockValue,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
    recentActivity,
  }
}

// ---------------------------------------------------------------------------
// Export (backup) / bulk product import
// ---------------------------------------------------------------------------

// Downloads a snapshot of the live shared data — handy as a backup or for
// offline reporting. Since every phone reads the same Supabase backend now,
// this is no longer needed to sync between phones (that happens live).
export async function exportAll() {
  const [products, suppliers, movements, purchaseOrders] = await Promise.all([
    listProducts(),
    listSuppliers(),
    listMovements(),
    listPurchaseOrders(),
  ])
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    products,
    suppliers,
    movements,
    purchaseOrders,
  }
}

// Bulk-adds/updates products from a JSON file shaped like exportAll()'s
// output (a `products` array is all that's required). Matches existing
// products by SKU and updates them; new SKUs are inserted. Any product with
// a positive `quantity` gets an "Initial stock" movement logged so the
// number is backed by an audit entry, same as adding one product by hand.
export async function bulkImportProducts(payload, member) {
  if (!payload || !Array.isArray(payload.products)) {
    throw new Error('That file does not look like a product list')
  }
  let created = 0
  let updated = 0
  for (const p of payload.products) {
    const sku = clean(p.sku)
    if (!sku) continue
    const existing = await getProductByCode(sku)
    if (existing) {
      await updateProduct(existing.id, {
        name: p.name,
        category: p.category,
        unit: p.unit,
        lowStockThreshold: p.lowStockThreshold,
        supplierId: p.supplierId,
        unitCost: p.unitCost,
        photo: p.photo,
      })
      updated += 1
    } else {
      await createProduct(p, member)
      created += 1
    }
  }
  return { created, updated }
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function rowToCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    address: row.address || '',
    state: row.state || BUSINESS.state,
    gstin: row.gstin || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCustomers({ search = '' } = {}) {
  const { data, error } = await supabase.from('customers').select('*').order('name')
  must(error)
  let items = data.map(rowToCustomer)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }
  return items
}

export async function getCustomer(id) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  must(error)
  return data ? rowToCustomer(data) : undefined
}

export async function createCustomer(data) {
  const name = clean(data.name)
  if (!name) throw new Error('Customer name is required')
  const { data: inserted, error } = await supabase
    .from('customers')
    .insert({
      name,
      phone: clean(data.phone),
      address: clean(data.address),
      state: clean(data.state) || BUSINESS.state,
      gstin: clean(data.gstin),
    })
    .select()
    .single()
  must(error)
  return rowToCustomer(inserted)
}

export async function updateCustomer(id, data) {
  const row = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) row.name = clean(data.name)
  if (data.phone !== undefined) row.phone = clean(data.phone)
  if (data.address !== undefined) row.address = clean(data.address)
  if (data.state !== undefined) row.state = clean(data.state) || BUSINESS.state
  if (data.gstin !== undefined) row.gstin = clean(data.gstin)
  const { data: updated, error } = await supabase.from('customers').update(row).eq('id', id).select().single()
  must(error)
  return rowToCustomer(updated)
}

// ---------------------------------------------------------------------------
// Direct Orders: Proforma & GST invoices
// ---------------------------------------------------------------------------

function rowToInvoice(row) {
  return {
    id: row.id,
    kind: row.kind,
    invoiceNumber: row.invoice_number,
    status: row.status,
    customerId: row.customer_id || '',
    customerName: row.customer_name_snapshot || '',
    customerPhone: row.customer_phone_snapshot || '',
    customerAddress: row.customer_address_snapshot || '',
    customerState: row.customer_state_snapshot || '',
    customerGstin: row.customer_gstin_snapshot || '',
    subtotal: Number(row.subtotal),
    cgst: Number(row.cgst),
    sgst: Number(row.sgst),
    igst: Number(row.igst),
    total: Number(row.total),
    courierName: row.courier_name || '',
    trackingNumber: row.tracking_number || '',
    note: row.note || '',
    createdBy: row.created_by || '',
    createdByRole: row.created_by_role || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToInvoiceItem(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    productId: row.product_id || '',
    name: row.name_snapshot,
    hsnCode: row.hsn_code,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  }
}

export async function listInvoices({ search = '', customerId = '', dateFrom = '', dateTo = '' } = {}) {
  let query = supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  const { data, error } = await query
  must(error)
  let items = data.map(rowToInvoice)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(
      (i) =>
        i.customerName.toLowerCase().includes(q) ||
        i.customerPhone.includes(q) ||
        (i.invoiceNumber && String(i.invoiceNumber).includes(q)),
    )
  }
  return items
}

export async function getInvoiceWithItems(id) {
  const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('id'),
  ])
  must(error)
  must(itemsError)
  if (!invoice) return undefined
  return { invoice: rowToInvoice(invoice), items: (items || []).map(rowToInvoiceItem) }
}

// Computes the CGST/SGST/IGST split for a set of line items against a
// customer's state — intra-Tamil-Nadu splits evenly into CGST+SGST,
// everything else is IGST. `items` is [{quantity, unitPrice, gstRate}].
function calcGstBreakup(items, customerState) {
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0)
  const taxTotal = items.reduce(
    (s, it) => s + (Number(it.quantity) * Number(it.unitPrice) * (Number(it.gstRate) || DEFAULT_GST_RATE)) / 100,
    0,
  )
  const isIntraState = clean(customerState).toLowerCase() === clean(BUSINESS.state).toLowerCase()
  const cgst = isIntraState ? taxTotal / 2 : 0
  const sgst = isIntraState ? taxTotal / 2 : 0
  const igst = isIntraState ? 0 : taxTotal
  return { subtotal, cgst, sgst, igst, total: subtotal + taxTotal }
}

// Creates a draft Proforma order. `items`: [{productId, name, hsnCode,
// quantity, unitPrice, gstRate}]. Either pass `customerId` (existing
// customer) or `newCustomer` ({name, phone, address, state, gstin}).
// Stock is NOT touched here — only confirmDirectOrder() deducts it.
export async function createDirectOrder({ customerId, newCustomer, items, note, member }) {
  if (!items?.length) throw new Error('Add at least one product')

  let customer
  if (customerId) {
    customer = await getCustomer(customerId)
    if (!customer) throw new Error('Customer not found')
  } else {
    customer = await createCustomer(newCustomer || {})
  }

  const { subtotal, cgst, sgst, igst, total } = calcGstBreakup(items, customer.state)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      kind: 'proforma',
      status: 'draft',
      customer_id: customer.id,
      customer_name_snapshot: customer.name,
      customer_phone_snapshot: customer.phone,
      customer_address_snapshot: customer.address,
      customer_state_snapshot: customer.state,
      customer_gstin_snapshot: customer.gstin,
      subtotal,
      cgst,
      sgst,
      igst,
      total,
      note: clean(note),
      created_by: member?.name || '',
      created_by_role: member?.role || '',
    })
    .select()
    .single()
  must(error)

  const itemRows = items.map((it) => ({
    invoice_id: invoice.id,
    product_id: it.productId || null,
    name_snapshot: it.name,
    hsn_code: clean(it.hsnCode) || '1806',
    quantity: Number(it.quantity),
    unit_price: Number(it.unitPrice),
    line_total: Number(it.quantity) * Number(it.unitPrice),
  }))
  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
  must(itemsError)

  return rowToInvoice(invoice)
}

// Deletes a draft order (only allowed before confirmation — nothing to
// undo yet since stock hasn't been touched).
export async function deleteDraftOrder(id) {
  const { data: invoice, error } = await supabase.from('invoices').select('status').eq('id', id).maybeSingle()
  must(error)
  if (invoice && invoice.status !== 'draft') {
    throw new Error('Only draft orders can be deleted — this one has already been confirmed')
  }
  const { error: delError } = await supabase.from('invoices').delete().eq('id', id)
  must(delError)
}

// Confirms a draft order into a numbered GST invoice: assigns the next
// sequential invoice number and deducts stock for every line item via the
// existing adjust_stock logic — atomically, in a single database function
// (see confirm_direct_order in supabase/schema.sql), so it can never be
// run twice or leave stock and invoice numbering out of sync.
export async function confirmDirectOrder(id, member) {
  const { data, error } = await supabase.rpc('confirm_direct_order', {
    p_invoice_id: id,
    p_member_name: member?.name || '',
    p_member_role: member?.role || '',
  })
  must(error)
  return rowToInvoice(data)
}

export async function updateShipment(id, { courierName, trackingNumber, status }) {
  const row = { updated_at: new Date().toISOString() }
  if (courierName !== undefined) row.courier_name = clean(courierName)
  if (trackingNumber !== undefined) row.tracking_number = clean(trackingNumber)
  if (status !== undefined) row.status = status
  const { data, error } = await supabase.from('invoices').update(row).eq('id', id).select().single()
  must(error)
  return rowToInvoice(data)
}

// ---------------------------------------------------------------------------
// Daily order count log
// ---------------------------------------------------------------------------

function rowToDailyCount(row) {
  return {
    date: row.order_date,
    channel: row.channel,
    orderCount: Number(row.order_count),
    enteredBy: row.entered_by || '',
    updatedAt: row.updated_at,
  }
}

export async function listDailyOrderCounts({ dateFrom = '', dateTo = '' } = {}) {
  let query = supabase.from('daily_order_counts').select('*').order('order_date', { ascending: false })
  if (dateFrom) query = query.gte('order_date', dateFrom)
  if (dateTo) query = query.lte('order_date', dateTo)
  const { data, error } = await query
  must(error)
  return data.map(rowToDailyCount)
}

// Sets the count for one date+channel. Safe for two people editing
// different channels on the same day at the same time — each write only
// touches its own (date, channel) row.
export async function upsertDailyOrderCount({ date, channel, orderCount, member }) {
  const { data, error } = await supabase
    .from('daily_order_counts')
    .upsert(
      {
        order_date: date,
        channel,
        order_count: Number(orderCount) || 0,
        entered_by: member?.name || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_date,channel' },
    )
    .select()
    .single()
  must(error)
  return rowToDailyCount(data)
}

// Confirmed direct-order (GST invoice) count for one date — used to
// auto-suggest the "Direct" channel's count, which staff can still override.
export async function getConfirmedDirectOrderCount(date) {
  const start = `${date}T00:00:00.000Z`
  const end = `${date}T23:59:59.999Z`
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'gst')
    .gte('created_at', start)
    .lte('created_at', end)
  must(error)
  return count || 0
}

export async function getTodayOrderSummary() {
  const today = new Date().toISOString().slice(0, 10)
  const counts = await listDailyOrderCounts({ dateFrom: today, dateTo: today })
  const byChannel = {}
  counts.forEach((c) => (byChannel[c.channel] = c.orderCount))
  const total = counts.reduce((s, c) => s + c.orderCount, 0)
  return { date: today, total, byChannel }
}

// ---------------------------------------------------------------------------
// Shopify Orders — reads go through shopify_orders_view /
// shopify_order_items_view, never the base tables, so revenue columns come
// back null for Staff at the database level (see supabase/schema.sql).
// Writes to Shopify, and the initial import into shopify_orders, only ever
// happen inside Supabase Edge Functions. The one exception is workflow_status
// itself (packing/packed/dispatched/etc.) — that's a staff-driven write from
// this module, but only through set_shopify_order_workflow_status(), a
// security-definer RPC that enforces who can move an order which way, never
// a direct table write.
// ---------------------------------------------------------------------------

// Staff move forward one step at a time; only admins may move backward or
// skip. "shipped" is kept as the stored value for backward compatibility —
// WORKFLOW_LABELS is what every screen should display instead of the raw
// column value. Packing/Packed/Dispatched are blocked on a payment_hold or
// cancelled order; Delivered never is. An admin can move into a blocked
// status anyway by supplying a reason (stored and shown in order detail) —
// staff have no such override, at any status.
export const WORKFLOW_STEPS = ['new', 'packing', 'packed', 'shipped', 'delivered']
export const WORKFLOW_LABELS = { new: 'New', packing: 'Packing', packed: 'Packed', shipped: 'Dispatched', delivered: 'Delivered' }
export const HOLD_BLOCKED_STEPS = ['packing', 'packed', 'shipped']

function rowToShopifyOrder(row) {
  return {
    id: row.id,
    shopifyOrderId: row.shopify_order_id,
    orderNumber: row.order_number,
    createdAt: row.shopify_created_at,
    updatedAt: row.shopify_updated_at,
    cancelledAt: row.cancelled_at,
    fulfillmentStatus: row.fulfillment_status || '',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    customerEmail: row.customer_email || '',
    shippingAddress: row.shipping_address,
    billingAddress: row.billing_address,
    tags: row.tags || '',
    note: row.note || '',
    workflowStatus: row.workflow_status,
    workflowUpdatedBy: row.workflow_updated_by,
    workflowUpdatedAt: row.workflow_updated_at,
    workflowHoldOverrideReason: row.workflow_hold_override_reason || '',
    workflowHoldOverrideBy: row.workflow_hold_override_by,
    workflowHoldOverrideAt: row.workflow_hold_override_at,
    synced_at: row.synced_at,
    // Derived, non-revenue flag — visible to Staff too, unlike everything
    // below. This is the only payment signal Staff get: enough to know not
    // to ship, never how much money is involved.
    paymentHold: row.payment_hold,
    // null for Staff (masked by the view), a number for Admin.
    financialStatus: row.financial_status,
    currency: row.currency,
    subtotalPrice: row.subtotal_price != null ? Number(row.subtotal_price) : null,
    totalTax: row.total_tax != null ? Number(row.total_tax) : null,
    totalPrice: row.total_price != null ? Number(row.total_price) : null,
  }
}

function rowToShopifyOrderItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    sku: row.sku || '',
    title: row.title,
    variantTitle: row.variant_title || '',
    quantity: Number(row.quantity),
    unfulfilledQuantity: Number(row.unfulfilled_quantity),
    productId: row.product_id || '',
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
  }
}

export async function listShopifyOrders({ workflowStatus = '' } = {}) {
  let query = supabase.from('shopify_orders_view').select('*').order('shopify_created_at', { ascending: false })
  if (workflowStatus) query = query.eq('workflow_status', workflowStatus)
  const { data, error } = await query
  must(error)
  return data.map(rowToShopifyOrder)
}

export async function getShopifyOrderWithItems(id) {
  const [{ data: order, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('shopify_orders_view').select('*').eq('id', id).maybeSingle(),
    supabase.from('shopify_order_items_view').select('*').eq('order_id', id).order('id'),
  ])
  must(error)
  must(itemsError)
  if (!order) return undefined
  return { order: rowToShopifyOrder(order), items: (items || []).map(rowToShopifyOrderItem) }
}

// Every signed-in team member can already read the whole team_members table
// (existing RLS policy, used by the old shared-login picker) — this just
// gives "who has this order" a name instead of a uuid.
export async function listTeamMemberNames() {
  const { data, error } = await supabase.from('team_members').select('id, name')
  must(error)
  return data
}

// Moves a Shopify order's workflow_status forward (staff) or any direction
// (admin) through set_shopify_order_workflow_status — a security-definer
// RPC, not a direct table write. expectedStatus is the status the caller
// last saw; the RPC rejects the change if someone else already moved the
// order since (optimistic locking). Packing/Packed/Dispatched are rejected
// outright on a payment_hold order for anyone except an admin who passes a
// non-empty overrideReason (stored on the order); Delivered is never
// blocked, for anyone. Throws a specific, user-facing message for each case.
export async function setShopifyOrderWorkflowStatus({ orderId, newStatus, expectedStatus, overrideReason }) {
  const { data, error } = await supabase.rpc('set_shopify_order_workflow_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_expected_status: expectedStatus,
    p_override_reason: overrideReason || null,
  })
  if (error) {
    if (error.message?.includes('STALE:')) {
      throw new Error('Someone else already updated this order — refresh and try again.')
    }
    if (error.message?.includes('OVERRIDE_REASON_REQUIRED:')) {
      throw new Error('Enter a reason to move this order forward despite the payment hold.')
    }
    if (error.message?.includes('PAYMENT_HOLD:')) {
      throw new Error('This order has a payment issue and cannot be moved forward.')
    }
    if (error.message?.includes('FORWARD_ONLY:')) {
      throw new Error('You can only move an order forward one step at a time.')
    }
    throw new Error(error.message || 'Could not update status')
  }
  const row = data?.[0]
  return row
    ? {
        workflowStatus: row.workflow_status,
        workflowUpdatedBy: row.workflow_updated_by,
        workflowUpdatedAt: row.workflow_updated_at,
        workflowHoldOverrideReason: row.workflow_hold_override_reason || '',
        workflowHoldOverrideBy: row.workflow_hold_override_by,
        workflowHoldOverrideAt: row.workflow_hold_override_at,
      }
    : null
}

// ---------------------------------------------------------------------------
// Shipment tracking (Shopify orders and direct orders / invoices, level 1:
// a courier name + tracking number and a link built from a stored template.
// No live status — that's level 2 (Ship24/17TRACK), not built. The shipments
// table is designed so level 2 can add last_status/last_checked_at/provider
// columns later without changing this shape.
// ---------------------------------------------------------------------------

function rowToCourier(row) {
  return {
    id: row.id,
    name: row.name,
    trackingUrlTemplate: row.tracking_url_template || '',
    isDeepLink: row.is_deep_link,
    sortOrder: row.sort_order,
  }
}

export async function listCouriers() {
  const { data, error } = await supabase.from('couriers').select('*').order('sort_order')
  must(error)
  return data.map(rowToCourier)
}

// Admin-only — enforced by RLS on the couriers table itself, not just the UI.
export async function saveCourier({ id, name, trackingUrlTemplate, isDeepLink, sortOrder }) {
  const row = {
    name: clean(name),
    tracking_url_template: clean(trackingUrlTemplate) || null,
    is_deep_link: !!isDeepLink,
    sort_order: Number(sortOrder) || 0,
  }
  const query = id ? supabase.from('couriers').update(row).eq('id', id) : supabase.from('couriers').insert(row)
  const { error } = await query
  must(error)
}

export async function deleteCourier(id) {
  const { error } = await supabase.from('couriers').delete().eq('id', id)
  must(error)
}

function rowToShipment(row) {
  return {
    id: row.id,
    courierName: row.courier_name,
    trackingNumber: row.tracking_number,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

export async function getShipment({ shopifyOrderId, invoiceId } = {}) {
  let query = supabase.from('shipments').select('*')
  query = shopifyOrderId ? query.eq('shopify_order_id', shopifyOrderId) : query.eq('invoice_id', invoiceId)
  const { data, error } = await query.maybeSingle()
  must(error)
  return data ? rowToShipment(data) : null
}

// Any signed-in team member — staff set this themselves on dispatch.
export async function setShipment({ shopifyOrderId, invoiceId, courierName, trackingNumber }) {
  const { data, error } = await supabase.rpc('set_shipment', {
    p_shopify_order_id: shopifyOrderId || null,
    p_invoice_id: invoiceId || null,
    p_courier_name: courierName,
    p_tracking_number: trackingNumber,
  })
  must(error)
  return rowToShipment(data)
}

// Resolves a courier name against the admin-managed list to build a
// tracking link. Returns null for "Other"/unrecognized couriers — the
// Track button is simply omitted in that case, never a broken link.
export function buildTrackingUrl(courierName, trackingNumber, couriers) {
  const courier = couriers.find((c) => c.name.toLowerCase() === (courierName || '').toLowerCase())
  if (!courier || !courier.trackingUrlTemplate) return null
  return courier.isDeepLink
    ? courier.trackingUrlTemplate.replace('{tracking_number}', encodeURIComponent(trackingNumber))
    : courier.trackingUrlTemplate
}

export function buildWhatsAppShipmentMessage({ customerName, orderNumber, courierName, trackingNumber, trackingUrl }) {
  const lines = [
    `Hi ${customerName || 'there'}, your order ${orderNumber} has been dispatched via ${courierName}.`,
    `Tracking number: ${trackingNumber}`,
  ]
  if (trackingUrl) lines.push(`Track here: ${trackingUrl}`)
  lines.push('— OotyMade')
  return lines.join('\n')
}

// Triggers the shopify-sync-orders Edge Function (backfill / manual
// refresh). Uses the signed-in team member's own session — the function
// requires a valid Supabase session and does all the actual Shopify calls
// server-side.
//
// Always resolves (never throws) with a result the caller can render
// directly: { ok: true, partial, fetched, created, updated, skipped,
// webhooksRegistered } on success or a partial stop, or { ok: false, error,
// ...same counts } when the function ran but failed partway through. The
// Edge Function always returns real JSON on every path it controls, but a
// platform-level failure (e.g. the function being killed for running too
// long) has no body of ours to read, so that case is turned into its own
// specific message here instead of supabase-js's generic one.
export async function refreshShopifyOrders() {
  const { data, error } = await supabase.functions.invoke('shopify-sync-orders', { method: 'POST' })
  if (!error) return data

  let body = null
  try {
    body = await error.context.json()
  } catch {
    // Not JSON — the function never got to produce its own response body.
  }
  if (body) return body

  const status = error.context?.status
  const message =
    status === 546 || status === 504
      ? 'Sync timed out partway through. Some orders may already be imported — press Refresh to continue.'
      : error.message || 'Refresh failed'
  return { ok: false, error: message }
}

// One-off, read-only investigation: fetches live Shopify payment
// transactions for every synced order and reports financial-status/gateway
// breakdowns, so the payment_hold rule can be set from evidence. Writes
// nothing. Admin-only (enforced inside the function, not just by the UI).
export async function runShopifyPaymentDiagnostics() {
  const { data, error } = await supabase.functions.invoke('shopify-payment-diagnostics', { method: 'POST' })
  if (!error) return data

  let body = null
  try {
    body = await error.context.json()
  } catch {
    // Not JSON.
  }
  if (body) return body
  return { ok: false, error: error.message || 'Diagnostics failed' }
}

export async function getShopifySyncSettings() {
  const { data, error } = await supabase.from('shopify_settings').select('first_order_number').eq('id', true).maybeSingle()
  must(error)
  return { firstOrderNumber: data?.first_order_number ?? 16600 }
}

// Admin-only. Orders below this number are ignored by both the sync and the
// webhook from the next run onward — this only changes what future syncs
// touch, it never deletes anything already imported.
export async function saveShopifyFirstOrderNumber(firstOrderNumber) {
  const { error } = await supabase.rpc('update_shopify_first_order_number', { p_number: firstOrderNumber })
  must(error)
}

// Unmapped Shopify SKUs seen in synced orders (admin-only — the view
// itself returns nothing for non-admins). Each needs an admin to pick the
// matching catalog product before order items with that SKU resolve.
export async function listUnmappedShopifySkus() {
  const { data, error } = await supabase.from('shopify_unmapped_skus_view').select('*').order('order_item_count', { ascending: false })
  must(error)
  return data.map((row) => ({ sku: row.sku, sampleTitle: row.sample_title, orderItemCount: Number(row.order_item_count) }))
}

// Already-confirmed Shopify SKU -> product mappings, for review/correction.
export async function listSkuMappings() {
  const { data, error } = await supabase.from('shopify_sku_map').select('*').order('updated_at', { ascending: false })
  must(error)
  return data.map((row) => ({
    shopifySku: row.shopify_sku,
    productId: row.product_id,
    quantityMultiplier: Number(row.quantity_multiplier),
    updatedAt: row.updated_at,
  }))
}

// Admin-confirms shopifySku -> productId (with an optional quantity
// multiplier, e.g. a Shopify SKU that's really N catalog units). Re-resolves
// every existing shopify_order_items row with that SKU in the same call.
export async function saveSkuMapping({ shopifySku, productId, quantityMultiplier }) {
  const { error } = await supabase.rpc('upsert_sku_mapping', {
    p_shopify_sku: shopifySku,
    p_product_id: productId,
    p_quantity_multiplier: quantityMultiplier || 1,
  })
  must(error)
}

export async function getShopifySyncPing() {
  const { data, error } = await supabase.from('shopify_sync_ping').select('last_synced_at').eq('id', true).maybeSingle()
  must(error)
  return data?.last_synced_at
}
