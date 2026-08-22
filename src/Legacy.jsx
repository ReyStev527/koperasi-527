// =============================================
// MODUL FITUR LEGACY (dari Aplikasi Kop Kartika)
// Retur, Kredit, Piutang, Diskon, Harga Bertingkat,
// Mutasi Stok, Setoran Harian
// =============================================
import { useState, useEffect, useMemo } from 'react'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { 
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const IC = {
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  x: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
}

// =============================================
// 1. RETUR BARANG
// =============================================
export function ReturBarang({ returs, saveRetur, products, suppliers, updateProductStock, adjustProductStock, setModal, showToast }) {
  const sorted = [...returs].sort((a, b) => b.date.localeCompare(a.date))

  const totalRetur = returs.reduce((a, r) => a + (r.totalHarga||0), 0)

  function openForm() {
    setModal({
      title: 'Catat Retur Barang',
      content: <ReturForm products={products} suppliers={suppliers} onSave={async d => {
        await saveRetur(d)
        // Barang KELUAR ke supplier → stok berkurang (atomik)
        const prod = products.find(p => p.id === d.productId)
        if (prod) await adjustProductStock(prod.id, -(d.qty||0))
        setModal(null)
        showToast('Retur ke supplier dicatat — stok dikurangi ' + d.qty)
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
  const filtered = products.filter(p => !search || String(p.name||'').toLowerCase().includes(search.toLowerCase()) || String(p.sku||'').toLowerCase().includes(search.toLowerCase()))

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
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: -12 }}>Atur harga jual lunas dan harga jual kredit untuk setiap produk. Di kasir, harga otomatis dipilih berdasarkan cara bayar pelanggan.</p>

      <div style={{ ...S.searchBox, marginBottom: 16 }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input style={S.searchInput} placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['SKU', 'Produk', 'Harga Beli', 'Harga Jual Lunas', 'Harga Jual Kredit', 'Margin 1', 'Margin 2', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
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
      <label style={S.formLabel}>Harga Jual Lunas (Rp)
        <input style={S.input} type="number" value={h1} onChange={e => setH1(Number(e.target.value))} />
        <span style={{ fontSize: 11, color: m1 >= 0 ? '#2e7d32' : '#c62828' }}>Margin: {m1}%</span>
      </label>
      <label style={S.formLabel}>Harga Jual Kredit (Rp)
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
export function MutasiStok({ mutasis, saveMutasi, products, updateProductStock, adjustProductStock, setModal, showToast }) {
  const sorted = [...mutasis].sort((a, b) => b.date.localeCompare(a.date))

  function openForm() {
    setModal({
      title: 'Catat Mutasi Stok',
      content: <MutasiForm products={products} onSave={async d => {
        await saveMutasi(d)
        const prod = products.find(p => p.id === d.productId)
        if (prod) {
          // Atomik: tambah/kurang stok via increment
          await adjustProductStock(prod.id, d.tipe === 'tambah' ? (d.qty||0) : -(d.qty||0))
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
    // Penjualan CASH = nota LUNAS + DP kredit hari ini (kredit penuh & retur TIDAK ikut — bukan uang tunai masuk)
    const txHariIni = transactions.filter(t => t.date === tgl && t.caraBayar !== 'RETURN' && !t.returned)
    const penjualanCash = txHariIni.filter(t => (t.caraBayar||'LUNAS') !== 'KREDIT').reduce((a, t) => a + (t.total||0), 0)
      + txHariIni.filter(t => t.caraBayar === 'KREDIT').reduce((a, t) => a + (Number(t.payment)||0), 0)
    const angsuran = loans.flatMap(l => (l.installments||[]).filter(i => i.date === tgl)).reduce((a, i) => a + (i.amount||0), 0)
    // Pendapatan lain = kas masuk SELAIN penjualan/DP (sudah dihitung di atas — hindari dobel)
    const kasMasuk = kasData.filter(k => k.date === tgl && k.type === 'masuk' && !['Penjualan Tunai','DP Penjualan Kredit'].includes(k.category)).reduce((a, k) => a + (k.amount||0), 0)
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
// STOCK OPNAME (HITUNG FISIK BARANG)
// Bandingkan stok catatan vs hitungan fisik, simpan selisihnya sebagai
// penyesuaian resmi berikut siapa yang menghitung. Draft tersimpan di server
// supaya hitungan tidak hilang kalau halaman tertutup di tengah jalan.
// =============================================
export function StockOpname({ opnames, saveOpname, products, adjustProductStock, saveMutasi, user, showToast, logAction }) {
  const [tab, setTab] = useState('hitung')          // hitung | riwayat
  const [kategori, setKategori] = useState('all')
  const [cari, setCari] = useState('')
  const [fisik, setFisik] = useState({})            // { productId: jumlah }
  const [catatan, setCatatan] = useState('')
  const [sedangSimpan, setSedangSimpan] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [lihat, setLihat] = useState(null)          // detail opname lama

  const draftKey = 'opname_draft'

  // Muat draft yang belum diselesaikan
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { getOne } = await import('./db')
        const r = await getOne('opnames', draftKey)
        if (alive && r && r.json) {
          const d = JSON.parse(r.json)
          setFisik(d.fisik || {}); setCatatan(d.catatan || '')
          if (Object.keys(d.fisik || {}).length) setStatusDraft('Draft dilanjutkan dari ' + (d.waktu || 'sebelumnya'))
        }
      } catch (err) { console.error('Muat draft opname gagal:', err) }
    })()
    return () => { alive = false }
  }, [])

  function simpanDraft(fisikBaru, catatanBaru) {
    import('./db').then(({ setOne }) => setOne('opnames', draftKey, {
      id: draftKey, json: JSON.stringify({ fisik: fisikBaru, catatan: catatanBaru, waktu: new Date().toLocaleString('id-ID') })
    })).catch(err => console.error('Simpan draft gagal:', err))
  }

  function isiFisik(pid, nilai) {
    const next = { ...fisik }
    if (nilai === '' || nilai == null) delete next[pid]
    else next[pid] = Number(nilai)
    setFisik(next)
    setStatusDraft('Tersimpan otomatis')
    simpanDraft(next, catatan)
  }

  const kategoriList = useMemo(
    () => [...new Set(products.map(p => p.category || 'Lainnya'))].sort(), [products])

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return products
      .filter(p => kategori === 'all' || (p.category || 'Lainnya') === kategori)
      .filter(p => !q || String(p.name||'').toLowerCase().includes(q) ||
                        String(p.sku||'').toLowerCase().includes(q) ||
                        String(p.barcode||'').toLowerCase().includes(q))
      .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')))
  }, [products, kategori, cari])

  // Ringkasan selisih — hanya produk yang SUDAH diisi angka fisiknya
  const terisi = products.filter(p => fisik[p.id] != null)
  const rincian = terisi.map(p => {
    const sistem = Number(p.stock) || 0
    const fis = Number(fisik[p.id]) || 0
    const selisih = fis - sistem
    return { productId: p.id, name: p.name, sku: p.sku || '', unit: p.unit || 'pcs',
             buyPrice: Number(p.buyPrice) || 0, stokSistem: sistem, stokFisik: fis,
             selisih, nilaiSelisih: selisih * (Number(p.buyPrice) || 0) }
  })
  const adaSelisih = rincian.filter(r => r.selisih !== 0)
  const nilaiSelisih = adaSelisih.reduce((a, r) => a + r.nilaiSelisih, 0)
  const jmlKurang = adaSelisih.filter(r => r.selisih < 0).length
  const jmlLebih = adaSelisih.filter(r => r.selisih > 0).length

  async function selesaikan() {
    if (sedangSimpan) return
    if (terisi.length === 0) { showToast('Belum ada barang yang dihitung', 'error'); return }
    const pesan = 'Selesaikan opname?\n\n' +
      terisi.length + ' barang dihitung\n' +
      adaSelisih.length + ' barang selisih (' + jmlKurang + ' kurang, ' + jmlLebih + ' lebih)\n' +
      'Nilai selisih: ' + formatRp(nilaiSelisih) + '\n\n' +
      'Stok akan DISESUAIKAN mengikuti hitungan fisik. Tindakan ini tercatat di Audit Trail.'
    if (!confirm(pesan)) return

    setSedangSimpan(true)
    const petugas = user?.name || user?.username || 'Tidak diketahui'
    const noOpname = 'OP' + String(new Date().getFullYear()).slice(2) +
      String(new Date().getMonth()+1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') +
      '-' + Math.random().toString(36).slice(2,6).toUpperCase()
    let berhasil = 0, gagal = 0
    try {
      // 1. Sesuaikan stok tiap barang yang selisih (atomik)
      for (const r of adaSelisih) {
        try {
          await adjustProductStock(r.productId, r.selisih)
          if (saveMutasi) {
            await saveMutasi({
              noMutasi: noOpname + '-' + r.productId.slice(-4),
              date: today(), productId: r.productId, productName: r.name,
              tipe: r.selisih > 0 ? 'tambah' : 'kurang', qty: Math.abs(r.selisih),
              stokAwal: r.stokSistem, stokAkhir: r.stokFisik,
              keterangan: 'Stock opname ' + noOpname + ' oleh ' + petugas,
            })
          }
          berhasil++
        } catch (err) { gagal++; console.error('Sesuaikan stok gagal:', r.name, err) }
      }
      // 2. Simpan berita acara opname
      await saveOpname({
        noOpname, date: today(), waktu: new Date().toLocaleString('id-ID'),
        petugas, petugasId: user?.id || '', kategori: kategori === 'all' ? 'Semua kategori' : kategori,
        catatan, jumlahDihitung: terisi.length, jumlahSelisih: adaSelisih.length,
        jumlahKurang: jmlKurang, jumlahLebih: jmlLebih, nilaiSelisih,
        items: rincian,
      })
      // 3. Audit
      if (logAction) await logAction('Stock Opname', 'selesai',
        noOpname + ': ' + terisi.length + ' barang dihitung, ' + adaSelisih.length +
        ' selisih, nilai ' + formatRp(nilaiSelisih) + ' — oleh ' + petugas)
      // 4. Hapus draft
      try { const { removeOne } = await import('./db'); await removeOne('opnames', draftKey) } catch {}

      setFisik({}); setCatatan(''); setStatusDraft('')
      showToast('Opname ' + noOpname + ' selesai — ' + berhasil + ' stok disesuaikan' + (gagal ? ', ' + gagal + ' gagal' : ''))
      setTab('riwayat')
    } catch (err) {
      console.error('Opname error:', err)
      showToast('Gagal menyimpan opname: ' + (err.message || 'cek koneksi'), 'error')
    }
    setSedangSimpan(false)
  }

  function batalkanDraft() {
    if (!confirm('Buang semua hitungan yang belum diselesaikan?')) return
    setFisik({}); setCatatan(''); setStatusDraft('')
    import('./db').then(({ removeOne }) => removeOne('opnames', draftKey)).catch(()=>{})
    showToast('Draft opname dibuang', 'error')
  }

  function cetakBeritaAcara(op) {
    const win = window.open('', '_blank', 'width=900,height=650')
    const baris = (op.items || []).filter(r => r.selisih !== 0)
    win.document.write('<html><head><title>Berita Acara ' + op.noOpname + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#000}' +
      'h2{margin:0 0 4px;font-size:16px}table{width:100%;border-collapse:collapse;margin-top:12px}' +
      'th,td{border:1px solid #999;padding:5px 7px}th{background:#eee;font-size:11px}' +
      '.r{text-align:right}.neg{color:#c00}.pos{color:#060}.ttd{margin-top:40px;display:flex;justify-content:space-between}' +
      '</style></head><body>' +
      '<h2>BERITA ACARA STOCK OPNAME</h2>' +
      '<div>Nomor: <b>' + op.noOpname + '</b> &nbsp;|&nbsp; Tanggal: ' + op.waktu + '</div>' +
      '<div>Petugas: <b>' + op.petugas + '</b> &nbsp;|&nbsp; Lingkup: ' + (op.kategori || '-') + '</div>' +
      '<div>Barang dihitung: ' + op.jumlahDihitung + ' &nbsp;|&nbsp; Selisih: ' + op.jumlahSelisih +
      ' (' + op.jumlahKurang + ' kurang, ' + op.jumlahLebih + ' lebih)</div>' +
      (op.catatan ? '<div>Catatan: ' + op.catatan + '</div>' : '') +
      '<table><tr><th>No</th><th>Nama Barang</th><th>SKU</th><th class="r">Catatan</th><th class="r">Fisik</th><th class="r">Selisih</th><th class="r">Nilai (Rp)</th></tr>' +
      baris.map((r,i) => '<tr><td>' + (i+1) + '</td><td>' + r.name + '</td><td>' + (r.sku||'-') + '</td>' +
        '<td class="r">' + r.stokSistem + '</td><td class="r">' + r.stokFisik + '</td>' +
        '<td class="r ' + (r.selisih<0?'neg':'pos') + '">' + (r.selisih>0?'+':'') + r.selisih + '</td>' +
        '<td class="r ' + (r.nilaiSelisih<0?'neg':'pos') + '">' + Number(r.nilaiSelisih).toLocaleString('id-ID') + '</td></tr>').join('') +
      '<tr><td colspan="6" class="r"><b>TOTAL NILAI SELISIH</b></td><td class="r"><b>' +
      Number(op.nilaiSelisih).toLocaleString('id-ID') + '</b></td></tr></table>' +
      '<div class="ttd"><div>Petugas Hitung<br><br><br><b>' + op.petugas + '</b></div>' +
      '<div>Mengetahui,<br>Ketua Koperasi<br><br><br>(________________)</div></div>' +
      '<script>setTimeout(()=>window.print(),400)<\/script></body></html>')
    win.document.close()
  }

  const sorted = [...(opnames || [])].filter(o => o.id !== draftKey)
    .sort((a,b) => String(b.waktu||b.date||'').localeCompare(String(a.waktu||a.date||'')))

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Stock Opname</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.filterBtn, ...(tab==='hitung'?S.filterActive:{}) }} onClick={() => setTab('hitung')}>Hitung Barang</button>
          <button style={{ ...S.filterBtn, ...(tab==='riwayat'?S.filterActive:{}) }} onClick={() => setTab('riwayat')}>Riwayat ({sorted.length})</button>
        </div>
      </div>

      {tab === 'hitung' && (<>
        <div style={{ ...S.card, background: '#e3f2fd', border: '1px solid #90caf9' }}>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            Isi kolom <b>Stok Fisik</b> sesuai hitungan barang di rak. Barang yang tidak diisi dianggap belum dihitung
            dan stoknya tidak akan diubah. Hitungan tersimpan otomatis — halaman boleh ditutup dan dilanjutkan nanti.
            {statusDraft && <span style={{ marginLeft: 8, color: '#2e7d32', fontWeight: 600 }}>{statusDraft}</span>}
          </div>
        </div>

        <div style={S.grid3}>
          <div style={S.statCard}><div style={S.statLabel}>Sudah Dihitung</div><div style={S.statVal}>{terisi.length} <span style={{fontSize:13,color:'#9e9e9e'}}>/ {products.length}</span></div></div>
          <div style={S.statCard}><div style={S.statLabel}>Barang Selisih</div><div style={{ ...S.statVal, color: adaSelisih.length ? '#e65100' : '#2e7d32' }}>{adaSelisih.length}</div><div style={{fontSize:11,color:'#6b7280'}}>{jmlKurang} kurang · {jmlLebih} lebih</div></div>
          <div style={S.statCard}><div style={S.statLabel}>Nilai Selisih</div><div style={{ ...S.statVal, color: nilaiSelisih < 0 ? '#c62828' : (nilaiSelisih > 0 ? '#2e7d32' : '#374151') }}>{formatRp(nilaiSelisih)}</div></div>
        </div>

        <div style={{ ...S.card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={S.searchBox}>
            <input style={S.searchInput} placeholder="Cari nama / SKU / barcode..." value={cari} onChange={e => setCari(e.target.value)} />
          </div>
          <select style={{ ...S.input, width: 190 }} value={kategori} onChange={e => setKategori(e.target.value)}>
            <option value="all">Semua kategori ({products.length})</option>
            {kategoriList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          {terisi.length > 0 && <button style={{ ...S.filterBtn, color: '#c62828' }} onClick={batalkanDraft}>Buang Draft</button>}
          <button style={{ ...S.primaryBtn, background: '#2e7d32', opacity: sedangSimpan ? .6 : 1 }} disabled={sedangSimpan} onClick={selesaikan}>
            {sedangSimpan ? 'Menyimpan...' : 'Selesaikan & Sesuaikan Stok'}
          </button>
        </div>

        <div style={S.card}>
          <label style={{ ...S.formLabel, marginBottom: 12 }}>Catatan opname (opsional)
            <input style={S.input} value={catatan} placeholder="mis. opname rutin akhir bulan, gudang utama"
              onChange={e => { setCatatan(e.target.value); simpanDraft(fisik, e.target.value) }} />
          </label>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table style={S.table}>
              <thead><tr>{['Nama Barang','SKU','Satuan','Stok Catatan','Stok Fisik','Selisih','Nilai (Rp)'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{daftar.map(p => {
                const sistem = Number(p.stock) || 0
                const ada = fisik[p.id] != null
                const fis = ada ? Number(fisik[p.id]) : null
                const sel = ada ? fis - sistem : null
                return (
                  <tr key={p.id} style={{ ...S.tr, background: !ada ? undefined : (sel === 0 ? '#f1f8e9' : '#fff3e0') }}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{p.sku || '-'}</td>
                    <td style={S.td}>{p.unit || 'pcs'}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{sistem}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <input type="number" style={{ ...S.input, width: 92, padding: '5px 8px', fontSize: 13, textAlign: 'right' }}
                        value={ada ? fisik[p.id] : ''} placeholder="-"
                        onChange={e => isiFisik(p.id, e.target.value)} />
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700,
                      color: sel == null ? '#bdbdbd' : (sel === 0 ? '#2e7d32' : (sel < 0 ? '#c62828' : '#1565c0')) }}>
                      {sel == null ? '-' : (sel > 0 ? '+' + sel : sel)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', color: sel && sel < 0 ? '#c62828' : '#6b7280' }}>
                      {sel == null || sel === 0 ? '-' : formatRp(sel * (Number(p.buyPrice)||0))}
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
            {daftar.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#9e9e9e', fontSize: 13 }}>Tidak ada barang yang cocok.</div>}
          </div>
        </div>
      </>)}

      {tab === 'riwayat' && (
        <div style={S.card}>
          <table style={S.table}>
            <thead><tr>{['No Opname','Waktu','Petugas','Lingkup','Dihitung','Selisih','Nilai Selisih','Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{sorted.map(op => (
              <tr key={op.id} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{op.noOpname}</td>
                <td style={S.td}>{op.waktu || fmtDate(op.date)}</td>
                <td style={S.td}>{op.petugas}</td>
                <td style={S.td}>{op.kategori}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{op.jumlahDihitung}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{op.jumlahSelisih}</td>
                <td style={{ ...S.td, textAlign: 'right', color: (op.nilaiSelisih||0) < 0 ? '#c62828' : '#2e7d32', fontWeight: 600 }}>{formatRp(op.nilaiSelisih)}</td>
                <td style={S.td}>
                  <button style={{ ...S.filterBtn, marginRight: 6 }} onClick={() => setLihat(lihat?.id === op.id ? null : op)}>{lihat?.id === op.id ? 'Tutup' : 'Rincian'}</button>
                  <button style={S.filterBtn} onClick={() => cetakBeritaAcara(op)}>Cetak</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {sorted.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9e9e9e', fontSize: 13 }}>Belum ada opname yang diselesaikan.</div>}

          {lihat && (
            <div style={{ marginTop: 16, padding: 14, background: '#fafafa', borderRadius: 10, border: '1px solid #e0e0e0' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Rincian selisih — {lihat.noOpname}</div>
              <table style={S.table}>
                <thead><tr>{['Nama Barang','Catatan','Fisik','Selisih','Nilai'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{(lihat.items||[]).filter(r => r.selisih !== 0).map((r,i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}>{r.name}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{r.stokSistem}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{r.stokFisik}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: r.selisih < 0 ? '#c62828' : '#1565c0' }}>{r.selisih > 0 ? '+' + r.selisih : r.selisih}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{formatRp(r.nilaiSelisih)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
