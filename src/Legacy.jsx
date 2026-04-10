// =============================================
// MODUL FITUR LEGACY (dari Aplikasi Kop Kartika)
// Retur, Kredit, Piutang, Diskon, Harga Bertingkat,
// Mutasi Stok, Setoran Harian
// =============================================
import { useState } from 'react'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { return new Date().toISOString().slice(0, 10) }

const IC = {
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  x: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
}

// =============================================
// 1. RETUR BARANG
// =============================================
export function ReturBarang({ returs, saveRetur, products, suppliers, updateProductStock, setModal, showToast }) {
  const sorted = [...returs].sort((a, b) => b.date.localeCompare(a.date))

  const totalRetur = returs.reduce((a, r) => a + (r.totalHarga||0), 0)

  function openForm() {
    setModal({
      title: 'Catat Retur Barang',
      content: <ReturForm products={products} suppliers={suppliers} onSave={async d => {
        await saveRetur(d)
        // Kembalikan stok
        const prod = products.find(p => p.id === d.productId)
        if (prod) await updateProductStock(prod.id, prod.stock + d.qty)
        setModal(null)
        showToast('Retur berhasil dicatat, stok dikembalikan')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Retur Barang</h2><button style={S.primaryBtn} onClick={openForm}>{IC.plus} Catat Retur</button></div>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Retur</div><div style={S.statVal}>{returs.length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Nilai Retur</div><div style={{ ...S.statVal, color: '#c62828' }}>{formatRp(totalRetur)}</div></div>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['No Retur', 'Tanggal', 'Supplier', 'Produk', 'Qty', 'Harga', 'Total', 'Keterangan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(r => (
            <tr key={r.id} style={S.tr}>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{r.noRetur}</td>
              <td style={S.td}>{fmtDate(r.date)}</td>
              <td style={S.td}>{r.supplierName}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{r.productName}</td>
              <td style={S.td}>{r.qty} {r.unit}</td>
              <td style={S.td}>{formatRp(r.harga)}</td>
              <td style={{ ...S.td, fontWeight: 600, color: '#c62828' }}>{formatRp(r.totalHarga)}</td>
              <td style={S.td}>{r.note || '-'}</td>
            </tr>
          ))}{sorted.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada data retur</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function ReturForm({ products, suppliers, onSave }) {
  const [d, setD] = useState({ productId: products[0]?.id || '', supplierId: suppliers[0]?.id || '', qty: 1, harga: products[0]?.buyPrice || 0, date: today(), note: '' })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const prod = products.find(p => p.id === d.productId)
  const sup = suppliers.find(s => s.id === d.supplierId)
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Produk
        <select style={S.input} value={d.productId} onChange={e => { const p = products.find(pr => pr.id === e.target.value); set('productId', e.target.value); if (p) set('harga', p.buyPrice) }}>
          {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
        </select>
      </label>
      <label style={S.formLabel}>Supplier
        <select style={S.input} value={d.supplierId} onChange={e => set('supplierId', e.target.value)}>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Qty<input style={S.input} type="number" min="1" value={d.qty} onChange={e => set('qty', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Harga<input style={S.input} type="number" value={d.harga} onChange={e => set('harga', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      </div>
      <div style={{ padding: '8px 12px', background: '#ffebee', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#c62828' }}>Total Retur: {formatRp(d.qty * d.harga)}</div>
      <label style={S.formLabel}>Keterangan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({
        noRetur: 'R' + Date.now().toString().slice(-5),
        productId: d.productId, productName: prod?.name || '', supplierId: d.supplierId, supplierName: sup?.name || '',
        qty: d.qty, harga: d.harga, totalHarga: d.qty * d.harga, unit: prod?.unit || 'pcs', date: d.date, note: d.note
      })}>Simpan Retur</button>
    </div>
  )
}

// =============================================
// 2 & 3. PENJUALAN KREDIT + PEMBAYARAN PIUTANG
// =============================================
export function PiutangPage({ piutangs, savePiutang, bayarPiutang, members, getMember, setModal, showToast }) {
  const [filter, setFilter] = useState('all')

  let filtered = piutangs
  if (filter === 'kredit') filtered = filtered.filter(p => p.sisa > 0)
  if (filter === 'lunas') filtered = filtered.filter(p => p.sisa <= 0)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const totalPiutang = piutangs.filter(p => p.sisa > 0).reduce((a, p) => a + (p.sisa||0), 0)
  const totalLunas = piutangs.filter(p => p.sisa <= 0).length

  function openBayar(piutang) {
    setModal({
      title: 'Bayar Piutang - ' + (getMember(piutang.memberId)?.name || piutang.customerName),
      content: <BayarPiutangForm piutang={piutang} onSave={async (amount) => {
        await bayarPiutang(piutang, amount)
        setModal(null)
        showToast('Pembayaran berhasil dicatat')
      }} />,
    })
  }

  return (
    <div>
      <h2 style={S.title}>Piutang Pelanggan</h2>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Piutang</div><div style={{ ...S.statVal, color: '#e65100' }}>{formatRp(totalPiutang)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Belum Lunas</div><div style={{ ...S.statVal, color: '#c62828' }}>{piutangs.filter(p => p.sisa > 0).length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Sudah Lunas</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{totalLunas}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['all', 'Semua'], ['kredit', 'Belum Lunas'], ['lunas', 'Lunas']].map(([k, l]) => (
          <button key={k} style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'No Nota', 'Pelanggan', 'Nilai Nota', 'DP', 'Dibayar', 'Sisa', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(p => {
            const m = getMember(p.memberId)
            const isLunas = p.sisa <= 0
            return (
              <tr key={p.id} style={S.tr}>
                <td style={S.td}>{fmtDate(p.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{p.noNota}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{m?.name || p.customerName || 'Umum'}</td>
                <td style={S.td}>{formatRp(p.total)}</td>
                <td style={S.td}>{formatRp(p.dp)}</td>
                <td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(p.totalBayar)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: isLunas ? '#2e7d32' : '#c62828' }}>{formatRp(Math.max(0, p.sisa))}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, background: isLunas ? '#e8f5e9' : '#ffebee', color: isLunas ? '#2e7d32' : '#c62828' }}>
                    {isLunas ? 'LUNAS' : 'KREDIT'}
                  </span>
                </td>
                <td style={S.td}>
                  {!isLunas && <button style={{ ...S.smallBtn, color: '#1565c0', fontWeight: 600, fontSize: 12 }} onClick={() => openBayar(p)}>Bayar</button>}
                </td>
              </tr>
            )
          })}{sorted.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data piutang</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function BayarPiutangForm({ piutang, onSave }) {
  const [amount, setAmount] = useState(piutang.sisa)
  return (
    <div style={S.form}>
      <div style={{ padding: '10px 14px', background: '#fff3e0', borderRadius: 8, fontSize: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>Nilai Nota: <strong>{formatRp(piutang.total)}</strong></div>
          <div>DP: <strong>{formatRp(piutang.dp)}</strong></div>
          <div>Sudah Bayar: <strong style={{ color: '#2e7d32' }}>{formatRp(piutang.totalBayar)}</strong></div>
          <div>Sisa: <strong style={{ color: '#c62828' }}>{formatRp(piutang.sisa)}</strong></div>
        </div>
      </div>
      <label style={S.formLabel}>Jumlah Bayar (Rp)
        <input style={{ ...S.input, fontSize: 18, fontWeight: 700 }} type="number" max={piutang.sisa} value={amount} onChange={e => setAmount(Number(e.target.value))} />
      </label>
      {amount > 0 && amount <= piutang.sisa && (
        <div style={{ padding: '8px 12px', background: amount >= piutang.sisa ? '#e8f5e9' : '#f5f5f5', borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
          {amount >= piutang.sisa ? <strong style={{ color: '#2e7d32' }}>LUNAS</strong> : <span>Sisa setelah bayar: <strong>{formatRp(piutang.sisa - amount)}</strong></span>}
        </div>
      )}
      <button style={{ ...S.primaryBtn, width: '100%' }} disabled={amount <= 0 || amount > piutang.sisa} onClick={() => onSave(amount)}>
        Konfirmasi Pembayaran
      </button>
    </div>
  )
}

// =============================================
// 4 & 5. (Diskon + Harga Bertingkat di POS - 
// diintegrasikan ke Inventory.jsx via props)
// Ini adalah komponen pengaturan harga bertingkat
// =============================================
export function HargaBertingkat({ products, saveProduct, setModal, showToast }) {
  const [search, setSearch] = useState('')
  const filtered = products.filter(p => !search || (p.name||'').toLowerCase().includes(search.toLowerCase()) || (p.sku||'').toLowerCase().includes(search.toLowerCase()))

  function editHarga(product) {
    setModal({
      title: 'Atur Harga - ' + product.name,
      content: <HargaForm product={product} onSave={async d => {
        await saveProduct({ ...product, sellPrice: d.harga1, sellPrice2: d.harga2 }, true)
        setModal(null)
        showToast('Harga diperbarui')
      }} />,
    })
  }

  return (
    <div>
      <h2 style={S.title}>Harga Bertingkat</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: -12 }}>Atur harga eceran (Harga 1) dan harga grosir (Harga 2) untuk setiap produk. Di kasir, harga otomatis dipilih berdasarkan tipe pelanggan.</p>

      <div style={{ ...S.searchBox, marginBottom: 16 }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input style={S.searchInput} placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['SKU', 'Produk', 'Harga Beli', 'Harga 1 (Eceran)', 'Harga 2 (Grosir)', 'Margin 1', 'Margin 2', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(p => {
            const h2 = p.sellPrice2 || Math.round(p.sellPrice * 0.9)
            const m1 = p.buyPrice > 0 ? Math.round(((p.sellPrice - p.buyPrice) / p.buyPrice) * 100) : 0
            const m2 = p.buyPrice > 0 ? Math.round(((h2 - p.buyPrice) / p.buyPrice) * 100) : 0
            return (
              <tr key={p.id} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                <td style={S.td}>{formatRp(p.buyPrice)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#1565c0' }}>{formatRp(p.sellPrice)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#7b1fa2' }}>{formatRp(h2)}</td>
                <td style={S.td}><span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>{m1}%</span></td>
                <td style={S.td}><span style={{ ...S.badge, background: '#f3e5f5', color: '#7b1fa2' }}>{m2}%</span></td>
                <td style={S.td}><button style={{ ...S.smallBtn, color: '#1565c0', fontWeight: 600, fontSize: 12 }} onClick={() => editHarga(p)}>Edit</button></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function HargaForm({ product, onSave }) {
  const [h1, setH1] = useState(product.sellPrice)
  const [h2, setH2] = useState(product.sellPrice2 || Math.round(product.sellPrice * 0.9))
  const m1 = product.buyPrice > 0 ? Math.round(((h1 - product.buyPrice) / product.buyPrice) * 100) : 0
  const m2 = product.buyPrice > 0 ? Math.round(((h2 - product.buyPrice) / product.buyPrice) * 100) : 0
  return (
    <div style={S.form}>
      <div style={{ padding: '10px 14px', background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
        Harga Beli: <strong>{formatRp(product.buyPrice)}</strong> | Stok: <strong>{product.stock} {product.unit}</strong>
      </div>
      <label style={S.formLabel}>Harga 1 - Eceran (Rp)
        <input style={S.input} type="number" value={h1} onChange={e => setH1(Number(e.target.value))} />
        <span style={{ fontSize: 11, color: m1 >= 0 ? '#2e7d32' : '#c62828' }}>Margin: {m1}%</span>
      </label>
      <label style={S.formLabel}>Harga 2 - Grosir (Rp)
        <input style={S.input} type="number" value={h2} onChange={e => setH2(Number(e.target.value))} />
        <span style={{ fontSize: 11, color: m2 >= 0 ? '#2e7d32' : '#c62828' }}>Margin: {m2}%</span>
      </label>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({ harga1: h1, harga2: h2 })}>Simpan Harga</button>
    </div>
  )
}

// =============================================
// 6. MUTASI STOK
// =============================================
export function MutasiStok({ mutasis, saveMutasi, products, updateProductStock, setModal, showToast }) {
  const sorted = [...mutasis].sort((a, b) => b.date.localeCompare(a.date))

  function openForm() {
    setModal({
      title: 'Catat Mutasi Stok',
      content: <MutasiForm products={products} onSave={async d => {
        await saveMutasi(d)
        const prod = products.find(p => p.id === d.productId)
        if (prod) {
          const newStock = d.tipe === 'tambah' ? prod.stock + d.qty : prod.stock - d.qty
          await updateProductStock(prod.id, Math.max(0, newStock))
        }
        setModal(null)
        showToast('Mutasi stok berhasil dicatat')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Mutasi Stok</h2><button style={S.primaryBtn} onClick={openForm}>{IC.plus} Catat Mutasi</button></div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['No Mutasi', 'Tanggal', 'Produk', 'Tipe', 'Stok Awal', 'Jumlah', 'Stok Akhir', 'Keterangan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(m => (
            <tr key={m.id} style={S.tr}>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{m.noMutasi}</td>
              <td style={S.td}>{fmtDate(m.date)}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{m.productName}</td>
              <td style={S.td}>
                <span style={{ ...S.badge, background: m.tipe === 'tambah' ? '#e8f5e9' : '#ffebee', color: m.tipe === 'tambah' ? '#2e7d32' : '#c62828' }}>
                  {m.tipe === 'tambah' ? '+ Tambah' : '- Kurang'}
                </span>
              </td>
              <td style={S.td}>{m.stokAwal}</td>
              <td style={{ ...S.td, fontWeight: 600, color: m.tipe === 'tambah' ? '#2e7d32' : '#c62828' }}>{m.tipe === 'tambah' ? '+' : '-'}{m.qty}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{m.stokAkhir}</td>
              <td style={S.td}>{m.note || '-'}</td>
            </tr>
          ))}{sorted.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada mutasi</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function MutasiForm({ products, onSave }) {
  const [pid, setPid] = useState(products[0]?.id || '')
  const [tipe, setTipe] = useState('kurang')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const prod = products.find(p => p.id === pid)
  const stokAwal = prod?.stock || 0
  const stokAkhir = tipe === 'tambah' ? stokAwal + qty : Math.max(0, stokAwal - qty)

  return (
    <div style={S.form}>
      <label style={S.formLabel}>Produk
        <select style={S.input} value={pid} onChange={e => setPid(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name} (stok: {p.stock})</option>)}
        </select>
      </label>
      <label style={S.formLabel}>Tipe Mutasi
        <select style={S.input} value={tipe} onChange={e => setTipe(e.target.value)}>
          <option value="kurang">Kurang (Hilang/Rusak/Kadaluarsa)</option>
          <option value="tambah">Tambah (Stock Opname/Koreksi)</option>
        </select>
      </label>
      <label style={S.formLabel}>Jumlah<input style={S.input} type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 14px', background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
        <div>Stok Awal: <strong>{stokAwal}</strong></div>
        <div>{tipe === 'tambah' ? '+' : '-'} <strong>{qty}</strong></div>
        <div>Stok Akhir: <strong style={{ color: tipe === 'tambah' ? '#2e7d32' : '#c62828' }}>{stokAkhir}</strong></div>
      </div>
      <label style={S.formLabel}>Keterangan
        <select style={S.input} value={note} onChange={e => setNote(e.target.value)}>
          <option value="">-- Pilih Alasan --</option>
          <option value="Barang hilang">Barang hilang</option>
          <option value="Barang rusak">Barang rusak</option>
          <option value="Kadaluarsa">Kadaluarsa</option>
          <option value="Stock opname">Stock opname</option>
          <option value="Koreksi data">Koreksi data</option>
          <option value="Lainnya">Lainnya</option>
        </select>
      </label>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({
        noMutasi: 'M' + Date.now().toString().slice(-5), productId: pid, productName: prod?.name || '',
        tipe, stokAwal, qty, stokAkhir, date: today(), note
      })}>Simpan Mutasi</button>
    </div>
  )
}

// =============================================
// 7. SETORAN HARIAN
// =============================================
export function SetoranHarian({ setorans, saveSetoran, transactions, kasData, loans, setModal, showToast }) {
  const sorted = [...setorans].sort((a, b) => b.date.localeCompare(a.date))

  function openForm() {
    // Hitung otomatis dari data hari ini
    const tgl = today()
    const penjualanCash = transactions.filter(t => t.date === tgl).reduce((a, t) => a + (t.total||0), 0)
    const angsuran = loans.flatMap(l => (l.installments||[]).filter(i => i.date === tgl)).reduce((a, i) => a + (i.amount||0), 0)
    const kasMasuk = kasData.filter(k => k.date === tgl && k.type === 'masuk').reduce((a, k) => a + (k.amount||0), 0)
    const kasKeluar = kasData.filter(k => k.date === tgl && k.type === 'keluar').reduce((a, k) => a + (k.amount||0), 0)

    setModal({
      title: 'Catat Setoran Harian',
      content: <SetoranForm
        defaults={{ penjualanCash, angsuran, pendapatanLain: kasMasuk, pengeluaran: kasKeluar }}
        onSave={async d => { await saveSetoran(d); setModal(null); showToast('Setoran harian berhasil dicatat') }}
      />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Setoran Harian</h2><button style={S.primaryBtn} onClick={openForm}>{IC.plus} Catat Setoran</button></div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'Penjualan Cash', 'Angsuran', 'Pendapatan Lain', 'Pengeluaran', 'Setor Bank', 'Selisih'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(s => {
            const totalMasuk = s.penjualanCash + s.angsuran + s.pendapatanLain
            const selisih = totalMasuk - s.pengeluaran - s.setorBank
            return (
              <tr key={s.id} style={S.tr}>
                <td style={S.td}>{fmtDate(s.date)}</td>
                <td style={S.td}>{formatRp(s.penjualanCash)}</td>
                <td style={S.td}>{formatRp(s.angsuran)}</td>
                <td style={S.td}>{formatRp(s.pendapatanLain)}</td>
                <td style={{ ...S.td, color: '#c62828' }}>{formatRp(s.pengeluaran)}</td>
                <td style={{ ...S.td, color: '#1565c0' }}>{formatRp(s.setorBank)}</td>
                <td style={{ ...S.td, fontWeight: 700, color: selisih >= 0 ? '#2e7d32' : '#c62828' }}>{formatRp(selisih)}</td>
              </tr>
            )
          })}{sorted.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada setoran</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function SetoranForm({ defaults, onSave }) {
  const [d, setD] = useState({ date: today(), penjualanCash: defaults.penjualanCash, angsuran: defaults.angsuran, pendapatanLain: defaults.pendapatanLain, pengeluaran: defaults.pengeluaran, setorBank: 0, note: '' })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const totalMasuk = d.penjualanCash + d.angsuran + d.pendapatanLain
  const saldoKas = totalMasuk - d.pengeluaran
  const selisih = saldoKas - d.setorBank

  return (
    <div style={S.form}>
      <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Pemasukan</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Penjualan Cash<input style={S.input} type="number" value={d.penjualanCash} onChange={e => set('penjualanCash', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Angsuran<input style={S.input} type="number" value={d.angsuran} onChange={e => set('angsuran', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Pendapatan Lain<input style={S.input} type="number" value={d.pendapatanLain} onChange={e => set('pendapatanLain', Number(e.target.value))} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Pengeluaran<input style={S.input} type="number" value={d.pengeluaran} onChange={e => set('pengeluaran', Number(e.target.value))} /></label>
        <label style={S.formLabel}>Setor ke Bank<input style={S.input} type="number" value={d.setorBank} onChange={e => set('setorBank', Number(e.target.value))} /></label>
      </div>
      <div style={{ padding: '12px 16px', background: '#f5f6fa', borderRadius: 10, fontSize: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>Total Masuk: <strong style={{ color: '#2e7d32' }}>{formatRp(totalMasuk)}</strong></div>
          <div>Pengeluaran: <strong style={{ color: '#c62828' }}>{formatRp(d.pengeluaran)}</strong></div>
          <div>Saldo Kas: <strong>{formatRp(saldoKas)}</strong></div>
          <div>Setor Bank: <strong style={{ color: '#1565c0' }}>{formatRp(d.setorBank)}</strong></div>
        </div>
        <div style={{ borderTop: '1px solid #ddd', marginTop: 8, paddingTop: 8, fontSize: 15, fontWeight: 700, color: selisih === 0 ? '#2e7d32' : '#c62828' }}>
          Selisih: {formatRp(selisih)} {selisih === 0 ? '(Balance)' : ''}
        </div>
      </div>
      <label style={S.formLabel}>Keterangan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave(d)}>Simpan Setoran</button>
    </div>
  )
}

// =============================================
// SHARED STYLES
// =============================================
const S = {
  title: { fontSize: 22, fontWeight: 700, marginBottom: 20 },
  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: 700 },
  card: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 14 },
  table: { width: '100%', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  tr: { transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  smallBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280', display: 'inline-flex', borderRadius: 4 },
  filterBtn: { padding: '5px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  filterActive: { background: '#1565c0', color: '#fff', borderColor: '#1565c0' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 300 },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#6b7280' },
  input: { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' },
}
