// =============================================
// MODUL INVENTARIS KOPERASI
// Barang, Supplier, Barang Masuk, Kasir/POS
// =============================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { BarcodeScanner, ScanButton } from './BarcodeScanner'
import { cetakStruk } from './Extra'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { 
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

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
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkThreshold, setBulkThreshold] = useState(0)
  const [dateFilter, setDateFilter] = useState('') // filter by updatedAt date
  const pageSize = 50

  const defaultCategories = ['Sembako', 'Makanan', 'Minuman', 'Rokok', 'Sabun', 'Alat Mandi', 'Toiletries', 'ATK', 'Obat', 'Elektronik', 'Pakaian', 'Pakaian KAP TNI', 'Pangkat', 'Barcil', 'Perabotan Rumah', 'Lainnya']
  const extraCats = [...new Set(products.map(p => p.category || 'Lainnya'))].filter(c => c && !defaultCategories.includes(c)).sort()
  const categories = [...defaultCategories, ...extraCats]
  const filtered = products.filter(p => {
    if (catFilter === '_low') return (p.stock||0) <= (p.minStock || 10)
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (tipeFilter !== 'all' && (p.tipeBarang||'MILIK') !== tipeFilter) return false
    if (dateFilter && (p.updatedAt||p.createdAt||'') !== dateFilter) return false
    if (search && !String(p.name||'').toLowerCase().includes(search.toLowerCase()) && !String(p.sku||'').toLowerCase().includes(search.toLowerCase()) && !String(p.barcode||'').toLowerCase().includes(search.toLowerCase())) return false
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
      sku: '', name: '', barcode: '', category: 'Sembako', buyPrice: '', sellPrice: '', sellPrice2: '',
      stock: 0, unit: 'pcs', minStock: 10, supplierId: suppliers[0]?.id || '',
      ppn: 0, qtyPerBox: 1, buyPriceBox: '', tipeBarang: 'MILIK'
    }
    setModal({
      title: isEdit ? 'Edit Produk' : 'Tambah Produk',
      content: <ProductForm initial={data} suppliers={suppliers} existingCategories={categories} onSave={async d => {
        await saveProduct(isEdit ? { ...product, ...d } : d, isEdit)
        setModal(null)
        showToast(isEdit ? 'Produk diperbarui' : 'Produk ditambahkan')
      }} />,
    })
  }

  function exportCSV() {
    const header = 'SKU,Nama Produk,Kategori,Harga Beli,Harga Jual Lunas,Harga Jual Kredit,Stok,Satuan,Min Stok,Status,Terakhir Update\n'
    const rows = products.map(p => {
      const status = p.stock <= 0 ? 'Habis' : p.stock <= p.minStock ? 'Menipis' : 'Aman'
      return [p.sku, '"'+p.name+'"', p.category, p.buyPrice, p.sellPrice, p.sellPrice2||'', p.stock, p.unit, p.minStock, status, p.updatedAt||''].join(',')
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stok_barang_' + today() + '.csv'
    a.click()
    showToast('Export ' + products.length + ' produk berhasil')
  }

  // Hapus massal barang berdasarkan threshold stok
  const bulkProducts = products.filter(p => (p.stock||0) <= bulkThreshold)
  async function bulkDeleteProducts() {
    if (bulkProducts.length === 0) { showToast('Tidak ada produk dengan stok ≤ ' + bulkThreshold, 'error'); return }
    const confirm1 = confirm('Hapus ' + bulkProducts.length + ' produk dengan stok ≤ ' + bulkThreshold + '?\n\nDaftar:\n' + bulkProducts.slice(0, 15).map(p => '- ' + p.name + ' (stok: ' + (p.stock||0) + ')').join('\n') + (bulkProducts.length > 15 ? '\n... dan ' + (bulkProducts.length - 15) + ' lainnya' : '') + '\n\nAKSI INI TIDAK BISA DIBATALKAN!')
    if (!confirm1) return
    let deleted = 0
    for (const p of bulkProducts) {
      try { await deleteProduct(p.id); deleted++ } catch(e) { console.error('Gagal hapus:', p.name, e) }
    }
    showToast(deleted + ' produk berhasil dihapus', 'error')
    setShowBulkDelete(false)
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
          <button style={{ ...S.primaryBtn, background: '#c62828' }} onClick={() => setShowBulkDelete(!showBulkDelete)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Hapus Massal
          </button>
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

      {/* Panel Hapus Massal */}
      {showBulkDelete && (
        <div style={{ ...S.card, marginBottom: 16, border: '2px solid #c62828', background: '#fff8f8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#c62828' }}>Hapus Massal Barang</h3>
            <button style={S.smallBtn} onClick={() => setShowBulkDelete(false)}>{IC.x}</button>
          </div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Pilih batas stok, semua produk dengan stok ≤ angka yang dipilih akan dihapus.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={S.formLabel}>Hapus produk dengan stok ≤
              <select style={{ ...S.input, minWidth: 120 }} value={bulkThreshold} onChange={e => setBulkThreshold(Number(e.target.value))}>
                <option value={0}>0 (Habis)</option>
                <option value={1}>≤ 1</option>
                <option value={2}>≤ 2</option>
                <option value={3}>≤ 3</option>
                <option value={5}>≤ 5</option>
                <option value={10}>≤ 10</option>
                <option value={20}>≤ 20</option>
                <option value={50}>≤ 50</option>
              </select>
            </label>
            <div style={{ padding: '8px 14px', background: bulkProducts.length > 0 ? '#ffebee' : '#e8f5e9', borderRadius: 8, fontSize: 14, fontWeight: 700, color: bulkProducts.length > 0 ? '#c62828' : '#2e7d32' }}>
              {bulkProducts.length} produk ditemukan
            </div>
            <button style={{ ...S.primaryBtn, background: '#c62828' }} disabled={bulkProducts.length === 0} onClick={bulkDeleteProducts}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
              Hapus {bulkProducts.length} Produk
            </button>
          </div>
          {bulkProducts.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ ...S.table, fontSize: 12 }}>
                <thead><tr>{['Nama', 'SKU', 'Stok', 'Kategori'].map(h => <th key={h} style={{ ...S.th, padding: '6px 10px', fontSize: 11 }}>{h}</th>)}</tr></thead>
                <tbody>{bulkProducts.map(p => (
                  <tr key={p.id} style={S.tr}>
                    <td style={{ ...S.td, padding: '4px 10px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ ...S.td, padding: '4px 10px', fontFamily: 'monospace' }}>{p.sku||'-'}</td>
                    <td style={{ ...S.td, padding: '4px 10px', color: '#c62828', fontWeight: 700 }}>{p.stock||0} {p.unit||'pcs'}</td>
                    <td style={{ ...S.td, padding: '4px 10px' }}>{p.category}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={S.searchBox}>{IC.search}<input style={S.searchInput} placeholder="Cari produk / SKU..." value={search} onChange={e => { setSearch(e.target.value); setPage_(1) }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input style={{ ...S.input, padding: '7px 10px', fontSize: 12, width: 145 }} type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage_(1) }} title="Filter tanggal update" />
            {dateFilter && <button style={{ ...S.smallBtn, color: '#c62828', fontSize: 16, padding: '2px 6px' }} onClick={() => { setDateFilter(''); setPage_(1) }} title="Hapus filter tanggal">×</button>}
          </div>
          {dateFilter && <span style={{ fontSize: 12, color: '#1565c0', fontWeight: 600 }}>Update: {fmtDate(dateFilter)} ({filtered.length} produk)</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...S.filterBtn, ...(catFilter === 'all' ? S.filterActive : {}) }} onClick={() => { setCatFilter('all'); setPage_(1) }}>Semua</button>
          <button style={{ ...S.filterBtn, ...(catFilter === '_low' ? { background: '#c62828', color: '#fff', borderColor: '#c62828' } : { color: '#c62828' }) }} onClick={() => { setCatFilter('_low'); setPage_(1) }}>Stok Menipis ({lowStock.length})</button>
          <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'all' ? S.filterActive : {}) }} onClick={() => { setTipeFilter('all'); setPage_(1) }}>Semua Tipe</button>
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'MILIK' ? { background: '#2e7d32', color: '#fff', borderColor: '#2e7d32' } : {}) }} onClick={() => { setTipeFilter('MILIK'); setPage_(1) }}>Milik</button>
          <button style={{ ...S.filterBtn, ...(tipeFilter === 'TITIPAN' ? { background: '#e65100', color: '#fff', borderColor: '#e65100' } : {}) }} onClick={() => { setTipeFilter('TITIPAN'); setPage_(1) }}>Titipan</button>
          <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
          <select style={{ ...S.input, padding: '5px 10px', fontSize: 12, minWidth: 160, fontWeight: catFilter !== 'all' && catFilter !== '_low' ? 700 : 400, borderColor: catFilter !== 'all' && catFilter !== '_low' && catFilter !== '_titipan' ? '#1565c0' : '#e5e7eb' }} value={catFilter === 'all' || catFilter === '_low' ? '' : catFilter} onChange={e => { setCatFilter(e.target.value || 'all'); setPage_(1) }}>
            <option value="">-- Semua Kategori --</option>
            {categories.map(c => {
              const count = products.filter(p => (p.category||'Lainnya') === c).length
              return <option key={c} value={c}>{c} ({count})</option>
            })}
          </select>
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
          <thead><tr>{['SKU', 'Nama Produk', 'Tipe', 'Kategori', 'Harga Beli', 'Harga Jual', 'Stok', 'Update', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{paginated.map(p => {
            const isLow = (p.stock||0) <= (p.minStock||10)
            const isTitipan = (p.tipeBarang||'MILIK') === 'TITIPAN'
            return (
              <tr key={p.id} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{String(p.sku||'')}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                <td style={S.td}><span style={{ ...S.badge, background: isTitipan ? '#fff3e0' : '#e3f2fd', color: isTitipan ? '#e65100' : '#1565c0', fontSize: 10 }}>{isTitipan ? 'TITIPAN' : 'MILIK'}</span></td>
                <td style={S.td}><span style={{ ...S.badge, background: catColor(p.category).bg, color: catColor(p.category).fg }}>{p.category}</span></td>
                <td style={S.td}>
                  <div>{formatRp(p.buyPrice)}</div>
                  {(p.ppn||0) > 0 && <div style={{ fontSize: 10, color: '#c62828', marginTop: 2 }}>+PPN {p.ppn}% ({formatRp(Math.round((p.buyPriceBox||p.buyPrice||0) * p.ppn / 100))})</div>}
                </td>
                <td style={S.td}>{formatRp(p.sellPrice)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: isLow ? 'var(--r)' : 'var(--g)' }}>{p.stock||0} {p.unit||'pcs'}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>{p.updatedAt ? fmtDate(p.updatedAt) : '-'}</td>
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
          })}{filtered.length === 0 && <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data</td></tr>}</tbody>
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

function ProductForm({ initial, suppliers, onSave, existingCategories }) {
  const [d, setD] = useState(initial)
  const [showScan, setShowScan] = useState(false)
  const [customCat, setCustomCat] = useState('')
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
      {/* SKU & Barcode Produk */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ ...S.formLabel, flex: 1 }}>SKU (kode internal)
          <input style={S.input} value={d.sku} onChange={e => set('sku', e.target.value)} placeholder="Kode SKU internal..." />
        </label>
        <label style={{ ...S.formLabel, flex: 1 }}>Barcode Produk (dari kemasan)
          <div style={{ display: 'flex', gap: 4 }}>
            <input style={S.input} value={d.barcode||''} onChange={e => set('barcode', e.target.value)} placeholder="Scan / ketik barcode kemasan..." />
            <button type="button" style={{ ...S.primaryBtn, background: '#7b1fa2', height: 42, minWidth: 42, padding: '0 8px' }} onClick={() => setShowScan(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>
            </button>
          </div>
        </label>
      </div>
      {showScan && <BarcodeScanner onScan={(code) => { set('barcode', String(code)); setShowScan(false) }} onClose={() => setShowScan(false)} />}

      <label style={S.formLabel}>Nama Produk<input style={S.input} value={d.name} onChange={e => set('name', e.target.value)} placeholder="Nama barang..." /></label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Kategori
          <select style={S.input} value={d.category === '__custom__' ? '__custom__' : d.category} onChange={e => {
            const val = e.target.value
            if (val === '__custom__') { set('category', '__custom__'); setCustomCat('') }
            else { set('category', val); setCustomCat('') }
          }}>
            {(() => {
              const defaults = ['Sembako', 'Makanan', 'Minuman', 'Rokok', 'Sabun', 'Alat Mandi', 'Toiletries', 'ATK', 'Obat', 'Elektronik', 'Pakaian', 'Pakaian KAP TNI', 'Pangkat', 'Barcil', 'Perabotan Rumah', 'Lainnya']
              const extra = (existingCategories||[]).filter(c => c && !defaults.includes(c) && c !== '__custom__')
              return [...defaults, ...extra].map(c => <option key={c} value={c}>{c}</option>)
            })()}
            <option value="__custom__">+ Tambah Kategori Baru...</option>
          </select>
          {d.category === '__custom__' && (
            <input style={{ ...S.input, marginTop: 4, borderColor: '#1565c0' }} value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Ketik nama kategori baru..." autoFocus />
          )}
        </label>
        <label style={S.formLabel}>Satuan
          <select style={S.input} value={d.unit} onChange={e => set('unit', e.target.value)}>
            {['pcs', 'buah', 'lbr', 'bks', 'btl', 'box', 'dus', 'kg', 'gram', 'ltr', 'ml', 'sct', 'pak', 'roll', 'set', 'lusin', 'rim', 'pasang', 'unit', 'kaleng', 'botol', 'karung'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
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
        <label style={S.formLabel}>Harga Jual Lunas (Rp)
          <input style={S.input} type="number" value={d.sellPrice} onChange={e => set('sellPrice', Number(e.target.value))} />
        </label>
        <label style={S.formLabel}>Harga Jual Kredit (Rp)
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
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => {
        const saveData = { ...d }
        if (saveData.category === '__custom__') {
          if (!customCat.trim()) { alert('Nama kategori baru tidak boleh kosong'); return }
          saveData.category = customCat.trim()
        }
        onSave(saveData)
      }}>Simpan Produk</button>
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
export function StockIn({ stockIn, saveStockIn, products, suppliers, updateProductStock, saveProduct, setModal, showToast }) {
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [supFilter, setSupFilter] = useState('all')

  const getSupplier = id => suppliers.find(s => s.id === id)

  // Filter data
  const filtered = [...stockIn].filter(s => {
    if (dateFrom && s.date < dateFrom) return false
    if (dateTo && s.date > dateTo) return false
    if (supFilter !== 'all' && s.supplierId !== supFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const sup = getSupplier(s.supplierId)
      const itemNames = (s.items||[]).map(it => { const p = products.find(pr => pr.id === it.productId); return (p?.name||'').toLowerCase() }).join(' ')
      if (!(s.invoice||'').toLowerCase().includes(q) && !(sup?.name||'').toLowerCase().includes(q) && !itemNames.includes(q)) return false
    }
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  const totalFiltered = filtered.reduce((a, s) => a + (s.total||0), 0)
  const totalPPN = filtered.reduce((a, s) => a + (s.ppnAmount||0), 0)

  // Export ke CSV/Excel
  function exportExcel() {
    const header = 'Tanggal,No Invoice,Supplier,Kode Barang,Nama Barang,Jumlah,Satuan,Harga Beli,Subtotal Item,PPN %,PPN Rp,Total Nota,Jenis Bayar,Catatan\n'
    const rows = []
    filtered.forEach(s => {
      const sup = getSupplier(s.supplierId)
      ;(s.items||[]).forEach((it, idx) => {
        const p = products.find(pr => pr.id === it.productId)
        rows.push([
          s.date,
          '"'+(s.invoice||'')+'"',
          '"'+(sup?.name||'-')+'"',
          '"'+(p?.sku||'')+'"',
          '"'+(p?.name||it.productId)+'"',
          it.qty||0,
          '"'+(p?.unit||'pcs')+'"',
          it.buyPrice||0,
          (it.qty||0)*(it.buyPrice||0),
          idx === 0 ? (s.ppnPct||0) : '',
          idx === 0 ? (s.ppnAmount||0) : '',
          idx === 0 ? (s.total||0) : '',
          idx === 0 ? '"'+(s.jenisBayar||'TUNAI')+'"' : '',
          idx === 0 ? '"'+(s.note||'')+'"' : '',
        ].join(','))
      })
    })
    const bom = '\uFEFF'
    const blob = new Blob([bom + header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'laporan_barang_masuk_' + (dateFrom||'all') + '_' + (dateTo||today()) + '.csv'
    a.click()
    showToast('Export ' + filtered.length + ' transaksi berhasil')
  }

  // Print laporan rekapitulasi — format mirip VB app
  function printLaporan() {
    // Gabungkan semua item dari semua nota yang terfilter → rekapitulasi per produk
    const rekapMap = {}
    filtered.forEach(s => {
      ;(s.items||[]).forEach(it => {
        const p = products.find(pr => pr.id === it.productId)
        const key = it.productId
        if (!rekapMap[key]) {
          rekapMap[key] = {
            kode: p?.barcode || p?.sku || '-',
            nama: p?.name || it.productId,
            jumlah: 0,
            totalHpp: 0,
          }
        }
        rekapMap[key].jumlah += (it.qty || 0)
        rekapMap[key].totalHpp += (it.qty || 0) * (it.buyPrice || 0)
      })
    })
    const rekapList = Object.values(rekapMap).sort((a, b) => a.nama.localeCompare(b.nama))
    const grandQty = rekapList.reduce((a, r) => a + r.jumlah, 0)
    const grandTotal = rekapList.reduce((a, r) => a + r.totalHpp, 0)

    const periodFrom = dateFrom || (filtered.length > 0 ? filtered[filtered.length - 1].date : today())
    const periodTo = dateTo || (filtered.length > 0 ? filtered[0].date : today())

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
      .header-icon { font-size: 32px; }
      .header-text h2 { margin: 0; font-size: 16px; color: #c62828; }
      .header-text h3 { margin: 2px 0 0 0; font-size: 13px; color: #333; font-weight: 600; }
      .period { text-align: right; font-size: 11px; color: #666; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #1a237e; color: #fdd835; padding: 6px 10px; text-align: left; font-size: 11px; border: 1px solid #1a237e; }
      th.r { text-align: right; }
      td { border: 1px solid #ccc; padding: 5px 10px; font-size: 12px; }
      td.r { text-align: right; }
      td.c { text-align: center; }
      .total-row td { background: #fff3e0; font-weight: bold; font-size: 13px; border: 2px solid #1a237e; }
      .footer { margin-top: 20px; text-align: right; font-size: 10px; color: #999; }
      @media print { button { display: none; } }
    </style></head><body>`)

    win.document.write('<div class="header"><div class="header-icon">📋</div><div class="header-text"><h2>LAPORAN :</h2><h3>REKAPITULASI PENAMBAHAN BARANG</h3></div></div>')
    win.document.write('<div class="period">Periode Tanggal : ' + fmtDate(periodFrom) + ' s/d ' + fmtDate(periodTo) + '</div>')
    win.document.write('<hr style="border:1px solid #c62828;margin-bottom:10px">')

    win.document.write('<table><tr><th>NO.</th><th>KODE BARANG</th><th>NAMA BARANG</th><th class="r">JUMLAH</th><th class="r">TOTAL HPP</th></tr>')

    rekapList.forEach((r, idx) => {
      win.document.write('<tr>')
      win.document.write('<td class="c">' + (idx + 1) + '</td>')
      win.document.write('<td style="font-family:monospace">' + r.kode + '</td>')
      win.document.write('<td>' + r.nama + '</td>')
      win.document.write('<td class="r">' + Number(r.jumlah).toLocaleString('id-ID') + '</td>')
      win.document.write('<td class="r">' + Number(r.totalHpp).toLocaleString('id-ID') + '</td>')
      win.document.write('</tr>')
    })

    win.document.write('<tr class="total-row"><td colspan="3" class="r">GRAND TOTAL :</td><td class="r">' + Number(grandQty).toLocaleString('id-ID') + '</td><td class="r">' + Number(grandTotal).toLocaleString('id-ID') + '</td></tr>')
    win.document.write('</table>')
    win.document.write('<div class="footer">Dicetak: ' + new Date().toLocaleString('id-ID') + '</div>')
    win.document.write('<script>setTimeout(()=>{window.print()},500)<\/script></body></html>')
    win.document.close()
  }

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
        // Proses setiap item — buat/update produk
        const processedItems = []
        for (const item of (d.items||[])) {
          let prodId = item.productId
          let prod = products.find(p => p.id === prodId)

          if (!prod && item.productName) {
            // Cek apakah ada produk existing dengan nama sama
            prod = products.find(p => p.name.toLowerCase() === item.productName.toLowerCase())
            if (prod) {
              prodId = prod.id
            }
          }

          if (prod) {
            // PRODUK EXISTING — update stok & harga langsung via setOne
            prodId = prod.id
            const newStock = (prod.stock||0) + (item.qty||0)
            const updatedProd = { ...prod, stock: newStock, updatedAt: today() }
            if (item.buyPrice && item.buyPrice > 0) updatedProd.buyPrice = item.buyPrice
            if (item.sellPrice && item.sellPrice > 0) updatedProd.sellPrice = item.sellPrice
            if (item.sellPrice2 && item.sellPrice2 > 0) updatedProd.sellPrice2 = item.sellPrice2
            await saveProduct(updatedProd, true) // isEdit=true → langsung overwrite
          } else if (item.productName) {
            // PRODUK BARU — buat dengan stok sudah terisi
            const newProd = {
              name: item.productName,
              sku: item.sku || '',
              barcode: item.barcode || '',
              category: 'Lainnya',
              buyPrice: item.buyPrice || 0,
              sellPrice: item.sellPrice || 0,
              sellPrice2: item.sellPrice2 || 0,
              stock: item.qty || 0, // ← Stok langsung diisi jumlah barang masuk
              unit: 'pcs',
              minStock: 5,
              ppn: 0,
              qtyPerBox: 1,
              buyPriceBox: '',
              tipeBarang: 'MILIK',
              supplierId: d.supplierId || '',
            }
            await saveProduct(newProd, false) // isEdit=false → buat baru + generate id
            prodId = newProd.id
          }

          processedItems.push({ ...item, productId: prodId })
        }

        await saveStockIn({ ...d, items: processedItems })
        setModal(null)
        showToast('Barang masuk berhasil dicatat — stok diperbarui')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Barang Masuk</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={exportExcel}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export Excel
          </button>
          <button style={{ ...S.primaryBtn, background: '#6a1b9a' }} onClick={printLaporan}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Laporan
          </button>
          <button style={S.primaryBtn} onClick={openForm}>{IC.plus} Catat Barang Masuk</button>
        </div>
      </div>

      {/* Filter & Ringkasan */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ ...S.formLabel, marginBottom: 0 }}>Dari
            <input style={{ ...S.input, padding: '6px 10px', fontSize: 12 }} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label style={{ ...S.formLabel, marginBottom: 0 }}>Sampai
            <input style={{ ...S.input, padding: '6px 10px', fontSize: 12 }} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <label style={{ ...S.formLabel, marginBottom: 0 }}>Supplier
            <select style={{ ...S.input, padding: '6px 10px', fontSize: 12, minWidth: 140 }} value={supFilter} onChange={e => setSupFilter(e.target.value)}>
              <option value="all">-- Semua Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </label>
          <div style={{ ...S.searchBox, flex: 1, minWidth: 180 }}>{IC.search}<input style={S.searchInput} placeholder="Cari invoice / supplier / barang..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {(dateFrom || dateTo || supFilter !== 'all' || search) && (
            <button style={{ ...S.filterBtn, color: '#c62828', fontSize: 12 }} onClick={() => { setDateFrom(''); setDateTo(''); setSupFilter('all'); setSearch('') }}>Reset Filter</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', background: '#e3f2fd', borderRadius: 8, fontSize: 13 }}>
            <span style={{ color: '#666' }}>Transaksi: </span><strong style={{ color: '#1565c0' }}>{filtered.length}</strong>
          </div>
          {totalPPN > 0 && (
            <div style={{ padding: '8px 16px', background: '#ffebee', borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: '#666' }}>Total PPN: </span><strong style={{ color: '#c62828' }}>{formatRp(totalPPN)}</strong>
            </div>
          )}
          <div style={{ padding: '8px 16px', background: '#e8f5e9', borderRadius: 8, fontSize: 13 }}>
            <span style={{ color: '#666' }}>Total Pembelian: </span><strong style={{ color: '#2e7d32' }}>{formatRp(totalFiltered)}</strong>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'No. Invoice', 'Supplier', 'Item', 'Subtotal', 'PPN', 'Total', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(s => {
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
          })}{filtered.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data barang masuk</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function StockInForm({ products, suppliers, onSave }) {
  const [date, setDate] = useState(today())
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [invoice, setInvoice] = useState('T' + Date.now().toString().slice(-4))
  const [note, setNote] = useState('')
  const [ppnPct, setPpnPct] = useState(0)
  const [jenisBayar, setJenisBayar] = useState('TUNAI')
  const [jatuhTempo, setJatuhTempo] = useState('')
  const [items, setItems] = useState([])
  const [showScanIdx, setShowScanIdx] = useState(-1)
  const [scanInput, setScanInput] = useState('')
  const [totalNota, setTotalNota] = useState('')

  const selectedSup = suppliers.find(s => s.id === supplierId)

  // Tambah baris kosong untuk input manual
  function addItem() {
    setItems(prev => [...prev, {
      productId: '', productName: '', qty: 1, buyPrice: 0,
      sellPrice: 0, sellPrice2: 0, isNew: true
    }])
  }

  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  function updateItem(i, k, v) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [k]: v }

      // Kalau nama produk berubah, cari matching dari produk yang ada
      if (k === 'productName') {
        const match = products.find(p => p.name.toLowerCase() === String(v).toLowerCase())
        if (match) {
          updated.productId = match.id
          updated.buyPrice = updated.buyPrice || match.buyPrice || 0
          updated.sellPrice = updated.sellPrice || match.sellPrice || 0
          updated.sellPrice2 = updated.sellPrice2 || match.sellPrice2 || 0
          updated.isNew = false
        } else {
          updated.productId = ''
          updated.isNew = true
        }
      }

      // Kalau pilih dari dropdown (productId langsung)
      if (k === 'productId' && v) {
        const p = products.find(pr => pr.id === v)
        if (p) {
          updated.productName = p.name
          updated.buyPrice = p.buyPrice || 0
          updated.sellPrice = p.sellPrice || 0
          updated.sellPrice2 = p.sellPrice2 || 0
          updated.isNew = false
        }
      }
      return updated
    }))
  }

  // Pilih produk existing dari suggestions
  function selectProduct(itemIdx, prodId) {
    const p = products.find(pr => pr.id === prodId)
    if (!p) return
    setItems(prev => prev.map((item, idx) => {
      if (idx !== itemIdx) return item
      return { ...item, productId: p.id, productName: p.name, buyPrice: p.buyPrice||0, sellPrice: p.sellPrice||0, sellPrice2: p.sellPrice2||0, isNew: false }
    }))
  }

  // Scan barcode → cari produk → tambah item atau naikkan qty
  function handleScanBarcode(code) {
    const found = products.find(p =>
      String(p.barcode||'').toLowerCase() === code.toLowerCase() ||
      String(p.sku||'').toLowerCase() === code.toLowerCase() ||
      String(p.barcode||'').toLowerCase().includes(code.toLowerCase()) ||
      String(p.sku||'').toLowerCase().includes(code.toLowerCase())
    )
    if (found) {
      const existIdx = items.findIndex(it => it.productId === found.id)
      if (existIdx >= 0) {
        updateItem(existIdx, 'qty', (items[existIdx].qty || 0) + 1)
      } else {
        setItems(prev => [...prev, {
          productId: found.id, productName: found.name, qty: 1,
          buyPrice: found.buyPrice || 0, sellPrice: found.sellPrice || 0,
          sellPrice2: found.sellPrice2 || 0, isNew: false
        }])
      }
    } else {
      // Barcode tidak ditemukan → tambah baris manual dengan barcode
      setItems(prev => [...prev, {
        productId: '', productName: '', barcode: code, qty: 1,
        buyPrice: 0, sellPrice: 0, sellPrice2: 0, isNew: true
      }])
    }
    setScanInput('')
  }

  function handleBarcodeScan(code, itemIdx) {
    const found = products.find(p =>
      String(p.barcode||'').toLowerCase() === code.toLowerCase() ||
      String(p.sku||'').toLowerCase() === code.toLowerCase()
    )
    setShowScanIdx(-1)
    if (found) {
      selectProduct(itemIdx, found.id)
    } else {
      updateItem(itemIdx, 'barcode', code)
    }
  }

  const subtotal = items.reduce((a, it) => a + ((it.qty||0) * (it.buyPrice||0)), 0)
  const ppnAmount = Math.round(subtotal * (ppnPct||0) / 100)
  const total = subtotal + ppnAmount
  const totalNotaNum = Number(totalNota) || 0
  const selisih = totalNotaNum > 0 ? total - totalNotaNum : 0
  const isMatch = totalNotaNum === 0 || Math.abs(selisih) === 0
  const hasItems = items.length > 0 && items.some(it => it.qty > 0 && (it.productId || it.productName))

  function handleSave() {
    if (!hasItems) { alert('Tambahkan minimal 1 item barang!'); return }
    // Validasi semua item punya nama
    const emptyName = items.find(it => !it.productId && !it.productName?.trim())
    if (emptyName) { alert('Ada item yang belum diisi nama barangnya!'); return }
    if (totalNotaNum > 0 && !isMatch) {
      alert('⚠️ TOTAL TIDAK SESUAI NOTA!\n\nTotal Nota: Rp ' + totalNotaNum.toLocaleString('id-ID') + '\nTotal Sistem: Rp ' + total.toLocaleString('id-ID') + '\nSelisih: Rp ' + Math.abs(selisih).toLocaleString('id-ID') + '\n\nPerbaiki jumlah/harga agar sesuai nota.')
      return
    }
    onSave({ date, supplierId, invoice, note, items, subtotal, ppnPct, ppnAmount, total, jenisBayar, jatuhTempo })
  }

  return (
    <div style={S.form}>
      {/* HEADER — mirip VB app */}
      <div style={{ background: '#1a237e', color: '#fff', padding: '10px 16px', borderRadius: '10px 10px 0 0', margin: '-16px -16px 12px -16px' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>TRANSAKSI PEMBELIAN</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>Form entri transaksi penambahan stock barang ke toko</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Nomor Urut<input style={{ ...S.input, fontWeight: 700 }} value={invoice} onChange={e => setInvoice(e.target.value)} /></label>
        <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={S.formLabel}>Total Nota (Rp)
          <input style={{ ...S.input, fontWeight: 700, color: '#1565c0', textAlign: 'right' }} type="number" value={totalNota} onChange={e => setTotalNota(e.target.value)} placeholder="Isi total nota..." />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
        <label style={S.formLabel}>Kode Supplier
          <select style={S.input} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.id.slice(0,6).toUpperCase()}</option>)}
          </select>
        </label>
        <label style={S.formLabel}>Nama Supplier
          <input style={{ ...S.input, fontWeight: 600 }} value={selectedSup?.name || '-'} readOnly />
        </label>
      </div>

      {/* SCAN INPUT */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#fffde7', border: '2px solid #fdd835', borderRadius: 8, padding: '6px 10px' }}>
          <svg width="16" height="16" fill="none" stroke="#f57f17" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 8v8M12 8v8M17 8v8"/></svg>
          <input
            style={{ ...S.searchInput, flex: 1, fontSize: 13, background: 'transparent' }}
            placeholder="Scan barcode / ketik kode barang + Enter untuk tambah..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && scanInput.trim()) { e.preventDefault(); handleScanBarcode(scanInput.trim()) } }}
            autoFocus
          />
        </div>
        <button style={{ ...S.filterBtn, padding: '8px 12px' }} onClick={() => addItem()}>+ Manual</button>
      </div>

      {/* TABEL ITEM — layout mirip VB app */}
      <div style={{ border: '2px solid #1a237e', borderRadius: 8, overflow: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#1a237e', color: '#fdd835' }}>
              {['Kode', 'Nama Barang', 'Jumlah', 'Stok Awal', 'Stok Akhir', 'Hpp', 'Hrg Tunai', 'Hrg Kredit', 'Sub Total Rp', ''].map(h =>
                <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Nama Barang' ? 'left' : 'center', fontSize: 12, fontWeight: 700, borderRight: '1px solid #283593', whiteSpace: 'nowrap' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#999', fontStyle: 'italic', fontSize: 14 }}>Scan barcode atau klik "+ Manual" untuk tambah barang</td></tr>
            )}
            {items.map((it, i) => {
              const prod = it.productId ? products.find(p => p.id === it.productId) : null
              const stokAwal = prod?.stock || 0
              const stokAkhir = stokAwal + (it.qty || 0)
              const itemSub = (it.qty || 0) * (it.buyPrice || 0)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #ccc', background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 12, minWidth: 110, borderRight: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{prod?.barcode || prod?.sku || it.barcode || '-'}</span>
                      <button type="button" style={{ ...S.smallBtn, padding: '2px 5px', color: '#7b1fa2', fontSize: 11, border: '1px solid #e0e0e0', borderRadius: 4 }} onClick={() => setShowScanIdx(showScanIdx === i ? -1 : i)} title="Scan">📷</button>
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', minWidth: 200, borderRight: '1px solid #e0e0e0' }}>
                    <input
                      list={'prodlist-' + i}
                      style={{ ...S.input, fontSize: 13, padding: '5px 8px', width: '100%', fontWeight: 600, border: it.isNew && it.productName ? '2px solid #ff9800' : '1px solid #e0e0e0', background: it.isNew && it.productName ? '#fff8e1' : 'transparent' }}
                      value={it.productName || ''}
                      onChange={e => updateItem(i, 'productName', e.target.value)}
                      placeholder="Ketik nama barang..."
                    />
                    <datalist id={'prodlist-' + i}>
                      {products.map(p => <option key={p.id} value={p.name}>{p.sku ? p.sku + ' - ' : ''}{p.name}</option>)}
                    </datalist>
                    {it.isNew && it.productName && <div style={{ fontSize: 9, color: '#e65100', marginTop: 2 }}>★ Barang baru — otomatis masuk Stok</div>}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>
                    <input style={{ ...S.input, width: 65, fontSize: 14, fontWeight: 700, textAlign: 'center', padding: '5px', background: '#fffde7', border: '2px solid #fdd835', borderRadius: 4 }} type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#6b7280', fontSize: 14, borderRight: '1px solid #e0e0e0' }}>{stokAwal}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#2e7d32', fontSize: 14, borderRight: '1px solid #e0e0e0' }}>{stokAkhir}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>
                    <input style={{ ...S.input, width: 100, fontSize: 13, textAlign: 'right', padding: '5px 8px' }} type="number" value={it.buyPrice} onChange={e => updateItem(i, 'buyPrice', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>
                    <input style={{ ...S.input, width: 100, fontSize: 13, textAlign: 'right', padding: '5px 8px' }} type="number" value={it.sellPrice||''} onChange={e => updateItem(i, 'sellPrice', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>
                    <input style={{ ...S.input, width: 100, fontSize: 13, textAlign: 'right', padding: '5px 8px' }} type="number" value={it.sellPrice2||''} onChange={e => updateItem(i, 'sellPrice2', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 14, borderRight: '1px solid #e0e0e0' }}>{Number(itemSub).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                    <button style={{ ...S.smallBtn, color: 'var(--r)', padding: '3px 8px', fontSize: 14, border: '1px solid #ffcdd2', borderRadius: 4 }} onClick={() => removeItem(i)} title="Hapus baris (double click)">×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showScanIdx >= 0 && <BarcodeScanner onScan={(code) => handleBarcodeScan(code, showScanIdx)} onClose={() => setShowScanIdx(-1)} />}

      {/* FOOTER — PPN, Jenis Bayar, TOTAL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <label style={S.formLabel}>PPN (%)
          <input style={S.input} type="number" min="0" max="100" value={ppnPct} onChange={e => setPpnPct(Number(e.target.value))} />
        </label>
        <label style={S.formLabel}>Jenis Bayar
          <select style={S.input} value={jenisBayar} onChange={e => setJenisBayar(e.target.value)}>
            <option value="TUNAI">TUNAI</option>
            <option value="KREDIT">KREDIT (hutang)</option>
          </select>
        </label>
        {jenisBayar === 'KREDIT' ? (
          <label style={S.formLabel}>Jatuh Tempo<input style={S.input} type="date" value={jatuhTempo} onChange={e => setJatuhTempo(e.target.value)} /></label>
        ) : (
          <label style={S.formLabel}>Catatan<input style={S.input} value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan opsional..." /></label>
        )}
      </div>

      {/* TOTAL BOX */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'stretch' }}>
        <div style={{ flex: 1, padding: '10px 14px', background: isMatch ? '#e8f5e9' : '#ffebee', borderRadius: 10, border: isMatch ? '2px solid #4caf50' : '2px solid #ef5350' }}>
          {ppnPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>Subtotal ({items.length} item)</span><span>{formatRp(subtotal)}</span>
            </div>
          )}
          {ppnPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#c62828' }}>
              <span>PPN {ppnPct}%</span><span>+ {formatRp(ppnAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#1a237e' }}>
            <span>TOTAL</span><span>{formatRp(total)}</span>
          </div>
          {totalNotaNum > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #999' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span>Total Nota</span><span>{formatRp(totalNotaNum)}</span>
              </div>
              {isMatch ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginTop: 4, textAlign: 'center' }}>✅ SESUAI</div>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b71c1c', marginTop: 4, textAlign: 'center' }}>❌ SELISIH {formatRp(Math.abs(selisih))}</div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          <button style={{ ...S.filterBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setItems([]); setScanInput('') }}>Batal</button>
          <button
            style={{ ...S.primaryBtn, flex: 2, justifyContent: 'center', fontSize: 14, opacity: (!hasItems || (totalNotaNum > 0 && !isMatch)) ? 0.5 : 1 }}
            disabled={!hasItems || (totalNotaNum > 0 && !isMatch)}
            onClick={handleSave}
          >
            💾 Simpan Transaksi
          </button>
        </div>
      </div>
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

  // ============================================
  // SUPPORT SCANNER FISIK (USB/Bluetooth)
  // Scanner fisik = keyboard HID: ketik cepat + Enter
  // Jika scanner-input ada, fokuskan ke situ
  // ============================================
  const scanHandlerRef = useRef(null)
  scanHandlerRef.current = handleBarcodeScan

  useEffect(() => {
    let buffer = ''
    let lastKeyTime = 0

    function handleKeyDown(e) {
      const now = Date.now()
      const tag = e.target?.tagName?.toLowerCase()
      const scanInput = document.getElementById('scanner-input')

      // Jika scanner-input ada dan bukan target saat ini, fokuskan ke situ
      if (scanInput && e.target !== scanInput && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        if (e.key.length === 1) {
          scanInput.focus()
          return // biarkan input handle sendiri
        }
      }

      // Fallback: global detection untuk halaman tanpa scanner-input
      if (!scanInput) {
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return

        if (e.key === 'Enter' && buffer.length >= 3) {
          e.preventDefault()
          if (scanHandlerRef.current) scanHandlerRef.current(buffer.trim())
          buffer = ''
          return
        }
        if (e.key.length === 1) {
          if (now - lastKeyTime > 100) buffer = ''
          buffer += e.key
          lastKeyTime = now
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredProducts = products.filter(p =>
    p.stock > 0 && (search === '' || String(p.name||'').toLowerCase().includes(search.toLowerCase()) || String(p.sku||'').toLowerCase().includes(search.toLowerCase()) || String(p.barcode||'').toLowerCase().includes(search.toLowerCase()))
  )

  function handleBarcodeScan(code) {
    console.log('[SCAN] Kode terbaca:', code)

    // Normalisasi: ganti separator AGT (/, \, -, spasi) jadi AGT-
    let normalizedCode = code.trim()
    if (/^AGT[\/\\.\-\s]/i.test(normalizedCode)) {
      normalizedCode = 'AGT-' + normalizedCode.substring(4)
    } else if (/^AGT[a-z0-9]/i.test(normalizedCode) && !normalizedCode.toUpperCase().startsWith('AGT-')) {
      normalizedCode = 'AGT-' + normalizedCode.substring(3)
    }
    console.log('[SCAN] Normalized:', normalizedCode)

    // Cek apakah ini barcode kartu anggota (prefix AGT-)
    if (normalizedCode.toUpperCase().startsWith('AGT-')) {
      const memberKey = normalizedCode.substring(4) // ambil ID setelah "AGT-"
      console.log('[SCAN] Kartu anggota, cari ID:', memberKey)
      // Cari by ID dulu (kartu baru), lalu by No Anggota (kartu lama)
      const found = members.find(m => String(m.id||'') === memberKey) ||
                    members.find(m => String(m.no||'') === memberKey)
      if (found) {
        console.log('[SCAN] Ketemu:', found.name, found.no, found.id)
        setMemberId(found.id)
        const useH2 = caraBayar === 'KREDIT' || found.tingkatHrg === '2'
        setCart(prev => prev.map(c => {
          const prod = products.find(p => p.id === c.productId)
          if (!prod) return c
          const newPrice = useH2 && prod.sellPrice2 ? prod.sellPrice2 : prod.sellPrice
          return { ...c, price: newPrice }
        }))
        setLastScanned('✅ Scan: "' + code + '" → ' + found.name + ' (No.' + found.no + ')')
        showToast('Anggota dipilih: ' + found.name + (useH2 ? ' (Harga Kredit)' : ' (Harga Lunas)'))
      } else {
        console.log('[SCAN] Tidak ketemu ID:', memberKey, '| Daftar ID:', members.map(m => m.id).join(', '))
        setLastScanned('❌ Scan: "' + code + '" → Tidak cocok dengan anggota manapun')
        showToast('Kartu anggota tidak terdaftar. Cetak ulang kartu!', 'error')
      }
      return
    }

    // Kalau bukan kartu anggota, cari produk berdasarkan barcode, SKU, atau nama
    const found = products.find(p =>
      String(p.barcode||'').toLowerCase() === code.toLowerCase() ||
      String(p.sku||'').toLowerCase() === code.toLowerCase() ||
      String(p.barcode||'').toLowerCase().includes(code.toLowerCase()) ||
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
      showToast('Barcode "' + code + '" belum terdaftar. Tambahkan di Edit Produk → field Barcode Produk.', 'error')
      setLastScanned('Belum terdaftar: ' + code)
      // Set search agar user bisa lihat produk terdekat
      setSearch(code)
    }
  }

  function addToCart(product) {
    // Pilih harga berdasarkan cara bayar DAN tipe anggota
    const member = members.find(m => m.id === memberId)
    const useHarga2 = caraBayar === 'KREDIT' || member?.tingkatHrg === '2'
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

  // Update harga keranjang saat cara bayar berubah
  function switchCaraBayar(newCara) {
    setCaraBayar(newCara)
    const member = members.find(m => m.id === memberId)
    const useH2 = newCara === 'KREDIT' || member?.tingkatHrg === '2'
    setCart(prev => prev.map(c => {
      const prod = products.find(p => p.id === c.productId)
      if (!prod) return c
      const newPrice = useH2 && prod.sellPrice2 ? prod.sellPrice2 : prod.sellPrice
      return { ...c, price: newPrice }
    }))
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
  const [txFilter, setTxFilter] = useState('all') // all | LUNAS | KREDIT
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')

  const filteredTx = sortedTx.filter(tx => {
    if (txFilter === 'LUNAS' && tx.caraBayar === 'KREDIT') return false
    if (txFilter === 'KREDIT' && tx.caraBayar !== 'KREDIT') return false
    if (txDateFrom && tx.date < txDateFrom) return false
    if (txDateTo && tx.date > txDateTo) return false
    return true
  })

  const txLunas = sortedTx.filter(tx => tx.caraBayar !== 'KREDIT')
  const txKredit = sortedTx.filter(tx => tx.caraBayar === 'KREDIT')
  const totalLunas = txLunas.reduce((a, tx) => a + (tx.total||0), 0)
  const totalKredit = txKredit.reduce((a, tx) => a + (tx.total||0), 0)
  const sisaKredit = txKredit.reduce((a, tx) => a + ((tx.total||0) - (tx.payment||0)), 0)

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Kasir / POS</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={S.filterGroup}>
            <button style={{ ...S.filterBtn, ...(tab === 'kasir' ? S.filterActive : {}) }} onClick={() => setTab('kasir')}>Kasir</button>
            <button style={{ ...S.filterBtn, ...(tab === 'riwayat' ? S.filterActive : {}) }} onClick={() => setTab('riwayat')}>Riwayat Penjualan</button>
          </div>
        </div>
      </div>

      {/* Last scanned indicator */}
      {lastScanned && tab === 'kasir' && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#2e7d32', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Terakhir scan: <strong>{lastScanned}</strong></span>
          <button onClick={() => setLastScanned('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 16 }}>×</button>
        </div>
      )}

      {tab === 'kasir' ? (
        <div>
          {/* STEP 1: Pilih Anggota */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, border: '2px solid #e3f2fd', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: '#1565c0', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>1</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1565c0' }}>Pilih Anggota</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>— scan kartu / cari nama / ketik AGT + Enter</span>
            </div>
            <MemberSearch members={members} memberId={memberId} onBarcodeScan={handleBarcodeScan} onSelect={(newMid) => {
              setMemberId(newMid)
              const m = members.find(x => x.id === newMid)
              const useH2 = caraBayar === 'KREDIT' || m?.tingkatHrg === '2'
              setCart(prev => prev.map(c => {
                const prod = products.find(p => p.id === c.productId)
                if (!prod) return c
                const newPrice = useH2 && prod.sellPrice2 ? prod.sellPrice2 : prod.sellPrice
                return { ...c, price: newPrice }
              }))
              if (m) showToast('Anggota: ' + m.name + (useH2 ? ' (Harga Kredit)' : ' (Harga Lunas)'))
            }} />
          </div>

          {/* STEP 2: Scan/Pilih Barang + Keranjang */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ background: '#2e7d32', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>2</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>Scan / Pilih Barang</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Product picker */}
          <div>
            {/* Input untuk Scanner Fisik + Tombol Kamera */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 10, padding: '8px 14px' }}>
                <svg width="20" height="20" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 8V6a2 2 0 012-2h3M22 8V6a2 2 0 00-2-2h-3M2 16v2a2 2 0 002 2h3M22 16v2a2 2 0 01-2 2h-3M7 12h10"/></svg>
                <input
                  id="scanner-input"
                  style={{ ...S.searchInput, flex: 1, fontSize: 15, fontWeight: 600, background: 'transparent' }}
                  placeholder="Scan barcode barang / ketik kode + Enter..."
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim().length >= 1) {
                      e.preventDefault()
                      handleBarcodeScan(e.target.value.trim())
                      e.target.value = ''
                    }
                  }}
                  autoComplete="off"
                />
              </div>
              <button style={{ ...S.primaryBtn, background: '#7b1fa2', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowScanner(true)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Kamera
              </button>
            </div>
            {/* Kamera Scanner inline */}
            {showScanner && (
              <div style={{ marginBottom: 12 }}>
                <BarcodeScanner onScan={(code) => { handleBarcodeScan(code); setShowScanner(false) }} onClose={() => setShowScanner(false)} />
              </div>
            )}
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
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {formatRp(c.price)} × {c.qty} = {formatRp(sub)}
                          <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600, background: caraBayar === 'KREDIT' ? '#fff3e0' : '#e8f5e9', color: caraBayar === 'KREDIT' ? '#e65100' : '#2e7d32' }}>{caraBayar === 'KREDIT' ? 'Hrg Kredit' : 'Hrg Lunas'}</span>
                        </div>
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

              {/* Cara Bayar: LUNAS / KREDIT */}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 8 }}>
                <button style={{ flex: 1, padding: '8px', border: '2px solid', borderColor: caraBayar === 'LUNAS' ? '#2e7d32' : '#e5e7eb', background: caraBayar === 'LUNAS' ? '#e8f5e9' : '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: caraBayar === 'LUNAS' ? '#2e7d32' : '#6b7280' }}
                  onClick={() => switchCaraBayar('LUNAS')}>LUNAS</button>
                <button style={{ flex: 1, padding: '8px', border: '2px solid', borderColor: caraBayar === 'KREDIT' ? '#e65100' : '#e5e7eb', background: caraBayar === 'KREDIT' ? '#fff3e0' : '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: caraBayar === 'KREDIT' ? '#e65100' : '#6b7280' }}
                  onClick={() => switchCaraBayar('KREDIT')}>KREDIT</button>
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
        </div>
      ) : (
        /* Riwayat Penjualan */
        <div>
          {/* Filter & Summary */}
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 12 }}>
              <button style={{ ...S.filterBtn, ...(txFilter === 'all' ? S.filterActive : {}) }} onClick={() => setTxFilter('all')}>Semua ({sortedTx.length})</button>
              <button style={{ ...S.filterBtn, ...(txFilter === 'LUNAS' ? { background: '#2e7d32', color: '#fff', borderColor: '#2e7d32' } : { color: '#2e7d32' }) }} onClick={() => setTxFilter('LUNAS')}>✅ Lunas ({txLunas.length})</button>
              <button style={{ ...S.filterBtn, ...(txFilter === 'KREDIT' ? { background: '#e65100', color: '#fff', borderColor: '#e65100' } : { color: '#e65100' }) }} onClick={() => setTxFilter('KREDIT')}>⏳ Kredit ({txKredit.length})</button>
              <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px', alignSelf: 'stretch' }} />
              <label style={{ ...S.formLabel, marginBottom: 0, fontSize: 12 }}>Dari
                <input style={{ ...S.input, padding: '5px 8px', fontSize: 12 }} type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} />
              </label>
              <label style={{ ...S.formLabel, marginBottom: 0, fontSize: 12 }}>Sampai
                <input style={{ ...S.input, padding: '5px 8px', fontSize: 12 }} type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)} />
              </label>
              {(txDateFrom || txDateTo) && <button style={{ ...S.filterBtn, color: '#c62828', fontSize: 11 }} onClick={() => { setTxDateFrom(''); setTxDateTo('') }}>Reset</button>}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', background: '#e8f5e9', borderRadius: 8, borderLeft: '4px solid #2e7d32' }}>
                <div style={{ fontSize: 11, color: '#666' }}>Total Lunas</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2e7d32' }}>{formatRp(totalLunas)}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{txLunas.length} transaksi</div>
              </div>
              <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', background: '#fff3e0', borderRadius: 8, borderLeft: '4px solid #e65100' }}>
                <div style={{ fontSize: 11, color: '#666' }}>Total Kredit</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e65100' }}>{formatRp(totalKredit)}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{txKredit.length} transaksi</div>
              </div>
              <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', background: '#ffebee', borderRadius: 8, borderLeft: '4px solid #c62828' }}>
                <div style={{ fontSize: 11, color: '#666' }}>Sisa Piutang Kredit</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#c62828' }}>{formatRp(sisaKredit)}</div>
                <div style={{ fontSize: 11, color: '#999' }}>belum terbayar</div>
              </div>
            </div>
          </div>

          <div style={S.card}>
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'No Nota', 'Pembeli', 'Item', 'Total', 'Bayar', 'Kembali/Sisa', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{filteredTx.map(tx => {
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
                  <td style={{ ...S.td, color: isKredit ? '#e65100' : 'var(--g)', fontWeight: 600 }}>{isKredit ? formatRp(tx.total - (tx.payment || 0)) : formatRp(tx.change || 0)}</td>
                  <td style={S.td}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: isKredit ? '#fff3e0' : '#e8f5e9', color: isKredit ? '#e65100' : '#2e7d32' }}>{isKredit ? 'KREDIT' : 'LUNAS'}</span></td>
                  <td style={S.td}><button style={{ ...S.smallBtn, color: '#1565c0', fontSize: 11, padding: '3px 8px', border: '1px solid #e0e0e0', borderRadius: 4 }} onClick={() => { try { cetakStruk(tx, settings, members) } catch(e) {} }}>🖨️</button></td>
                </tr>
              )
            })}{filteredTx.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada transaksi</td></tr>}</tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================
// HELPERS
// =============================================
// =============================================
// PENCARIAN ANGGOTA OTOMATIS (Autocomplete)
// =============================================
function MemberSearch({ members, memberId, onSelect, onBarcodeScan }) {
  const [query, setQuery] = useState('')
  const [showList, setShowList] = useState(false)
  const wrapRef = useRef(null)

  const selectedMember = members.find(m => m.id === memberId)
  const activeMembers = members.filter(m => m.status === 'active')

  const filtered = query.trim()
    ? activeMembers.filter(m => {
        const q = query.toLowerCase()
        return String(m.name||'').toLowerCase().includes(q) ||
               String(m.no||'').toLowerCase().includes(q) ||
               String(m.nrp||'').toLowerCase().includes(q) ||
               String(m.pangkat||'').toLowerCase().includes(q) ||
               String(m.phone||'').toLowerCase().includes(q) ||
               String(m.kompi||'').toLowerCase().includes(q)
      })
    : activeMembers

  // Deteksi barcode: cek apakah input = barcode AGT
  const scanTimerRef = useRef(null)
  function handleInputChange(val) {
    if (/^AGT/i.test(val) && onBarcodeScan) {
      // Barcode terdeteksi — JANGAN tampilkan dropdown
      setShowList(false)
      setQuery(val)
      // Cancel timer sebelumnya
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
      // Tunggu scanner selesai ketik (300ms) lalu proses
      scanTimerRef.current = setTimeout(() => {
        const input = document.querySelector('[data-member-search]')
        const finalVal = (input?.value || val).trim()
        if (/^AGT/i.test(finalVal) && finalVal.length > 4) {
          onBarcodeScan(finalVal)
          setQuery('')
          setShowList(false)
          if (input) input.value = ''
        }
      }, 300)
      return
    }
    setQuery(val)
    setShowList(true)
  }

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowList(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Pelanggan / Anggota</div>

      {selectedMember ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#e3f2fd', borderRadius: 8, border: '1px solid #90caf9' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedMember.pangkat ? selectedMember.pangkat + ' ' : ''}{selectedMember.name}</div>
            <div style={{ fontSize: 11, color: '#1565c0' }}>No. {selectedMember.no} {selectedMember.tingkatHrg === '2' ? '• Harga Kredit' : '• Harga Lunas'}</div>
          </div>
          <button style={{ border: 'none', background: '#ef5350', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            onClick={() => { onSelect(''); setQuery('') }}>× Ganti</button>
        </div>
      ) : (
        <div>
          <input
            data-member-search="true"
            style={{ ...S.input, fontSize: 14, padding: '10px 12px' }}
            placeholder="Ketik nama / no / NRP / scan kartu..."
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => setShowList(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && /^AGT/i.test(query) && query.length > 4 && onBarcodeScan) {
                e.preventDefault()
                onBarcodeScan(query.trim())
                setQuery('')
              }
            }}
          />
        </div>
      )}

      {/* Dropdown hasil pencarian */}
      {showList && !selectedMember && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 250, overflowY: 'auto', marginTop: 4 }}>
          {/* Opsi Umum */}
          <div
            onClick={() => { onSelect(''); setQuery(''); setShowList(false) }}
            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}
            onMouseEnter={e => e.target.style.background = '#f9fafb'}
            onMouseLeave={e => e.target.style.background = ''}
          >
            -- Umum (Tanpa Anggota) --
          </div>
          {filtered.length > 0 ? filtered.slice(0, 20).map(m => (
            <div key={m.id}
              onClick={() => { onSelect(m.id); setQuery(''); setShowList(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
              onMouseEnter={e => e.target.style.background = '#e3f2fd'}
              onMouseLeave={e => e.target.style.background = ''}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.pangkat ? m.pangkat + ' ' : ''}{m.name}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                No. {m.no} {m.nrp ? '• NRP: ' + m.nrp : ''} {m.kompi ? '• ' + m.kompi : ''} {m.tingkatHrg === '2' ? ' • Kredit' : ''}
              </div>
            </div>
          )) : (
            <div style={{ padding: '14px', textAlign: 'center', color: '#999', fontSize: 13 }}>Tidak ada anggota yang cocok</div>
          )}
        </div>
      )}
    </div>
  )
}

function catColor(cat) {
  const map = {
    Sembako: { bg: '#e8f5e9', fg: '#2e7d32' },
    Makanan: { bg: '#fff3e0', fg: '#e65100' },
    Minuman: { bg: '#e3f2fd', fg: '#1565c0' },
    Rokok: { bg: '#efebe9', fg: '#4e342e' },
    Sabun: { bg: '#e0f7fa', fg: '#00695c' },
    'Alat Mandi': { bg: '#e0f7fa', fg: '#00838f' },
    Toiletries: { bg: '#fce4ec', fg: '#c62828' },
    ATK: { bg: '#f3e5f5', fg: '#7b1fa2' },
    Obat: { bg: '#ffebee', fg: '#b71c1c' },
    Elektronik: { bg: '#e8eaf6', fg: '#283593' },
    Pakaian: { bg: '#fce4ec', fg: '#880e4f' },
    'Pakaian KAP TNI': { bg: '#e8eaf6', fg: '#1a237e' },
    Pangkat: { bg: '#fff8e1', fg: '#f57f17' },
    Barcil: { bg: '#f1f8e9', fg: '#33691e' },
    'Perabotan Rumah': { bg: '#efebe9', fg: '#3e2723' },
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
