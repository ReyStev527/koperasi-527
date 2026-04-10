// =============================================
// MODUL INVENTARIS KOPERASI
// Barang, Supplier, Barang Masuk, Kasir/POS
// =============================================
import { useState } from 'react'
import { BarcodeScanner, ScanButton } from './BarcodeScanner'
import { cetakStruk } from './Extra'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { return new Date().toISOString().slice(0, 10) }

// --- ICONS ---
const IC = {
  plus: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  search: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  cart: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  warn: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  minus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>,
}

// =============================================
// PRODUK / STOK BARANG
// =============================================
export function Products({ products, saveProduct, deleteProduct, suppliers, setModal, showToast }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showScanner, setShowScanner] = useState(false)
  const [page_, setPage_] = useState(1)
  const pageSize = 50

  const categories = [...new Set(products.map(p => p.category))].sort()
  const filtered = products.filter(p => {
    if (catFilter === '_low') return p.stock <= (p.minStock || 10)
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page_ - 1) * pageSize, page_ * pageSize)

  const totalValue = products.reduce((a, p) => a + (p.stock * p.buyPrice), 0)
  const lowStock = products.filter(p => p.stock <= p.minStock)

  function openForm(product) {
    const isEdit = !!product
    const data = product ? { ...product } : {
      sku: 'BRG-' + String(products.length + 1).padStart(3, '0'),
      name: '', category: 'Sembako', buyPrice: '', sellPrice: '', stock: 0, unit: 'pcs', minStock: 10, supplierId: suppliers[0]?.id || ''
    }
    setModal({
      title: isEdit ? 'Edit Produk' : 'Tambah Produk',
      content: <ProductForm initial={data} suppliers={suppliers} onSave={async d => {
        await saveProduct(isEdit ? { ...product, ...d } : d, isEdit)
        setModal(null)
        showToast(isEdit ? 'Produk diperbarui' : 'Produk ditambahkan')
      }} />,
    })
  }

  function exportCSV() {
    const header = 'SKU,Nama Produk,Kategori,Harga Beli,Harga Jual 1,Harga Jual 2,Stok,Satuan,Min Stok,Status\n'
    const rows = products.map(p => {
      const status = p.stock <= 0 ? 'Habis' : p.stock <= p.minStock ? 'Menipis' : 'Aman'
      return [p.sku, '"'+p.name+'"', p.category, p.buyPrice, p.sellPrice, p.sellPrice2||'', p.stock, p.unit, p.minStock, status].join(',')
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stok_barang_' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
    showToast('Export ' + products.length + ' produk berhasil')
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Stok Barang</h2><div style={{ display: 'flex', gap: 8 }}><button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={exportCSV}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Export CSV</button><ScanButton onClick={() => setShowScanner(true)} label="Scan" /><button style={S.primaryBtn} onClick={() => openForm(null)}>{IC.plus} Tambah Produk</button></div></div>

      {showScanner && <BarcodeScanner onScan={(code) => { setSearch(code); setShowScanner(false); showToast('Mencari: ' + code) }} onClose={() => setShowScanner(false)} />}

      <div style={S.grid4}>
        <div style={S.statCard}><div style={S.statLabel}>Total Produk</div><div style={S.statVal}>{products.length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Nilai Inventaris</div><div style={{ ...S.statVal, color: 'var(--b)' }}>{formatRp(totalValue)}</div></div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Stok Menipis</div>
          <div style={{ ...S.statVal, color: lowStock.length > 0 ? 'var(--r)' : 'var(--g)' }}>{lowStock.length} item</div>
        </div>
      </div>

      {lowStock.length > 0 && lowStock.length <= 10 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e65100' }}>
          {IC.warn} <strong>Stok menipis:</strong> {lowStock.map(p => p.name).join(', ')}
        </div>
      )}
      {lowStock.length > 10 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e65100' }}>
          {IC.warn} <strong>{lowStock.length} produk stok menipis!</strong> Gunakan filter "Stok Menipis" untuk melihat detail.
        </div>
      )}

      <div style={S.toolbar}>
        <div style={S.searchBox}>{IC.search}<input style={S.searchInput} placeholder="Cari produk / SKU..." value={search} onChange={e => { setSearch(e.target.value); setPage_(1) }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...S.filterBtn, ...(catFilter === 'all' ? S.filterActive : {}) }} onClick={() => { setCatFilter('all'); setPage_(1) }}>Semua</button>
          <button style={{ ...S.filterBtn, ...(catFilter === '_low' ? { background: '#c62828', color: '#fff', borderColor: '#c62828' } : { color: '#c62828' }) }} onClick={() => { setCatFilter('_low'); setPage_(1) }}>Stok Menipis ({lowStock.length})</button>
          {categories.length <= 8 ? (
            categories.map(c => <button key={c} style={{ ...S.filterBtn, ...(catFilter === c ? S.filterActive : {}) }} onClick={() => { setCatFilter(c); setPage_(1) }}>{c}</button>)
          ) : (
            <select style={{ ...S.input, padding: '5px 10px', fontSize: 12, minWidth: 140 }} value={catFilter === 'all' || catFilter === '_low' ? '' : catFilter} onChange={e => { setCatFilter(e.target.value || 'all'); setPage_(1) }}>
              <option value="">-- Kategori --</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Menampilkan {Math.min(pageSize, filtered.length - (page_ - 1) * pageSize)} dari {filtered.length} produk</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button style={{ ...S.smallBtn, border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} disabled={page_ <= 1} onClick={() => setPage_(page_ - 1)}>← Prev</button>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '0 8px' }}>{page_} / {totalPages}</span>
              <button style={{ ...S.smallBtn, border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} disabled={page_ >= totalPages} onClick={() => setPage_(page_ + 1)}>Next →</button>
            </div>
          )}
        </div>
        <table style={S.table}>
          <thead><tr>{['SKU', 'Nama Produk', 'Kategori', 'Harga Beli', 'Harga Jual', 'Stok', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{paginated.map(p => {
            const isLow = p.stock <= p.minStock
            return (
              <tr key={p.id} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                <td style={S.td}><span style={{ ...S.badge, background: catColor(p.category).bg, color: catColor(p.category).fg }}>{p.category}</span></td>
                <td style={S.td}>{formatRp(p.buyPrice)}</td>
                <td style={S.td}>{formatRp(p.sellPrice)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: isLow ? 'var(--r)' : 'var(--g)' }}>{p.stock} {p.unit}</td>
                <td style={S.td}>
                  {isLow ? <span style={{ ...S.badge, background: '#ffebee', color: '#c62828' }}>Menipis</span> :
                    <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Aman</span>}
                </td>
                <td style={S.td}>
                  <button style={S.smallBtn} onClick={() => openForm(p)}>{IC.edit}</button>
                  <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus ' + p.name + '?')) { await deleteProduct(p.id); showToast('Produk dihapus', 'error') } }}>{IC.trash}</button>
                </td>
              </tr>
            )
          })}{filtered.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data</td></tr>}</tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 16 }}>
            <button style={{ ...S.smallBtn, border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} disabled={page_ <= 1} onClick={() => setPage_(page_ - 1)}>← Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg = page_ <= 3 ? i + 1 : page_ >= totalPages - 2 ? totalPages - 4 + i : page_ - 2 + i
              if (pg < 1 || pg > totalPages) return null
              return <button key={pg} style={{ ...S.smallBtn, border: '1px solid', borderColor: pg === page_ ? '#1565c0' : '#e5e7eb', background: pg === page_ ? '#1565c0' : '#fff', color: pg === page_ ? '#fff' : '#333', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600 }} onClick={() => setPage_(pg)}>{pg}</button>
            })}
            <button style={{ ...S.smallBtn, border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} disabled={page_ >= totalPages} onClick={() => setPage_(page_ + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductForm({ initial, suppliers, onSave }) {
  const [d, setD] = useState(initial)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const margin = d.sellPrice && d.buyPrice ? Math.round(((d.sellPrice - d.buyPrice) / d.buyPrice) * 100) : 0
  return (
    <div style={S.form}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>SKU<input style={S.input} value={d.sku} onChange={e => set('sku', e.target.value)} /></label>
        <label style={S.formLabel}>Kategori
          <select style={S.input} value={d.category} onChange={e => set('category', e.target.value)}>
            {['Sembako', 'Makanan', 'Minuman', 'Toiletries', 'ATK', 'Lainnya'].map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label style={S.formLabel}>Nama Produk<input style={S.input} value={d.name} onChange={e => set('name', e.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Harga Beli (Rp)<input style={S.input} type="number" value={d.buyPrice} onChange={e => set('buyPrice', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Harga Jual (Rp)<input style={S.input} type="number" value={d.sellPrice} onChange={e => set('sellPrice', Number(e.target.value))} /></label>
      </div>
      {margin > 0 && <div style={{ padding: '6px 12px', background: '#e8f5e9', borderRadius: 8, fontSize: 12, color: '#2e7d32' }}>Margin: {margin}%</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Stok<input style={S.input} type="number" value={d.stock} onChange={e => set('stock', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Satuan<input style={S.input} value={d.unit} onChange={e => set('unit', e.target.value)} /></label>
        <label style={S.formLabel}>Min. Stok<input style={S.input} type="number" value={d.minStock} onChange={e => set('minStock', Number(e.target.value))} /></label>
      </div>
      <label style={S.formLabel}>Supplier
        <select style={S.input} value={d.supplierId} onChange={e => set('supplierId', e.target.value)}>
          <option value="">-- Pilih Supplier --</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave(d)}>Simpan</button>
    </div>
  )
}

// =============================================
// SUPPLIERS
// =============================================
export function Suppliers({ suppliers, saveSupplier, deleteSupplier, products, setModal, showToast }) {
  function openForm(supplier) {
    const isEdit = !!supplier
    const data = supplier ? { ...supplier } : { name: '', phone: '', address: '', contact: '', note: '' }
    setModal({
      title: isEdit ? 'Edit Supplier' : 'Tambah Supplier',
      content: <SupplierForm initial={data} onSave={async d => {
        await saveSupplier(isEdit ? { ...supplier, ...d } : d, isEdit)
        setModal(null)
        showToast(isEdit ? 'Supplier diperbarui' : 'Supplier ditambahkan')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Data Supplier</h2><button style={S.primaryBtn} onClick={() => openForm(null)}>{IC.plus} Tambah Supplier</button></div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Nama Supplier', 'Kontak', 'Telepon', 'Alamat', 'Produk', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{suppliers.map(s => {
            const prodCount = products.filter(p => p.supplierId === s.id).length
            return (
              <tr key={s.id} style={S.tr}>
                <td style={{ ...S.td, fontWeight: 600 }}>{s.name}</td>
                <td style={S.td}>{s.contact}</td>
                <td style={S.td}>{s.phone}</td>
                <td style={S.td}>{s.address}</td>
                <td style={S.td}><span style={{ ...S.badge, background: '#e3f2fd', color: '#1565c0' }}>{prodCount} item</span></td>
                <td style={S.td}>
                  <button style={S.smallBtn} onClick={() => openForm(s)}>{IC.edit}</button>
                  <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus supplier?')) { await deleteSupplier(s.id); showToast('Dihapus', 'error') } }}>{IC.trash}</button>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function SupplierForm({ initial, onSave }) {
  const [d, setD] = useState(initial)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Nama Supplier<input style={S.input} value={d.name} onChange={e => set('name', e.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Nama Kontak<input style={S.input} value={d.contact} onChange={e => set('contact', e.target.value)} /></label>
        <label style={S.formLabel}>Telepon<input style={S.input} value={d.phone} onChange={e => set('phone', e.target.value)} /></label>
      </div>
      <label style={S.formLabel}>Alamat<input style={S.input} value={d.address} onChange={e => set('address', e.target.value)} /></label>
      <label style={S.formLabel}>Catatan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave(d)}>Simpan</button>
    </div>
  )
}

// =============================================
// BARANG MASUK (Stock In)
// =============================================
export function StockIn({ stockIn, saveStockIn, products, suppliers, updateProductStock, setModal, showToast }) {
  const sorted = [...stockIn].sort((a, b) => b.date.localeCompare(a.date))
  const getSupplier = id => suppliers.find(s => s.id === id)

  function openForm() {
    setModal({
      title: 'Catat Barang Masuk',
      content: <StockInForm products={products} suppliers={suppliers} onSave={async d => {
        await saveStockIn(d)
        // Update stok produk
        for (const item of d.items) {
          const prod = products.find(p => p.id === item.productId)
          if (prod) await updateProductStock(prod.id, prod.stock + item.qty)
        }
        setModal(null)
        showToast('Barang masuk berhasil dicatat')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Barang Masuk</h2><button style={S.primaryBtn} onClick={openForm}>{IC.plus} Catat Barang Masuk</button></div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'No. Invoice', 'Supplier', 'Item', 'Total', 'Catatan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(s => {
            const sup = getSupplier(s.supplierId)
            return (
              <tr key={s.id} style={S.tr}>
                <td style={S.td}>{fmtDate(s.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{s.invoice}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{sup?.name || '-'}</td>
                <td style={S.td}>
                  {s.items.map((it, i) => {
                    const p = products.find(pr => pr.id === it.productId)
                    return <div key={i} style={{ fontSize: 12 }}>{p?.name || it.productId} × {it.qty}</div>
                  })}
                </td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--b)' }}>{formatRp(s.total)}</td>
                <td style={S.td}>{s.note || '-'}</td>
              </tr>
            )
          })}{sorted.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada data barang masuk</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function StockInForm({ products, suppliers, onSave }) {
  const [date, setDate] = useState(today())
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [invoice, setInvoice] = useState('INV-' + Date.now().toString().slice(-6))
  const [note, setNote] = useState('')
  const [items, setItems] = useState([{ productId: products[0]?.id || '', qty: 1, buyPrice: products[0]?.buyPrice || 0 }])

  function addItem() { setItems(prev => [...prev, { productId: products[0]?.id || '', qty: 1, buyPrice: products[0]?.buyPrice || 0 }]) }
  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i, k, v) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [k]: v }
      if (k === 'productId') {
        const p = products.find(pr => pr.id === v)
        if (p) updated.buyPrice = p.buyPrice
      }
      return updated
    }))
  }

  const total = items.reduce((a, it) => a + (it.qty * it.buyPrice), 0)

  return (
    <div style={S.form}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={S.formLabel}>No. Invoice<input style={S.input} value={invoice} onChange={e => setInvoice(e.target.value)} /></label>
      </div>
      <label style={S.formLabel}>Supplier
        <select style={S.input} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>Item Barang</div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <label style={S.formLabel}>Produk
            <select style={S.input} value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label style={S.formLabel}>Qty<input style={S.input} type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} /></label>
          <label style={S.formLabel}>Harga Beli<input style={S.input} type="number" value={it.buyPrice} onChange={e => updateItem(i, 'buyPrice', Number(e.target.value))} /></label>
          {items.length > 1 && <button style={{ ...S.smallBtn, color: 'var(--r)', marginBottom: 4 }} onClick={() => removeItem(i)}>{IC.x}</button>}
        </div>
      ))}
      <button style={{ ...S.filterBtn, width: '100%' }} onClick={addItem}>{IC.plus} Tambah Item</button>

      <label style={S.formLabel}>Catatan<input style={S.input} value={note} onChange={e => setNote(e.target.value)} /></label>

      <div style={{ padding: '10px 14px', background: '#f0f7ff', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--b)' }}>
        Total: {formatRp(total)}
      </div>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({ date, supplierId, invoice, note, items, total })}>
        Simpan Barang Masuk
      </button>
    </div>
  )
}

// =============================================
// KASIR / POS (Barang Keluar = Penjualan)
// =============================================
export function POS({ products, transactions, saveTransaction, updateProductStock, members, showToast, savePiutang, settings }) {
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [memberId, setMemberId] = useState('')
  const [payment, setPayment] = useState('')
  const [tab, setTab] = useState('kasir') // kasir | riwayat
  const [showScanner, setShowScanner] = useState(false)
  const [lastScanned, setLastScanned] = useState('')
  const [caraBayar, setCaraBayar] = useState('LUNAS') // LUNAS | KREDIT
  const [dp, setDp] = useState('')

  const filteredProducts = products.filter(p =>
    p.stock > 0 && (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  )

  function handleBarcodeScan(code) {
    // Cari produk berdasarkan SKU atau nama
    const found = products.find(p =>
      p.sku.toLowerCase() === code.toLowerCase() ||
      p.name.toLowerCase() === code.toLowerCase() ||
      p.sku.toLowerCase().includes(code.toLowerCase())
    )
    if (found) {
      if (found.stock <= 0) {
        showToast('Stok ' + found.name + ' habis', 'error')
        return
      }
      addToCart(found)
      setLastScanned(found.name)
      showToast('+ ' + found.name + ' ditambahkan ke keranjang')
    } else {
      showToast('Produk tidak ditemukan: ' + code, 'error')
      setLastScanned('Tidak ditemukan: ' + code)
    }
  }

  function addToCart(product) {
    // Pilih harga berdasarkan tipe pelanggan
    const member = members.find(m => m.id === memberId)
    const useHarga2 = member?.tingkatHrg === '2'
    const price = useHarga2 && product.sellPrice2 ? product.sellPrice2 : product.sellPrice

    setCart(prev => {
      const existing = prev.find(c => c.productId === product.id)
      if (existing) {
        if (existing.qty >= product.stock) return prev
        return prev.map(c => c.productId === product.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { productId: product.id, name: product.name, price, qty: 1, maxStock: product.stock, diskon: 0 }]
    })
  }

  function updateQty(productId, qty) {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.productId !== productId)); return }
    setCart(prev => prev.map(c => c.productId === productId ? { ...c, qty: Math.min(qty, c.maxStock) } : c))
  }

  function updateDiskon(productId, diskon) {
    setCart(prev => prev.map(c => c.productId === productId ? { ...c, diskon: Math.min(100, Math.max(0, Number(diskon))) } : c))
  }

  // Total setelah diskon per item
  const totalSebelumDiskon = cart.reduce((a, c) => a + (c.price * c.qty), 0)
  const totalDiskon = cart.reduce((a, c) => a + (c.price * c.qty * (c.diskon || 0) / 100), 0)
  const total = totalSebelumDiskon - totalDiskon
  const change = caraBayar === 'LUNAS' ? Number(payment) - total : Number(dp) - 0

  async function checkout() {
    if (cart.length === 0) { showToast('Keranjang kosong', 'error'); return }
    if (caraBayar === 'LUNAS' && Number(payment) < total) { showToast('Pembayaran kurang', 'error'); return }

    const noNota = 'N' + Date.now().toString().slice(-7)
    const tx = {
      noNota,
      date: today(),
      memberId: memberId || null,
      customerName: members.find(m => m.id === memberId)?.name || 'Umum',
      items: cart.map(c => ({ productId: c.productId, name: c.name, qty: c.qty, price: c.price, diskon: c.diskon || 0, subtotal: c.price * c.qty * (1 - (c.diskon || 0) / 100) })),
      totalSebelumDiskon,
      totalDiskon,
      total,
      payment: caraBayar === 'LUNAS' ? Number(payment) : Number(dp),
      change: caraBayar === 'LUNAS' ? Number(payment) - total : 0,
      caraBayar,
      cashier: 'user',
    }
    await saveTransaction(tx)

    // Kalau KREDIT, catat piutang
    if (caraBayar === 'KREDIT' && savePiutang) {
      await savePiutang({
        noNota, date: today(), memberId: memberId || null,
        customerName: members.find(m => m.id === memberId)?.name || 'Umum',
        total, dp: Number(dp) || 0, totalBayar: Number(dp) || 0,
        sisa: total - (Number(dp) || 0), status: 'KREDIT', payments: Number(dp) > 0 ? [{ date: today(), amount: Number(dp) }] : []
      })
    }

    // Kurangi stok
    for (const item of cart) {
      const prod = products.find(p => p.id === item.productId)
      if (prod) await updateProductStock(prod.id, prod.stock - item.qty)
    }

    // Cetak struk otomatis
    try { cetakStruk(tx, settings, members) } catch(e) { console.log('Struk print skipped:', e) }

    setCart([]); setPayment(''); setDp(''); setMemberId(''); setCaraBayar('LUNAS')
    showToast(caraBayar === 'LUNAS'
      ? 'Transaksi LUNAS! Kembalian: ' + formatRp(Number(payment) - total)
      : 'Transaksi KREDIT dicatat. Sisa piutang: ' + formatRp(total - (Number(dp) || 0)))
  }

  const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Kasir / POS</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <ScanButton onClick={() => setShowScanner(true)} label="Scan Barcode" />
          <div style={S.filterGroup}>
            <button style={{ ...S.filterBtn, ...(tab === 'kasir' ? S.filterActive : {}) }} onClick={() => setTab('kasir')}>Kasir</button>
            <button style={{ ...S.filterBtn, ...(tab === 'riwayat' ? S.filterActive : {}) }} onClick={() => setTab('riwayat')}>Riwayat Penjualan</button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => handleBarcodeScan(code)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Last scanned indicator */}
      {lastScanned && tab === 'kasir' && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#2e7d32', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Terakhir scan: <strong>{lastScanned}</strong></span>
          <button onClick={() => setLastScanned('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 16 }}>×</button>
        </div>
      )}

      {tab === 'kasir' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Product picker */}
          <div>
            <div style={{ ...S.searchBox, marginBottom: 12 }}>{IC.search}<input style={S.searchInput} placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {filteredProducts.map(p => (
                <div key={p.id} onClick={() => addToCart(p)}
                  style={{ background: '#fff', borderRadius: 10, padding: 14, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--b)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--b)' }}>{formatRp(p.sellPrice)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Stok: {p.stock} {p.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart panel */}
          <div style={{ ...S.card, position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              {IC.cart}
              <h3 style={S.cardTitle}>Keranjang ({cart.length})</h3>
            </div>

            {cart.length === 0 ? <p style={S.empty}>Klik produk untuk menambahkan</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {cart.map(c => {
                  const sub = c.price * c.qty
                  const afterDis = sub * (1 - (c.diskon || 0) / 100)
                  return (
                  <div key={c.productId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRp(c.price)} × {c.qty} = {formatRp(sub)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button style={{ ...S.smallBtn, border: '1px solid var(--border)', borderRadius: 4, padding: 2 }} onClick={() => updateQty(c.productId, c.qty - 1)}>{IC.minus}</button>
                        <span style={{ fontSize: 14, fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{c.qty}</span>
                        <button style={{ ...S.smallBtn, border: '1px solid var(--border)', borderRadius: 4, padding: 2 }} onClick={() => updateQty(c.productId, c.qty + 1)}>{IC.plus}</button>
                      </div>
                      <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={() => updateQty(c.productId, 0)}>{IC.x}</button>
                    </div>
                    {/* Diskon per item */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Diskon:</span>
                      <input style={{ width: 50, padding: '2px 6px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
                        type="number" min="0" max="100" value={c.diskon || 0} onChange={e => updateDiskon(c.productId, e.target.value)} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>%</span>
                      {c.diskon > 0 && <span style={{ fontSize: 11, color: '#c62828', fontWeight: 600 }}>-{formatRp(sub - afterDis)} → {formatRp(afterDis)}</span>}
                    </div>
                  </div>
                )})}
              </div>
            )}

            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
              {totalDiskon > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c62828', marginBottom: 4 }}>
                  <span>Subtotal: {formatRp(totalSebelumDiskon)}</span><span>Diskon: -{formatRp(totalDiskon)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                <span>TOTAL</span>
                <span style={{ color: 'var(--b)' }}>{formatRp(total)}</span>
              </div>

              <label style={S.formLabel}>Pelanggan / Anggota
                <select style={S.input} value={memberId} onChange={e => setMemberId(e.target.value)}>
                  <option value="">-- Umum (Harga Eceran) --</option>
                  {members.filter(m => m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.no} - {m.name} {m.tingkatHrg === '2' ? '(Grosir)' : ''}</option>)}
                </select>
              </label>

              {/* Cara Bayar: LUNAS / KREDIT */}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 8 }}>
                <button style={{ flex: 1, padding: '8px', border: '2px solid', borderColor: caraBayar === 'LUNAS' ? '#2e7d32' : '#e5e7eb', background: caraBayar === 'LUNAS' ? '#e8f5e9' : '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: caraBayar === 'LUNAS' ? '#2e7d32' : '#6b7280' }}
                  onClick={() => setCaraBayar('LUNAS')}>LUNAS</button>
                <button style={{ flex: 1, padding: '8px', border: '2px solid', borderColor: caraBayar === 'KREDIT' ? '#e65100' : '#e5e7eb', background: caraBayar === 'KREDIT' ? '#fff3e0' : '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: caraBayar === 'KREDIT' ? '#e65100' : '#6b7280' }}
                  onClick={() => setCaraBayar('KREDIT')}>KREDIT</button>
              </div>

              {caraBayar === 'LUNAS' ? (
                <>
                  <label style={{ ...S.formLabel, marginTop: 4 }}>Bayar (Rp)
                    <input style={{ ...S.input, fontSize: 18, fontWeight: 700 }} type="number" value={payment} onChange={e => setPayment(e.target.value)} placeholder="0" />
                  </label>
                  {Number(payment) > 0 && Number(payment) >= total && (
                    <div style={{ padding: '8px 12px', background: '#e8f5e9', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#2e7d32', marginTop: 8, textAlign: 'center' }}>
                      Kembalian: {formatRp(Number(payment) - total)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label style={{ ...S.formLabel, marginTop: 4 }}>Uang Muka / DP (Rp)
                    <input style={{ ...S.input, fontSize: 18, fontWeight: 700 }} type="number" value={dp} onChange={e => setDp(e.target.value)} placeholder="0 (boleh kosong)" />
                  </label>
                  <div style={{ padding: '8px 12px', background: '#fff3e0', borderRadius: 8, fontSize: 13, marginTop: 8, color: '#e65100' }}>
                    Sisa Piutang: <strong>{formatRp(total - (Number(dp) || 0))}</strong>
                  </div>
                </>
              )}

              <button style={{ ...S.primaryBtn, width: '100%', marginTop: 12, justifyContent: 'center', fontSize: 16, padding: '14px', background: caraBayar === 'KREDIT' ? '#e65100' : '#1565c0' }}
                disabled={cart.length === 0 || (caraBayar === 'LUNAS' && Number(payment) < total)}
                onClick={checkout}>
                {caraBayar === 'LUNAS' ? 'Bayar ' + formatRp(total) : 'Catat Kredit ' + formatRp(total)}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Riwayat Penjualan */
        <div style={S.card}>
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'No Nota', 'Pembeli', 'Item', 'Total', 'Bayar', 'Kembali', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{sortedTx.map(tx => {
              const m = members.find(mm => mm.id === tx.memberId)
              const isKredit = tx.caraBayar === 'KREDIT'
              return (
                <tr key={tx.id} style={S.tr}>
                  <td style={S.td}>{fmtDate(tx.date)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.noNota || '-'}</td>
                  <td style={S.td}>{m?.name || tx.customerName || 'Umum'}</td>
                  <td style={S.td}>{(tx.items || []).map((it, i) => <div key={i} style={{ fontSize: 12 }}>{it.name} × {it.qty}{it.diskon > 0 ? ' (-' + it.diskon + '%)' : ''}</div>)}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(tx.total)}</td>
                  <td style={S.td}>{formatRp(tx.payment)}</td>
                  <td style={{ ...S.td, color: isKredit ? '#e65100' : 'var(--g)' }}>{isKredit ? formatRp(tx.total - (tx.payment || 0)) : formatRp(tx.change || 0)}</td>
                  <td style={S.td}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: isKredit ? '#fff3e0' : '#e8f5e9', color: isKredit ? '#e65100' : '#2e7d32' }}>{isKredit ? 'KREDIT' : 'LUNAS'}</span></td>
                </tr>
              )
            })}{sortedTx.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada transaksi</td></tr>}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =============================================
// HELPERS
// =============================================
function catColor(cat) {
  const map = {
    Sembako: { bg: '#e8f5e9', fg: '#2e7d32' },
    Makanan: { bg: '#fff3e0', fg: '#e65100' },
    Minuman: { bg: '#e3f2fd', fg: '#1565c0' },
    Toiletries: { bg: '#fce4ec', fg: '#c62828' },
    ATK: { bg: '#f3e5f5', fg: '#7b1fa2' },
    Lainnya: { bg: '#f5f5f5', fg: '#616161' },
  }
  return map[cat] || map.Lainnya
}

// Shared styles (same as App.jsx)
const S = {
  title: { fontSize: 22, fontWeight: 700, marginBottom: 20 },
  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: 700 },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700 },
  table: { width: '100%', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  tr: { transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  smallBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280', display: 'inline-flex', borderRadius: 4 },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', flex: 1, maxWidth: 320 },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: { padding: '6px 14px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  filterActive: { background: '#1565c0', color: '#fff', borderColor: '#1565c0' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#6b7280' },
  input: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' },
  empty: { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },
}
