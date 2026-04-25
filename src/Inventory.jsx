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
export function Products({ products, saveProduct, deleteProduct, suppliers, setModal, showToast, transactions, stockInData }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showScanner, setShowScanner] = useState(false)
  const [page_, setPage_] = useState(1)
  const [showStokTgl, setShowStokTgl] = useState(false)
  const [stokTglDate, setStokTglDate] = useState(today())
  const [tipeFilter, setTipeFilter] = useState('all') // all | MILIK | TITIPAN
  const pageSize = 50

  const categories = [...new Set(products.map(p => p.category || 'Lainnya'))].filter(Boolean).sort()
  const filtered = products.filter(p => {
    if (catFilter === '_low') return (p.stock||0) <= (p.minStock || 10)
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (tipeFilter !== 'all' && (p.tipeBarang||'MILIK') !== tipeFilter) return false
    if (search && !String(p.name||'').toLowerCase().includes(search.toLowerCase()) && !String(p.sku||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Hitung stok per tanggal (stok sekarang - transaksi setelah tanggal + barang masuk setelah tanggal)
  function getStokPadaTanggal(productId, tgl) {
    const prod = products.find(p => p.id === productId)
    if (!prod) return 0
    let stok = prod.stock || 0
    // Tambah kembali stok yang terjual SETELAH tanggal tsb
    ;(transactions||[]).forEach(tx => {
      if (tx.date > tgl) {
        ;(tx.items||[]).forEach(it => { if (it.productId === productId) stok += (it.qty||0) })
      }
    })
    // Kurangi stok yang masuk SETELAH tanggal tsb
    ;(stockInData||[]).forEach(si => {
      if (si.date > tgl) {
        ;(si.items||[]).forEach(it => { if (it.productId === productId) stok -= (it.qty||0) })
      }
    })
    return Math.max(0, stok)
  }
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page_ - 1) * pageSize, page_ * pageSize)

  const totalValue = products.reduce((a, p) => a + ((p.stock||0) * (p.buyPrice||0)), 0)
  const lowStock = products.filter(p => (p.stock||0) <= (p.minStock||2) && p.name)

  function openForm(product) {
    const isEdit = !!product
    const data = product ? { ...product } : {
      sku: '', name: '', category: 'Sembako', buyPrice: '', sellPrice: '', sellPrice2: '',
      stock: 0, unit: 'pcs', minStock: 10, supplierId: suppliers[0]?.id || '',
      ppn: 0, qtyPerBox: 1, buyPriceBox: '', tipeBarang: 'MILIK'
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
      <div style={S.pageHead}><h2 style={S.title}>Stok Barang</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...S.primaryBtn, background: '#7b1fa2' }} onClick={() => setShowStokTgl(!showStokTgl)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Stok per Tanggal
          </button>
          <button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={exportCSV}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Export</button>
          <ScanButton onClick={() => setShowScanner(true)} label="Scan" />
          <button style={S.primaryBtn} onClick={() => openForm(null)}>{IC.plus} Tambah Produk</button>
        </div>
      </div>

      {/* Panel Stok per Tanggal */}
      {showStokTgl && (
        <div style={{ ...S.card, marginBottom: 16, border: '2px solid #7b1fa2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#7b1fa2' }}>Cek Stok pada Tanggal Tertentu</h3>
            <button style={S.smallBtn} onClick={() => setShowStokTgl(false)}>{IC.x}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 16 }}>
            <label style={S.formLabel}>Pilih Tanggal<input style={S.input} type="date" value={stokTglDate} onChange={e => setStokTglDate(e.target.value)} /></label>
            <span style={{ fontSize: 13, color: '#6b7280', paddingBottom: 10 }}>Stok pada {fmtDate(stokTglDate)}</span>
          </div>
          <table style={S.table}>
            <thead><tr>{['SKU', 'Nama Produk', 'Tipe', 'Stok Sekarang', 'Stok pd ' + stokTglDate.slice(8,10) + '/' + stokTglDate.slice(5,7), 'Selisih'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{paginated.map(p => {
              const stokTgl = getStokPadaTanggal(p.id, stokTglDate)
              const selisih = (p.stock||0) - stokTgl
              return (
                <tr key={p.id} style={S.tr}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{String(p.sku||'')}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: (p.tipeBarang||'MILIK')==='TITIPAN' ? '#fff3e0' : '#e8f5e9', color: (p.tipeBarang||'MILIK')==='TITIPAN' ? '#e65100' : '#2e7d32' }}>{p.tipeBarang||'MILIK'}</span></td>
                  <td style={S.td}>{p.stock||0} {p.unit||'pcs'}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: '#7b1fa2' }}>{stokTgl} {p.unit||'pcs'}</td>
                  <td style={{ ...S.td, color: selisih > 0 ? '#2e7d32' : selisih < 0 ? '#c62828' : '#6b7280' }}>{selisih > 0 ? '+' : ''}{selisih}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}

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
          <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'all' ? S.filterActive : {}) }} onClick={() => { setTipeFilter('all'); setPage_(1) }}>Semua Tipe</button>
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'MILIK' ? { background: '#2e7d32', color: '#fff', borderColor: '#2e7d32' } : {}) }} onClick={() => { setTipeFilter('MILIK'); setPage_(1) }}>Milik</button>
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'TITIPAN' ? { background: '#e65100', color: '#fff', borderColor: '#e65100' } : {}) }} onClick={() => { setTipeFilter('TITIPAN'); setPage_(1) }}>Titipan</button>
          <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
          <button style={{ ...S.filterBtn, ...(catFilter === '_titipan' ? { background: '#7b1fa2', color: '#fff', borderColor: '#7b1fa2' } : { color: '#7b1fa2' }) }} onClick={() => { setCatFilter('_titipan'); setPage_(1) }}>Titipan</button>
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
          <thead><tr>{['SKU', 'Nama Produk', 'Tipe', 'Kategori', 'Harga Beli', 'Harga Jual', 'Stok', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{paginated.map(p => {
            const isLow = (p.stock||0) <= (p.minStock||10)
            const isTitipan = (p.tipeBarang||'MILIK') === 'TITIPAN'
            return (
              <tr key={p.id} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{String(p.sku||'')}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                <td style={S.td}><span style={{ ...S.badge, background: isTitipan ? '#fff3e0' : '#e3f2fd', color: isTitipan ? '#e65100' : '#1565c0', fontSize: 10 }}>{isTitipan ? 'TITIPAN' : 'MILIK'}</span></td>
                <td style={S.td}><span style={{ ...S.badge, background: catColor(p.category).bg, color: catColor(p.category).fg }}>{p.category}</span></td>
                <td style={S.td}>{formatRp(p.buyPrice)}</td>
                <td style={S.td}>{formatRp(p.sellPrice)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: isLow ? 'var(--r)' : 'var(--g)' }}>{p.stock||0} {p.unit||'pcs'}</td>
                <td style={S.td}>
                  {isLow ? <span style={{ ...S.badge, background: '#ffebee', color: '#c62828' }}>Menipis</span> :
                    <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Aman</span>}
                </td>
                <td style={S.td}>
                  <button style={S.smallBtn} onClick={() => openForm(p)}>{IC.edit}</button>
                  <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus ' + p.name + '?')) { const ok = await deleteProduct(p.id); if (ok) showToast('Produk dihapus', 'error') } }}>{IC.trash}</button>
                </td>
              </tr>
            )
          })}{filtered.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data</td></tr>}</tbody>
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
  const [showScan, setShowScan] = useState(false)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))

  // Hitung harga per unit dari harga box + PPN
  const buyBox = Number(d.buyPriceBox) || 0
  const qtyBox = Number(d.qtyPerBox) || 1
  const ppnPct = Number(d.ppn) || 0
  const ppnAmount = Math.round(buyBox * ppnPct / 100)
  const totalWithPPN = buyBox + ppnAmount
  const pricePerUnit = qtyBox > 0 ? Math.round(totalWithPPN / qtyBox) : 0

  // Auto-set buyPrice jika pakai kalkulasi box
  function recalc(field, val) {
    const newD = { ...d, [field]: val }
    const box = Number(newD.buyPriceBox) || 0
    const qty = Number(newD.qtyPerBox) || 1
    const ppn = Number(newD.ppn) || 0
    if (box > 0) {
      const total = box + Math.round(box * ppn / 100)
      newD.buyPrice = qty > 0 ? Math.round(total / qty) : 0
    }
    setD(newD)
  }

  const margin = d.sellPrice && d.buyPrice ? Math.round(((d.sellPrice - d.buyPrice) / d.buyPrice) * 100) : 0

  return (
    <div style={S.form}>
      {/* Barcode / SKU */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ ...S.formLabel, flex: 1 }}>Barcode / SKU
          <input style={S.input} value={d.sku} onChange={e => set('sku', e.target.value)} placeholder="Scan atau ketik barcode..." />
        </label>
        <button type="button" style={{ ...S.primaryBtn, background: '#7b1fa2', height: 42 }} onClick={() => setShowScan(true)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>
          Scan
        </button>
      </div>
      {showScan && <BarcodeScanner onScan={(code) => { set('sku', String(code)); setShowScan(false) }} onClose={() => setShowScan(false)} />}

      <label style={S.formLabel}>Nama Produk<input style={S.input} value={d.name} onChange={e => set('name', e.target.value)} placeholder="Nama barang..." /></label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Kategori
          <select style={S.input} value={d.category} onChange={e => set('category', e.target.value)}>
            {['Sembako', 'Makanan', 'Minuman', 'Toiletries', 'ATK', 'Obat', 'Elektronik', 'Pakaian', 'Lainnya'].map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label style={S.formLabel}>Satuan<input style={S.input} value={d.unit} onChange={e => set('unit', e.target.value)} placeholder="pcs, botol, box..." /></label>
        <label style={S.formLabel}>Tipe Barang
          <select style={S.input} value={d.tipeBarang||'MILIK'} onChange={e => set('tipeBarang', e.target.value)}>
            <option value="MILIK">Milik Koperasi</option>
            <option value="TITIPAN">Barang Titipan</option>
          </select>
        </label>
      </div>

      {/* PPN & Harga Box */}
      <div style={{ background: '#f5f6fa', borderRadius: 10, padding: 14, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1565c0', marginBottom: 10 }}>Kalkulasi Harga Beli (opsional)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <label style={S.formLabel}>Harga Beli / Box (Rp)
            <input style={S.input} type="number" value={d.buyPriceBox||''} onChange={e => recalc('buyPriceBox', e.target.value)} placeholder="Harga 1 box/dus" />
          </label>
          <label style={S.formLabel}>Isi per Box/Dus
            <input style={S.input} type="number" min="1" value={d.qtyPerBox||1} onChange={e => recalc('qtyPerBox', e.target.value)} />
          </label>
          <label style={S.formLabel}>PPN (%)
            <input style={S.input} type="number" min="0" max="100" value={d.ppn||0} onChange={e => recalc('ppn', e.target.value)} />
          </label>
        </div>
        {buyBox > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div>Harga Box: <strong>{formatRp(buyBox)}</strong></div>
              <div>PPN {ppnPct}%: <strong style={{ color: '#c62828' }}>+{formatRp(ppnAmount)}</strong></div>
              <div>Total + PPN: <strong>{formatRp(totalWithPPN)}</strong></div>
              <div>Per Unit (÷{qtyBox}): <strong style={{ color: '#1565c0' }}>{formatRp(pricePerUnit)}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Harga Manual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Harga Beli / Unit (Rp)
          <input style={S.input} type="number" value={d.buyPrice} onChange={e => set('buyPrice', Number(e.target.value))} />
        </label>
        <label style={S.formLabel}>Harga Jual 1 (Rp)
          <input style={S.input} type="number" value={d.sellPrice} onChange={e => set('sellPrice', Number(e.target.value))} />
        </label>
        <label style={S.formLabel}>Harga Jual 2 / Grosir (Rp)
          <input style={S.input} type="number" value={d.sellPrice2||''} onChange={e => set('sellPrice2', Number(e.target.value))} placeholder="Opsional" />
        </label>
      </div>
      {margin > 0 && <div style={{ padding: '6px 12px', background: '#e8f5e9', borderRadius: 8, fontSize: 12, color: '#2e7d32' }}>Margin: {margin}%</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Stok<input style={S.input} type="number" value={d.stock} onChange={e => set('stock', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Min. Stok<input style={S.input} type="number" value={d.minStock} onChange={e => set('minStock', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Supplier
          <select style={S.input} value={d.supplierId} onChange={e => set('supplierId', e.target.value)}>
            <option value="">-- Pilih --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave(d)}>Simpan Produk</button>
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

  function openDetail(nota) {
    const sup = getSupplier(nota.supplierId)
    setModal({
      title: 'Detail Nota: ' + (nota.invoice||'-'),
      content: (
        <div style={{ fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, padding: 12, background: '#f5f6fa', borderRadius: 10 }}>
            <div><strong>No Invoice:</strong> {nota.invoice||'-'}</div>
            <div><strong>Tanggal:</strong> {fmtDate(nota.date)}</div>
            <div><strong>Supplier:</strong> {sup?.name||'-'}</div>
            <div><strong>Catatan:</strong> {nota.note||'-'}</div>
          </div>
          <table style={S.table}>
            <thead><tr>{['Produk', 'Qty', 'Harga Beli', 'Subtotal'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(nota.items||[]).map((it, i) => {
                const p = products.find(pr => pr.id === it.productId)
                return (
                  <tr key={i}><td style={S.td}>{String(p?.name||it.productId)}</td><td style={S.td}>{it.qty}</td>
                  <td style={S.td}>{formatRp(it.buyPrice||0)}</td><td style={{ ...S.td, fontWeight: 600 }}>{formatRp((it.qty||0)*(it.buyPrice||0))}</td></tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 12, padding: 12, background: '#f0f7ff', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Subtotal</span><strong>{formatRp(nota.subtotal||nota.total||0)}</strong></div>
            {(nota.ppnPct||0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#c62828' }}><span>PPN {nota.ppnPct}%</span><strong>+ {formatRp(nota.ppnAmount||0)}</strong></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#1565c0', borderTop: '1px solid #ddd', paddingTop: 6, marginTop: 4 }}><span>TOTAL</span><span>{formatRp(nota.total||0)}</span></div>
          </div>
          <button style={{ ...S.primaryBtn, width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={() => {
            const win = window.open('', '_blank')
            win.document.write('<html><head><style>body{font-family:Arial;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f5f5f5}.r{text-align:right}.b{font-weight:bold}@media print{button{display:none}}</style></head><body>')
            win.document.write('<h2>NOTA PEMBELIAN</h2>')
            win.document.write('<p>No: '+(nota.invoice||'-')+' | Tanggal: '+(nota.date||'')+' | Supplier: '+(sup?.name||'-')+'</p>')
            win.document.write('<table><tr><th>Produk</th><th>Qty</th><th class="r">Harga</th><th class="r">Subtotal</th></tr>')
            ;(nota.items||[]).forEach(it => { const p = products.find(pr => pr.id === it.productId); win.document.write('<tr><td>'+(p?.name||'-')+'</td><td>'+it.qty+'</td><td class="r">'+Number(it.buyPrice||0).toLocaleString('id-ID')+'</td><td class="r">'+Number((it.qty||0)*(it.buyPrice||0)).toLocaleString('id-ID')+'</td></tr>') })
            win.document.write('<tr class="b"><td colspan="3" class="r">Subtotal</td><td class="r">'+Number(nota.subtotal||nota.total||0).toLocaleString('id-ID')+'</td></tr>')
            if ((nota.ppnPct||0)>0) win.document.write('<tr><td colspan="3" class="r">PPN '+nota.ppnPct+'%</td><td class="r">+'+Number(nota.ppnAmount||0).toLocaleString('id-ID')+'</td></tr>')
            win.document.write('<tr class="b"><td colspan="3" class="r">TOTAL</td><td class="r">Rp '+Number(nota.total||0).toLocaleString('id-ID')+'</td></tr></table>')
            win.document.write('<script>setTimeout(()=>{window.print()},400)<\/script></body></html>')
            win.document.close()
          }}>Cetak Nota</button>
        </div>
      )
    })
  }

  function openForm() {
    setModal({
      title: 'Catat Barang Masuk',
      content: <StockInForm products={products} suppliers={suppliers} onSave={async d => {
        await saveStockIn(d)
        // Update stok produk
        for (const item of (d.items||[])) {
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
          <thead><tr>{['Tanggal', 'No. Invoice', 'Supplier', 'Item', 'Subtotal', 'PPN', 'Total', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(s => {
            const sup = getSupplier(s.supplierId)
            return (
              <tr key={s.id} style={S.tr}>
                <td style={S.td}>{fmtDate(s.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{s.invoice}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{sup?.name || '-'}</td>
                <td style={S.td}>
                  {(s.items||[]).map((it, i) => {
                    const p = products.find(pr => pr.id === it.productId)
                    return <div key={i} style={{ fontSize: 12 }}>{String(p?.name || it.productId)} × {it.qty} @ {formatRp(it.buyPrice||0)}</div>
                  })}
                </td>
                <td style={S.td}>{formatRp(s.subtotal || s.total || 0)}</td>
                <td style={S.td}>{(s.ppnPct||0) > 0 ? <span style={{ color: '#c62828' }}>{s.ppnPct}% (+{formatRp(s.ppnAmount||0)})</span> : '-'}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--b)' }}>{formatRp(s.total||0)}</td>
                <td style={S.td}><button style={{ ...S.smallBtn, color: '#1565c0', fontWeight: 600, fontSize: 12 }} onClick={() => openDetail(s)}>Detail</button></td>
              </tr>
            )
          })}{sorted.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada data barang masuk</td></tr>}</tbody>
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
  const [ppnPct, setPpnPct] = useState(0)
  const [items, setItems] = useState([{ productId: products[0]?.id || '', qty: 1, buyPrice: products[0]?.buyPrice || 0 }])
  const [showScanIdx, setShowScanIdx] = useState(-1)
  const [updateNotice, setUpdateNotice] = useState([])

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
      // Feature 9: Warn if new price > old price
      if (k === 'buyPrice') {
        const p = products.find(pr => pr.id === item.productId)
        if (p && v > (p.buyPrice||0)) {
          setUpdateNotice(prev => { const n = [...prev]; n[i] = 'Harga naik! ' + formatRp(p.buyPrice) + ' → ' + formatRp(v) + ' (harga jual akan otomatis diupdate)'; return n })
        } else {
          setUpdateNotice(prev => { const n = [...prev]; n[i] = ''; return n })
        }
      }
      return updated
    }))
  }

  // Feature 10: Scan barcode → cari produk yang sama → auto-select
  function handleBarcodeScan(code, itemIdx) {
    const found = products.find(p =>
      String(p.sku||'').toLowerCase() === code.toLowerCase() ||
      String(p.sku||'').toLowerCase().includes(code.toLowerCase())
    )
    setShowScanIdx(-1)
    if (found) {
      updateItem(itemIdx, 'productId', found.id)
      updateItem(itemIdx, 'buyPrice', found.buyPrice||0)
    } else {
      alert('Produk dengan barcode "' + code + '" tidak ditemukan.\nTambah produk baru dulu di Stok Barang.')
    }
  }

  const subtotal = items.reduce((a, it) => a + ((it.qty||0) * (it.buyPrice||0)), 0)
  const ppnAmount = Math.round(subtotal * (ppnPct||0) / 100)
  const total = subtotal + ppnAmount

  return (
    <div style={S.form}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={S.formLabel}>No. Invoice / Nota<input style={S.input} value={invoice} onChange={e => setInvoice(e.target.value)} /></label>
      </div>
      <label style={S.formLabel}>Supplier
        <select style={S.input} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>Item Barang</div>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
            <button type="button" style={{ ...S.filterBtn, padding: '8px', marginBottom: 2, color: '#7b1fa2' }} onClick={() => setShowScanIdx(i)} title="Scan Barcode">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>
            </button>
            <label style={S.formLabel}>Produk
              <select style={S.input} value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{String(p.sku||'')} - {p.name} (stok: {p.stock||0})</option>)}
              </select>
            </label>
            <label style={S.formLabel}>Qty<input style={S.input} type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} /></label>
            <label style={S.formLabel}>Harga Beli<input style={S.input} type="number" value={it.buyPrice} onChange={e => updateItem(i, 'buyPrice', Number(e.target.value))} /></label>
            {items.length > 1 && <button style={{ ...S.smallBtn, color: 'var(--r)', marginBottom: 4 }} onClick={() => removeItem(i)}>{IC.x}</button>}
          </div>
          {updateNotice[i] && <div style={{ fontSize: 11, color: '#e65100', padding: '2px 8px', background: '#fff3e0', borderRadius: 4, marginTop: 2 }}>{updateNotice[i]}</div>}
          {showScanIdx === i && <BarcodeScanner onScan={(code) => handleBarcodeScan(code, i)} onClose={() => setShowScanIdx(-1)} />}
        </div>
      ))}
      <button style={{ ...S.filterBtn, width: '100%' }} onClick={addItem}>{IC.plus} Tambah Item</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>PPN (%)<input style={S.input} type="number" min="0" max="100" value={ppnPct} onChange={e => setPpnPct(Number(e.target.value))} /></label>
        <label style={S.formLabel}>Catatan<input style={S.input} value={note} onChange={e => setNote(e.target.value)} /></label>
      </div>

      <div style={{ padding: '12px 16px', background: '#f0f7ff', borderRadius: 10, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Subtotal ({items.length} item)</span><strong>{formatRp(subtotal)}</strong>
        </div>
        {ppnPct > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#c62828' }}>
            <span>PPN {ppnPct}%</span><strong>+ {formatRp(ppnAmount)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--b)', borderTop: '1px solid #ddd', paddingTop: 6, marginTop: 4 }}>
          <span>TOTAL</span><span>{formatRp(total)}</span>
        </div>
      </div>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({ date, supplierId, invoice, note, items, subtotal, ppnPct, ppnAmount, total })}>
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
    p.stock > 0 && (search === '' || String(p.name||'').toLowerCase().includes(search.toLowerCase()) || String(p.sku||'').toLowerCase().includes(search.toLowerCase()))
  )

  function handleBarcodeScan(code) {
    // Cari produk berdasarkan SKU atau nama
    const found = products.find(p =>
      String(p.sku||'').toLowerCase() === code.toLowerCase() ||
      String(p.name||'').toLowerCase() === code.toLowerCase() ||
      String(p.sku||'').toLowerCase().includes(code.toLowerCase())
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
  const totalSebelumDiskon = cart.reduce((a, c) => a + ((c.price||0) * (c.qty||0)), 0)
  const totalDiskon = cart.reduce((a, c) => a + ((c.price||0) * (c.qty||0) * (c.diskon || 0) / 100), 0)
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
                <select style={S.input} value={memberId} onChange={e => {
                  const newMid = e.target.value
                  setMemberId(newMid)
                  // Update harga di keranjang sesuai tipe pelanggan
                  const m = members.find(x => x.id === newMid)
                  const useH2 = m?.tingkatHrg === '2'
                  setCart(prev => prev.map(c => {
                    const prod = products.find(p => p.id === c.productId)
                    if (!prod) return c
                    const newPrice = useH2 && prod.sellPrice2 ? prod.sellPrice2 : prod.sellPrice
                    return { ...c, price: newPrice }
                  }))
                }}>
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
