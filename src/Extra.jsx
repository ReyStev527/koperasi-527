// =============================================
// MODUL TAMBAHAN: PDF, Hutang Supplier, Kartu Anggota,
// Struk Thermal, Backup/Restore, Dashboard Grafik
// =============================================
import { useState, useRef } from 'react'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { return new Date().toISOString().slice(0, 10) }

// =============================================
// 1. CETAK STRUK THERMAL (browser print - 58mm/80mm)
// =============================================
export function cetakStruk(tx, settings, members) {
  const member = members?.find(m => m.id === tx.memberId)
  const win = window.open('', '_blank', 'width=320,height=600')
  win.document.write(`<!DOCTYPE html><html><head><style>
    @page { margin: 0; size: 80mm auto; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 4mm; padding: 0; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; }
    .right { text-align: right; }
    .small { font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
  </style></head><body>
    <div class="center bold" style="font-size:14px">${settings?.name || 'KOPERASI YONIF 527/BY'}</div>
    <div class="center small">Baladibya Yudha</div>
    <div class="center small">Lumajang, Jawa Timur</div>
    <div class="line"></div>
    <div class="row"><span>No: ${tx.noNota || '-'}</span><span>${tx.date || today()}</span></div>
    <div>Kasir: ${tx.cashier || 'admin'}</div>
    ${member ? '<div>Pembeli: ' + member.name + '</div>' : ''}
    <div class="line"></div>
    <table>
      ${(tx.items || []).map(item => {
        const sub = item.price * item.qty
        const dis = item.diskon ? sub * item.diskon / 100 : 0
        return '<tr><td colspan="2">' + item.name + '</td></tr>' +
          '<tr><td>' + item.qty + ' x ' + Number(item.price).toLocaleString('id-ID') +
          (item.diskon ? ' (dis ' + item.diskon + '%)' : '') +
          '</td><td class="right">' + Number(sub - dis).toLocaleString('id-ID') + '</td></tr>'
      }).join('')}
    </table>
    <div class="line"></div>
    ${tx.totalDiskon > 0 ? '<div class="row"><span>Subtotal</span><span>' + Number(tx.totalSebelumDiskon).toLocaleString('id-ID') + '</span></div><div class="row"><span>Diskon</span><span>-' + Number(tx.totalDiskon).toLocaleString('id-ID') + '</span></div>' : ''}
    <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>${Number(tx.total).toLocaleString('id-ID')}</span></div>
    <div class="line"></div>
    <div class="row"><span>${tx.caraBayar || 'LUNAS'}</span><span>${Number(tx.payment || 0).toLocaleString('id-ID')}</span></div>
    ${tx.caraBayar === 'LUNAS' && tx.change > 0 ? '<div class="row"><span>Kembali</span><span>' + Number(tx.change).toLocaleString('id-ID') + '</span></div>' : ''}
    ${tx.caraBayar === 'KREDIT' ? '<div class="row" style="color:red"><span>Sisa Piutang</span><span>' + Number(tx.total - (tx.payment || 0)).toLocaleString('id-ID') + '</span></div>' : ''}
    <div class="line"></div>
    <div class="center small">Terima kasih atas kunjungan Anda</div>
    <div class="center small">Barang yang sudah dibeli</div>
    <div class="center small">tidak dapat dikembalikan</div>
    <div class="center small" style="margin-top:8px">--- ${new Date().toLocaleString('id-ID')} ---</div>
    <script>setTimeout(()=>{window.print();},300)</script>
  </body></html>`)
  win.document.close()
}

// =============================================
// 2. CETAK LAPORAN PDF (via browser print)
// =============================================
export function cetakLaporanPDF(title, headers, rows, settings, summary) {
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><style>
    @page { margin: 15mm; size: A4; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 14px; margin: 4px 0 16px; color: #666; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #1565c0; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 12px; }
    .summary { background: #f5f6fa; padding: 12px 16px; border-radius: 8px; margin-top: 16px; font-size: 12px; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { button { display: none; } }
  </style></head><body>
    <div class="header">
      <div><h1>${settings?.name || 'KOPERASI YONIF 527/BY'}</h1><h2>${title}</h2></div>
      <div style="text-align:right;font-size:11px;color:#666">Tanggal cetak: ${new Date().toLocaleDateString('id-ID')}<br>Halaman 1</div>
    </div>
    <table>
      <thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(r => '<tr>' + r.map(c => '<td>' + (c ?? '-') + '</td>').join('') + '</tr>').join('')}</tbody>
    </table>
    ${summary ? '<div class="summary">' + summary + '</div>' : ''}
    <div class="footer">${settings?.name || 'KOPERASI YONIF 527/BY'} — Dicetak oleh sistem pada ${new Date().toLocaleString('id-ID')}</div>
    <script>setTimeout(()=>{window.print();},500)</script>
  </body></html>`)
  win.document.close()
}

// =============================================
// 3. KARTU ANGGOTA DIGITAL
// =============================================
export function KartuAnggota({ member, settings, logoSrc }) {
  const cardRef = useRef()

  function cetakKartu() {
    const win = window.open('', '_blank', 'width=500,height=350')
    win.document.write(`<!DOCTYPE html><html><head><style>
      @page { margin: 10mm; size: 86mm 54mm; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .card { width: 86mm; height: 54mm; border: 2px solid #1565c0; border-radius: 10px; overflow: hidden; position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 8px 12px; box-sizing: border-box; }
      .logo { width: 32px; height: 32px; border-radius: 6px; object-fit: contain; }
      .header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .title { font-size: 10px; font-weight: bold; line-height: 1.2; }
      .subtitle { font-size: 7px; opacity: 0.7; }
      .info { font-size: 9px; margin-top: 4px; }
      .info div { margin-bottom: 2px; }
      .no { font-size: 16px; font-weight: bold; letter-spacing: 2px; color: #ffd54f; margin-top: 4px; }
      .name { font-size: 13px; font-weight: bold; margin-top: 2px; }
      .footer { position: absolute; bottom: 6px; right: 12px; font-size: 7px; opacity: 0.5; }
      @media print { body { margin: 0; } }
    </style></head><body>
      <div class="card">
        <div class="header">
          ${logoSrc ? '<img src="' + logoSrc + '" class="logo">' : ''}
          <div><div class="title">${settings?.name || 'KOPERASI YONIF 527/BY'}</div><div class="subtitle">Baladibya Yudha — Kartu Anggota</div></div>
        </div>
        <div class="no">No. ${member.no}</div>
        <div class="name">${member.name}</div>
        <div class="info">
          <div>Telepon: ${member.phone || '-'}</div>
          <div>Alamat: ${member.address || '-'}</div>
          <div>Bergabung: ${fmtDate(member.joinDate)}</div>
        </div>
        <div class="footer">Valid s/d 31 Des ${new Date().getFullYear() + 1}</div>
      </div>
      <script>setTimeout(()=>{window.print();},400)</script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div ref={cardRef} style={{ width: 340, height: 210, borderRadius: 12, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', color: '#fff', padding: '14px 18px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {logoSrc && <img src={logoSrc} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{settings?.name || 'KOPERASI YONIF 527/BY'}</div>
            <div style={{ fontSize: 8, opacity: 0.6 }}>Baladibya Yudha — Kartu Anggota</div>
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#ffd54f', letterSpacing: 2, marginTop: 4 }}>No. {member.no}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{member.name}</div>
        <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.6, opacity: 0.85 }}>
          <div>Telepon: {member.phone || '-'}</div>
          <div>Alamat: {member.address || '-'}</div>
          <div>Bergabung: {fmtDate(member.joinDate)}</div>
        </div>
        <div style={{ position: 'absolute', bottom: 8, right: 14, fontSize: 7, opacity: 0.4 }}>Valid s/d 31 Des {new Date().getFullYear() + 1}</div>
      </div>
      <button onClick={cetakKartu} style={{ marginTop: 12, padding: '8px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cetak Kartu</button>
    </div>
  )
}

// =============================================
// 4. HUTANG KE SUPPLIER
// =============================================
export function HutangSupplier({ hutangs, saveHutang, bayarHutang, suppliers, setModal, showToast }) {
  const [filter, setFilter] = useState('all')

  let filtered = hutangs
  if (filter === 'belum') filtered = filtered.filter(h => h.sisa > 0)
  if (filter === 'lunas') filtered = filtered.filter(h => h.sisa <= 0)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const totalHutang = hutangs.filter(h => (h.sisa||0) > 0).reduce((a, h) => a + (h.sisa||0), 0)

  function openBayar(hutang) {
    setModal({
      title: 'Bayar Hutang - ' + hutang.supplierName,
      content: <BayarHutangForm hutang={hutang} onSave={async (amount) => {
        await bayarHutang(hutang, amount)
        setModal(null)
        showToast('Pembayaran hutang berhasil')
      }} />,
    })
  }

  function openTambah() {
    setModal({
      title: 'Catat Hutang ke Supplier',
      content: <TambahHutangForm suppliers={suppliers} onSave={async d => {
        await saveHutang(d)
        setModal(null)
        showToast('Hutang ke supplier berhasil dicatat')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Hutang ke Supplier</h2><button style={S.primaryBtn} onClick={openTambah}>{IC.plus} Catat Hutang</button></div>

      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Hutang</div><div style={{ ...S.statVal, color: '#c62828' }}>{formatRp(totalHutang)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Belum Lunas</div><div style={S.statVal}>{hutangs.filter(h => h.sisa > 0).length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Sudah Lunas</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{hutangs.filter(h => h.sisa <= 0).length}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['all', 'Semua'], ['belum', 'Belum Lunas'], ['lunas', 'Lunas']].map(([k, l]) => (
          <button key={k} style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'No Faktur', 'Supplier', 'Nilai', 'Dibayar', 'Sisa', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(h => {
            const isLunas = h.sisa <= 0
            return (
              <tr key={h.id} style={S.tr}>
                <td style={S.td}>{fmtDate(h.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{h.noFaktur}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{h.supplierName}</td>
                <td style={S.td}>{formatRp(h.total)}</td>
                <td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(h.totalBayar)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: isLunas ? '#2e7d32' : '#c62828' }}>{formatRp(Math.max(0, h.sisa))}</td>
                <td style={S.td}><span style={{ ...S.badge, background: isLunas ? '#e8f5e9' : '#ffebee', color: isLunas ? '#2e7d32' : '#c62828' }}>{isLunas ? 'LUNAS' : 'HUTANG'}</span></td>
                <td style={S.td}>{!isLunas && <button style={S.linkBtn} onClick={() => openBayar(h)}>Bayar</button>}</td>
              </tr>
            )
          })}{sorted.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada hutang</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function TambahHutangForm({ suppliers, onSave }) {
  const [d, setD] = useState({ supplierId: suppliers[0]?.id || '', total: '', date: today(), note: '' })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const sup = suppliers.find(s => s.id === d.supplierId)
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Supplier
        <select style={S.input} value={d.supplierId} onChange={e => set('supplierId', e.target.value)}>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label style={S.formLabel}>Nilai Hutang (Rp)<input style={S.input} type="number" value={d.total} onChange={e => set('total', e.target.value)} /></label>
      <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      <label style={S.formLabel}>Keterangan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%' }} onClick={() => onSave({
        noFaktur: 'HT-' + Date.now().toString().slice(-6), supplierId: d.supplierId, supplierName: sup?.name || '',
        total: Number(d.total), totalBayar: 0, sisa: Number(d.total), date: d.date, note: d.note, payments: []
      })}>Simpan</button>
    </div>
  )
}

function BayarHutangForm({ hutang, onSave }) {
  const [amount, setAmount] = useState(hutang.sisa)
  return (
    <div style={S.form}>
      <div style={{ padding: '10px 14px', background: '#ffebee', borderRadius: 8, fontSize: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>Nilai Hutang: <strong>{formatRp(hutang.total)}</strong></div>
          <div>Sudah Bayar: <strong style={{ color: '#2e7d32' }}>{formatRp(hutang.totalBayar)}</strong></div>
          <div>Sisa: <strong style={{ color: '#c62828' }}>{formatRp(hutang.sisa)}</strong></div>
        </div>
      </div>
      <label style={S.formLabel}>Jumlah Bayar (Rp)<input style={{ ...S.input, fontSize: 18, fontWeight: 700 }} type="number" max={hutang.sisa} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <button style={{ ...S.primaryBtn, width: '100%' }} disabled={amount <= 0 || amount > hutang.sisa} onClick={() => onSave(amount)}>Konfirmasi Pembayaran</button>
    </div>
  )
}

// =============================================
// 5. BACKUP & RESTORE
// =============================================
export function BackupRestore({ members, savings, loans, products, suppliers, kasData, jurnalData, transactions, settings, showToast, saveImportedProducts, saveImportedMembers }) {
  const [restoring, setRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState('')
  const fileRef = useRef()

  function doBackup() {
    const data = { version: '1.0', date: new Date().toISOString(), members, savings, loans, products, suppliers, kasData, jurnalData, transactions, settings }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'backup_koperasi_' + today() + '.json'
    a.click()
    showToast('Backup berhasil di-download')
  }

  async function doRestore(e) {
    const file = e.target.files[0]
    if (!file) return
    setRestoring(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.version || !data.members) { showToast('Format backup tidak valid', 'error'); setRestoring(false); return }

      const confirmed = window.confirm('PERINGATAN: Restore akan menambahkan ' +
        (data.products?.length || 0) + ' produk dan ' +
        (data.members?.length || 0) + ' anggota ke database.\n\nLanjutkan?')
      if (!confirmed) { setRestoring(false); return }

      if (data.products?.length && saveImportedProducts) {
        setRestoreProgress('Restore produk...')
        await saveImportedProducts(data.products, (done, total) => setRestoreProgress(`Produk: ${done}/${total}`))
      }
      if (data.members?.length && saveImportedMembers) {
        setRestoreProgress('Restore anggota...')
        await saveImportedMembers(data.members, (done, total) => setRestoreProgress(`Anggota: ${done}/${total}`))
      }

      setRestoreProgress('')
      showToast('Restore berhasil!')
    } catch (err) {
      showToast('Restore gagal: ' + err.message, 'error')
    }
    setRestoring(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const stats = [
    { l: 'Anggota', n: members.length },
    { l: 'Produk', n: products.length },
    { l: 'Transaksi', n: transactions.length },
    { l: 'Simpanan', n: savings.length },
    { l: 'Pinjaman', n: loans.length },
    { l: 'Kas', n: kasData.length },
  ]

  return (
    <div>
      <h2 style={S.title}>Backup & Restore Data</h2>
      <div style={S.grid2}>
        <div style={{ ...S.card, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#2e7d32' }}>Backup Data</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Download semua data koperasi dalam format JSON. Simpan sebagai cadangan.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {stats.map(s => (
              <div key={s.l} style={{ background: '#f5f6fa', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{s.n}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button style={{ ...S.primaryBtn, width: '100%', justifyContent: 'center', background: '#2e7d32' }} onClick={doBackup}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Download Backup
          </button>
        </div>
        <div style={{ ...S.card, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#e65100' }}>Restore Data</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Upload file backup JSON untuk mengembalikan data. Data yang sudah ada TIDAK akan dihapus.</p>
          <input ref={fileRef} type="file" accept=".json" onChange={doRestore} style={{ ...S.input, padding: 8, fontSize: 13, width: '100%' }} />
          {restoring && <div style={{ textAlign: 'center', padding: 16, color: '#e65100', fontWeight: 600 }}>{restoreProgress || 'Sedang restore data...'}</div>}
        </div>
      </div>
    </div>
  )
}

// =============================================
// 6. DASHBOARD GRAFIK DETAIL
// =============================================
export function DashboardCharts({ transactions, kasData, savings, loans, products }) {
  const [period, setPeriod] = useState('7d')

  // Data per hari
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const dateRange = Array.from({ length: days }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i))
    return d.toISOString().slice(0, 10)
  })

  const dailySales = dateRange.map(d => ({
    date: d,
    label: d.slice(8, 10) + '/' + d.slice(5, 7),
    sales: transactions.filter(t => t.date === d).reduce((a, t) => a + (t.total || 0), 0),
    count: transactions.filter(t => t.date === d).length,
    kasIn: kasData.filter(k => k.date === d && k.type === 'masuk').reduce((a, k) => a + (k.amount||0), 0),
    kasOut: kasData.filter(k => k.date === d && k.type === 'keluar').reduce((a, k) => a + (k.amount||0), 0),
  }))

  const maxSales = Math.max(1, ...dailySales.map(d => d.sales))
  const totalPeriod = dailySales.reduce((a, d) => a + d.sales, 0)
  const avgDaily = Math.round(totalPeriod / days)

  // Top 10 produk terlaris
  const productSales = {}
  transactions.forEach(tx => {
    (tx.items || []).forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + item.qty
    })
  })
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const maxQty = Math.max(1, ...topProducts.map(p => p[1]))

  // Kategori stok
  const catStock = {}
  products.forEach(p => { catStock[p.category] = (catStock[p.category] || 0) + p.stock })
  const topCats = Object.entries(catStock).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxCatStock = Math.max(1, ...topCats.map(c => c[1]))

  const barColors = ['#1565c0', '#2e7d32', '#e65100', '#7b1fa2', '#c62828', '#00838f', '#4e342e', '#37474f', '#ff8f00', '#1b5e20']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Analisis & Grafik</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['7d', '7 Hari'], ['30d', '30 Hari'], ['90d', '90 Hari']].map(([k, l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(period === k ? S.filterActive : {}) }} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Penjualan ({days} hari)</div><div style={{ ...S.statVal, color: '#1565c0' }}>{formatRp(totalPeriod)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Rata-rata / Hari</div><div style={S.statVal}>{formatRp(avgDaily)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total Transaksi</div><div style={S.statVal}>{dailySales.reduce((a, d) => a + d.count, 0)}</div></div>
      </div>

      {/* Grafik Penjualan Harian */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Penjualan Harian</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: days > 30 ? 1 : 3, height: 160 }}>
          {dailySales.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', background: d.sales > 0 ? '#1565c0' : '#e5e7eb', borderRadius: '3px 3px 0 0', height: Math.max(2, (d.sales / maxSales) * 140), transition: 'height 0.3s' }} title={d.date + ': ' + formatRp(d.sales)} />
              {days <= 14 && <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>{d.label}</div>}
            </div>
          ))}
        </div>
        {days > 14 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6b7280', marginTop: 4 }}><span>{dailySales[0]?.label}</span><span>{dailySales[Math.floor(days/2)]?.label}</span><span>{dailySales[days-1]?.label}</span></div>}
      </div>

      <div style={S.grid2}>
        {/* Top Produk */}
        <div style={S.card}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top 10 Produk Terlaris</h4>
          {topProducts.length === 0 ? <div style={{ color: '#999', fontSize: 13 }}>Belum ada data penjualan</div> : topProducts.map(([name, qty], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 20, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>{name}</div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (qty / maxQty * 100) + '%', background: barColors[i % 10], borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{qty}</div>
            </div>
          ))}
        </div>

        {/* Stok per Kategori */}
        <div style={S.card}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Stok per Kategori</h4>
          {topCats.map(([cat, stock], i) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>{cat}</div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (stock / maxCatStock * 100) + '%', background: barColors[i % 10], borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{stock} pcs</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================
// 7. LAPORAN TUTUP BUKU (Tgl 26 - 25)
// Per Kompi, dengan Pangkat, NRP, Kredit/Lunas
// =============================================
export function LaporanTutupBuku({ transactions, members, settings }) {
  // Default: periode 26 bulan lalu — 25 bulan ini
  const now = new Date()
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 25)
  const defaultStart = new Date(defaultEnd)
  defaultStart.setMonth(defaultStart.getMonth() - 1)
  defaultStart.setDate(26)

  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().slice(0, 10))
  const [filterKompi, setFilterKompi] = useState('all')

  // Filter transaksi dalam periode
  const periodTx = transactions.filter(t => t.date >= startDate && t.date <= endDate)

  // Daftar kompi dari members
  const kompiList = [...new Set(members.map(m => m.kompi || 'LAINNYA'))].filter(Boolean).sort()

  // Group by kompi
  const kompiData = {}
  periodTx.forEach(tx => {
    const member = members.find(m => m.id === tx.memberId)
    const kompi = member?.kompi || 'NON-ANGGOTA'
    if (filterKompi !== 'all' && kompi !== filterKompi) return

    if (!kompiData[kompi]) kompiData[kompi] = []
    kompiData[kompi].push({
      ...tx,
      pangkat: member?.pangkat || '-',
      nrp: member?.nrp || '-',
      memberName: member?.name || tx.customerName || 'Umum',
      kompi,
    })
  })

  const sortedKompi = Object.keys(kompiData).sort()
  const filteredTx = sortedKompi.flatMap(k => kompiData[k])
  const grandTotalLunas = filteredTx.filter(t => (t.caraBayar||'LUNAS') === 'LUNAS').reduce((a, t) => a + (t.total||0), 0)
  const grandTotalKredit = filteredTx.filter(t => t.caraBayar === 'KREDIT').reduce((a, t) => a + (t.total||0), 0)
  const grandTotal = grandTotalLunas + grandTotalKredit
  const judulKompi = filterKompi === 'all' ? 'SEMUA KOMPI' : filterKompi

  // Hitung bulan/tahun untuk judul
  const endD = new Date(endDate)
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const judulPeriode = `${bulanNama[endD.getMonth()]} ${endD.getFullYear()}`

  function cetakLaporan() {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>
      @page { margin: 12mm; size: A4 landscape; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
      h1 { font-size: 16px; text-align: center; margin: 0; }
      h2 { font-size: 13px; text-align: center; margin: 4px 0 12px; color: #666; font-weight: normal; }
      h3 { font-size: 13px; margin: 16px 0 6px; padding: 4px 8px; background: #1565c0; color: #fff; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #f5f5f5; padding: 5px 8px; text-align: left; border: 1px solid #ccc; font-size: 10px; }
      td { padding: 4px 8px; border: 1px solid #ccc; font-size: 10px; }
      .right { text-align: right; }
      .bold { font-weight: bold; }
      .kredit { color: #e65100; }
      .lunas { color: #2e7d32; }
      .total-row td { background: #f5f6fa; font-weight: bold; }
      .grand td { background: #1565c0; color: #fff; font-weight: bold; font-size: 12px; }
      .footer { text-align: center; font-size: 9px; color: #999; margin-top: 16px; }
      @media print { button { display: none; } }
    </style></head><body>
      <h1>${settings?.name || 'KOPERASI YONIF 527/BY'}</h1>
      <h2>LAPORAN TUTUP BUKU — ${judulKompi}<br>${judulPeriode} | Periode: ${fmtDate(startDate)} s/d ${fmtDate(endDate)}</h2>

      ${sortedKompi.map(kompi => {
        const rows = kompiData[kompi]
        const kompiLunas = rows.filter(t => (t.caraBayar||'LUNAS') === 'LUNAS').reduce((a, t) => a + (t.total||0), 0)
        const kompiKredit = rows.filter(t => t.caraBayar === 'KREDIT').reduce((a, t) => a + (t.total||0), 0)
        return '<h3>' + kompi + ' (' + rows.length + ' transaksi)</h3>' +
          '<table><thead><tr><th>No</th><th>Tanggal</th><th>No Nota</th><th>Pangkat</th><th>Nama</th><th>NRP</th><th>Barang</th><th>Qty</th><th class="right">Total</th><th>Status</th></tr></thead><tbody>' +
          rows.map((tx, i) => {
            const items = (tx.items||[]).map(it => it.name).join(', ')
            const totalQty = (tx.items||[]).reduce((a, it) => a + (it.qty||0), 0)
            const isKredit = tx.caraBayar === 'KREDIT'
            return '<tr><td>' + (i+1) + '</td><td>' + (tx.date||'') + '</td><td>' + (tx.noNota||'-') + '</td><td>' + tx.pangkat + '</td><td class="bold">' + tx.memberName + '</td><td>' + tx.nrp + '</td><td>' + items + '</td><td class="right">' + totalQty + '</td><td class="right">' + Number(tx.total||0).toLocaleString('id-ID') + '</td><td class="' + (isKredit ? 'kredit' : 'lunas') + ' bold">' + (isKredit ? 'KREDIT' : 'LUNAS') + '</td></tr>'
          }).join('') +
          '<tr class="total-row"><td colspan="8" class="right">Total ' + kompi + '</td><td class="right">' + Number(kompiLunas + kompiKredit).toLocaleString('id-ID') + '</td><td></td></tr>' +
          '<tr class="total-row"><td colspan="8" class="right">LUNAS</td><td class="right lunas">' + Number(kompiLunas).toLocaleString('id-ID') + '</td><td></td></tr>' +
          '<tr class="total-row"><td colspan="8" class="right">KREDIT</td><td class="right kredit">' + Number(kompiKredit).toLocaleString('id-ID') + '</td><td></td></tr>' +
          '</tbody></table>'
      }).join('')}

      <table><tbody>
        <tr class="grand"><td colspan="8" class="right">GRAND TOTAL ${judulKompi}</td><td class="right">Rp ${Number(grandTotal).toLocaleString('id-ID')}</td><td></td></tr>
        <tr class="total-row"><td colspan="8" class="right">Total LUNAS</td><td class="right lunas">Rp ${Number(grandTotalLunas).toLocaleString('id-ID')}</td><td></td></tr>
        <tr class="total-row"><td colspan="8" class="right">Total KREDIT</td><td class="right kredit">Rp ${Number(grandTotalKredit).toLocaleString('id-ID')}</td><td></td></tr>
      </tbody></table>

      <div class="footer">Dicetak: ${new Date().toLocaleString('id-ID')} — ${settings?.name || 'KOPERASI YONIF 527/BY'}</div>
      <script>setTimeout(()=>{window.print();},500)</script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Laporan Tutup Buku</h2>
        <button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={cetakLaporan}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Cetak {filterKompi === 'all' ? 'Semua Kompi' : filterKompi}
        </button>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <label style={S.formLabel}>Tanggal Mulai (tgl 26)<input style={S.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label style={S.formLabel}>Tanggal Akhir (tgl 25)<input style={S.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          <label style={S.formLabel}>Filter Kompi
            <select style={S.input} value={filterKompi} onChange={e => setFilterKompi(e.target.value)}>
              <option value="all">Semua Kompi</option>
              {kompiList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Periode: <strong>{fmtDate(startDate)}</strong> s/d <strong>{fmtDate(endDate)}</strong> — Laporan <strong>{judulPeriode}</strong></div>
      </div>

      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Transaksi</div><div style={S.statVal}>{periodTx.length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total LUNAS</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{formatRp(grandTotalLunas)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total KREDIT</div><div style={{ ...S.statVal, color: '#e65100' }}>{formatRp(grandTotalKredit)}</div></div>
      </div>

      {sortedKompi.map(kompi => {
        const rows = kompiData[kompi]
        const kompiLunas = rows.filter(t => (t.caraBayar||'LUNAS') === 'LUNAS').reduce((a, t) => a + (t.total||0), 0)
        const kompiKredit = rows.filter(t => t.caraBayar === 'KREDIT').reduce((a, t) => a + (t.total||0), 0)
        return (
          <div key={kompi} style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1565c0' }}>{kompi}</h3>
              <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <span>LUNAS: <strong style={{ color: '#2e7d32' }}>{formatRp(kompiLunas)}</strong></span>
                <span>KREDIT: <strong style={{ color: '#e65100' }}>{formatRp(kompiKredit)}</strong></span>
                <span>Total: <strong>{formatRp(kompiLunas + kompiKredit)}</strong></span>
              </div>
            </div>
            <table style={S.table}>
              <thead><tr>{['No', 'Tanggal', 'No Nota', 'Pangkat', 'Nama', 'NRP', 'Barang', 'Qty', 'Total', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((tx, i) => {
                  const items = (tx.items||[]).map(it => it.name).join(', ')
                  const totalQty = (tx.items||[]).reduce((a, it) => a + (it.qty||0), 0)
                  const isKredit = tx.caraBayar === 'KREDIT'
                  return (
                    <tr key={tx.id || i} style={S.tr}>
                      <td style={S.td}>{i + 1}</td>
                      <td style={S.td}>{fmtDate(tx.date)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.noNota || '-'}</td>
                      <td style={S.td}>{tx.pangkat}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{tx.memberName}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.nrp}</td>
                      <td style={{ ...S.td, fontSize: 11, maxWidth: 200 }}>{items || '-'}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{totalQty}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{formatRp(tx.total)}</td>
                      <td style={S.td}><span style={{ ...S.badge, background: isKredit ? '#fff3e0' : '#e8f5e9', color: isKredit ? '#e65100' : '#2e7d32' }}>{isKredit ? 'KREDIT' : 'LUNAS'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {sortedKompi.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Tidak ada transaksi dalam periode ini</div>}

      {sortedKompi.length > 0 && (
        <div style={{ ...S.card, background: '#0f172a', color: '#fff', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>TOTAL {judulKompi}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{formatRp(grandTotal)}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8, fontSize: 14 }}>
            <span>LUNAS: <strong style={{ color: '#66bb6a' }}>{formatRp(grandTotalLunas)}</strong></span>
            <span>KREDIT: <strong style={{ color: '#ffb74d' }}>{formatRp(grandTotalKredit)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================
// 8. STOK HISTORI (lihat stok per tanggal)
// =============================================
export function StokHistori({ products, stockIn, transactions, mutasis }) {
  const [targetDate, setTargetDate] = useState(today())
  const [search, setSearch] = useState('')
  const [filterTipe, setFilterTipe] = useState('all') // all, MILIK, TITIPAN

  // Hitung stok pada tanggal tertentu:
  // Stok sekarang - (barang masuk setelah tanggal) + (penjualan setelah tanggal) - (mutasi tambah setelah) + (mutasi kurang setelah)
  const stokPadaTanggal = products.map(p => {
    let stok = p.stock || 0

    // Kurangi stok dari barang masuk SETELAH tanggal target
    (stockIn||[]).filter(si => si.date > targetDate).forEach(si => {
      (si.items||[]).forEach(it => {
        if (it.productId === p.id) stok -= (it.qty||0)
      })
    })

    // Tambahkan kembali stok dari penjualan SETELAH tanggal target
    (transactions||[]).filter(tx => tx.date > targetDate).forEach(tx => {
      (tx.items||[]).forEach(it => {
        if (it.productId === p.id) stok += (it.qty||0)
      })
    })

    // Reverse mutasi SETELAH tanggal target
    (mutasis||[]).filter(m => m.date > targetDate).forEach(m => {
      if (m.productId === p.id) {
        if (m.tipe === 'tambah') stok -= (m.qty||0)
        else stok += (m.qty||0)
      }
    })

    return { ...p, stokHistori: Math.max(0, stok) }
  })

  const filtered = stokPadaTanggal.filter(p => {
    if (filterTipe !== 'all' && (p.tipeBarang||'MILIK') !== filterTipe) return false
    if (search && !String(p.name||'').toLowerCase().includes(search.toLowerCase()) && !String(p.sku||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalItems = filtered.reduce((a, p) => a + p.stokHistori, 0)
  const totalValue = filtered.reduce((a, p) => a + (p.stokHistori * (p.buyPrice||0)), 0)
  const titipanCount = filtered.filter(p => (p.tipeBarang||'MILIK') === 'TITIPAN').length

  const isToday = targetDate === today()

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Stok per Tanggal</h2>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <label style={fl}>Lihat stok pada tanggal:
            <input style={inp} type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </label>
          <label style={fl}>Cari produk:
            <input style={inp} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama / SKU..." />
          </label>
          <label style={fl}>Tipe Barang:
            <select style={inp} value={filterTipe} onChange={e => setFilterTipe(e.target.value)}>
              <option value="all">Semua</option>
              <option value="MILIK">Milik Koperasi</option>
              <option value="TITIPAN">Barang Titipan</option>
            </select>
          </label>
        </div>
        {!isToday && <div style={{ marginTop: 10, padding: '6px 12px', background: '#fff3e0', borderRadius: 8, fontSize: 13, color: '#e65100' }}>Menampilkan stok pada tanggal <strong>{fmtDate(targetDate)}</strong> (estimasi berdasarkan transaksi)</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>Total Produk</div><div style={{ fontSize: 20, fontWeight: 700 }}>{filtered.length}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>Total Item Stok</div><div style={{ fontSize: 20, fontWeight: 700 }}>{totalItems.toLocaleString('id-ID')}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>Nilai Inventaris</div><div style={{ fontSize: 20, fontWeight: 700, color: '#1565c0' }}>{formatRp(totalValue)}</div></div>
        {titipanCount > 0 && <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>Barang Titipan</div><div style={{ fontSize: 20, fontWeight: 700, color: '#7b1fa2' }}>{titipanCount}</div></div>}
      </div>

      <div style={card}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr>{['SKU', 'Produk', 'Tipe', 'Kategori', isToday ? 'Stok' : 'Stok ' + fmtDate(targetDate), 'Stok Sekarang', 'Selisih', 'Nilai'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(p => {
            const diff = p.stokHistori - (p.stock||0)
            return (
              <tr key={p.id}>
                <td style={td}>{String(p.sku||'')}</td>
                <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                <td style={td}><span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: (p.tipeBarang||'MILIK') === 'TITIPAN' ? '#f3e5f5' : '#e8f5e9', color: (p.tipeBarang||'MILIK') === 'TITIPAN' ? '#7b1fa2' : '#2e7d32' }}>{p.tipeBarang||'MILIK'}</span></td>
                <td style={td}>{p.category||'-'}</td>
                <td style={{ ...td, fontWeight: 600 }}>{p.stokHistori}</td>
                <td style={td}>{p.stock||0}</td>
                <td style={{ ...td, color: diff > 0 ? '#2e7d32' : diff < 0 ? '#c62828' : '#999' }}>{diff > 0 ? '+' : ''}{diff}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRp(p.stokHistori * (p.buyPrice||0))}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

const card = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const fl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#6b7280' }
const inp = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }
const th = { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }
const td = { padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }

// =============================================
// ICONS & STYLES
// =============================================
// =============================================
// 8. TAGIHAN JUYAR (Potong Gaji) per Kompi
// + TUNGGAKAN ketika tidak bisa dipotong
// =============================================
export function TagihanJuyar({ transactions, piutangs, members, settings, savePiutang, showToast, setModal }) {
  const now = new Date()
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 25)
  const defaultStart = new Date(defaultEnd); defaultStart.setMonth(defaultStart.getMonth() - 1); defaultStart.setDate(26)

  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().slice(0, 10))
  const [filterKompi, setFilterKompi] = useState('all')

  const kompiList = [...new Set(members.map(m => m.kompi || 'LAINNYA'))].filter(Boolean).sort()

  // Piutang kredit dalam periode yang belum lunas
  const kreditPeriod = piutangs.filter(p =>
    p.date >= startDate && p.date <= endDate && (p.sisa||0) > 0
  )

  // Group per kompi → per anggota
  const kompiData = {}
  kreditPeriod.forEach(p => {
    const member = members.find(m => m.id === p.memberId)
    const kompi = member?.kompi || 'NON-ANGGOTA'
    if (filterKompi !== 'all' && kompi !== filterKompi) return
    if (!kompiData[kompi]) kompiData[kompi] = {}
    const mid = p.memberId || 'umum'
    if (!kompiData[kompi][mid]) kompiData[kompi][mid] = {
      member, pangkat: member?.pangkat || '-', nrp: member?.nrp || '-',
      name: member?.name || p.customerName || 'Umum', items: [], totalTagihan: 0, totalTunggakan: 0
    }
    kompiData[kompi][mid].items.push(p)
    kompiData[kompi][mid].totalTagihan += (p.sisa||0)
  })

  // Cek tunggakan (piutang dari periode SEBELUMNYA yang masih belum lunas)
  const tunggakan = piutangs.filter(p => p.date < startDate && (p.sisa||0) > 0)
  tunggakan.forEach(p => {
    const member = members.find(m => m.id === p.memberId)
    const kompi = member?.kompi || 'NON-ANGGOTA'
    if (filterKompi !== 'all' && kompi !== filterKompi) return
    if (!kompiData[kompi]) kompiData[kompi] = {}
    const mid = p.memberId || 'umum'
    if (!kompiData[kompi][mid]) kompiData[kompi][mid] = {
      member, pangkat: member?.pangkat || '-', nrp: member?.nrp || '-',
      name: member?.name || 'Umum', items: [], totalTagihan: 0, totalTunggakan: 0
    }
    kompiData[kompi][mid].totalTunggakan += (p.sisa||0)
  })

  const sortedKompi = Object.keys(kompiData).sort()
  const grandTotal = Object.values(kompiData).reduce((a, members_) => a + Object.values(members_).reduce((b, m) => b + m.totalTagihan + m.totalTunggakan, 0), 0)

  const endD = new Date(endDate)
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  function cetakTagihan() {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>
      @page{margin:12mm;size:A4 landscape}body{font-family:Arial;font-size:11px}
      h1{font-size:16px;text-align:center;margin:0}h2{font-size:13px;text-align:center;color:#666;margin:4px 0 12px}
      h3{font-size:13px;margin:16px 0 6px;padding:4px 8px;background:#1565c0;color:#fff;border-radius:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#f5f5f5;padding:5px 8px;border:1px solid #ccc;font-size:10px}
      td{padding:4px 8px;border:1px solid #ccc;font-size:10px}.r{text-align:right}.b{font-weight:bold}
      .tunggakan{color:#c62828}.total td{background:#f5f6fa;font-weight:bold}.grand td{background:#1565c0;color:#fff;font-weight:bold}
      .footer{text-align:center;font-size:9px;color:#999;margin-top:16px}@media print{button{display:none}}
    </style></head><body>
      <h1>${settings?.name || 'KOPERASI YONIF 527/BY'}</h1>
      <h2>TAGIHAN JUYAR (POTONG GAJI) — ${filterKompi === 'all' ? 'SEMUA KOMPI' : filterKompi}<br>${bulanNama[endD.getMonth()]} ${endD.getFullYear()} | ${fmtDate(startDate)} s/d ${fmtDate(endDate)}</h2>
      ${sortedKompi.map(kompi => {
        const anggotaList = Object.values(kompiData[kompi]).sort((a,b) => (a.name||'').localeCompare(b.name||''))
        const totalKompi = anggotaList.reduce((a, m) => a + m.totalTagihan + m.totalTunggakan, 0)
        return '<h3>' + kompi + '</h3><table><tr><th>No</th><th>Pangkat</th><th>Nama</th><th>NRP</th><th class="r">Tagihan Bln Ini</th><th class="r">Tunggakan</th><th class="r">Total Potong</th></tr>' +
          anggotaList.map((m, i) => '<tr><td>'+(i+1)+'</td><td>'+m.pangkat+'</td><td class="b">'+m.name+'</td><td>'+m.nrp+'</td><td class="r">'+Number(m.totalTagihan).toLocaleString('id-ID')+'</td><td class="r tunggakan">'+Number(m.totalTunggakan).toLocaleString('id-ID')+'</td><td class="r b">'+Number(m.totalTagihan+m.totalTunggakan).toLocaleString('id-ID')+'</td></tr>').join('') +
          '<tr class="total"><td colspan="6" class="r">Total '+kompi+'</td><td class="r">'+Number(totalKompi).toLocaleString('id-ID')+'</td></tr></table>'
      }).join('')}
      <table><tr class="grand"><td colspan="6" class="r">GRAND TOTAL</td><td class="r">Rp ${Number(grandTotal).toLocaleString('id-ID')}</td></tr></table>
      <div class="footer">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      <script>setTimeout(()=>{window.print()},500)<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Tagihan Juyar (Potong Gaji)</h2>
        <button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={cetakTagihan}>Cetak {filterKompi === 'all' ? 'Semua' : filterKompi}</button>
      </div>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <label style={S.formLabel}>Dari (tgl 26)<input style={S.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label style={S.formLabel}>Sampai (tgl 25)<input style={S.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          <label style={S.formLabel}>Filter Kompi<select style={S.input} value={filterKompi} onChange={e => setFilterKompi(e.target.value)}><option value="all">Semua Kompi</option>{kompiList.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        </div>
      </div>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Tagihan</div><div style={{ ...S.statVal, color: '#1565c0' }}>{formatRp(grandTotal)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Anggota Ditagih</div><div style={S.statVal}>{Object.values(kompiData).reduce((a, m) => a + Object.keys(m).length, 0)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Ada Tunggakan</div><div style={{ ...S.statVal, color: '#c62828' }}>{Object.values(kompiData).reduce((a, members_) => a + Object.values(members_).filter(m => m.totalTunggakan > 0).length, 0)}</div></div>
      </div>
      {sortedKompi.map(kompi => {
        const anggotaList = Object.values(kompiData[kompi]).sort((a,b) => (a.name||'').localeCompare(b.name||''))
        return (
          <div key={kompi} style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1565c0', marginBottom: 12 }}>{kompi}</h3>
            <table style={S.table}>
              <thead><tr>{['No', 'Pangkat', 'Nama', 'NRP', 'Tagihan Bln Ini', 'Tunggakan', 'Total Potong'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{anggotaList.map((m, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{i+1}</td><td style={S.td}>{m.pangkat}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{m.nrp}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{formatRp(m.totalTagihan)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: m.totalTunggakan > 0 ? '#c62828' : '#6b7280', fontWeight: m.totalTunggakan > 0 ? 700 : 400 }}>{formatRp(m.totalTunggakan)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(m.totalTagihan + m.totalTunggakan)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      })}
      {sortedKompi.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Tidak ada tagihan kredit dalam periode ini</div>}
    </div>
  )
}

// =============================================
// 9. LABA PER ANGGOTA (untuk SHU)
// =============================================
export function LabaPerAnggota({ transactions, members, products, settings }) {
  const [year, setYear] = useState(new Date().getFullYear())

  const yearStr = String(year)

  // Hitung laba per anggota dari transaksi
  const memberProfit = {}
  transactions.filter(t => (t.date||'').startsWith(yearStr)).forEach(tx => {
    const mid = tx.memberId || '_umum'
    if (!memberProfit[mid]) memberProfit[mid] = { totalBeli: 0, totalLaba: 0, txCount: 0 }
    memberProfit[mid].txCount++
    memberProfit[mid].totalBeli += (tx.total||0)

    // Hitung laba = harga jual - HPP (harga beli)
    ;(tx.items||[]).forEach(it => {
      const prod = products.find(p => p.id === it.productId)
      const hpp = (prod?.buyPrice||0) * (it.qty||0)
      const revenue = (it.price||0) * (it.qty||0) * (1 - (it.diskon||0)/100)
      memberProfit[mid].totalLaba += (revenue - hpp)
    })
  })

  const sortedMembers = Object.entries(memberProfit)
    .map(([mid, data]) => {
      const m = members.find(x => x.id === mid)
      return { ...data, mid, name: m?.name || 'Non-Anggota', pangkat: m?.pangkat||'-', nrp: m?.nrp||'-', kompi: m?.kompi||'-' }
    })
    .sort((a, b) => b.totalLaba - a.totalLaba)

  const totalLabaSemua = sortedMembers.reduce((a, m) => a + m.totalLaba, 0)
  const totalBeliSemua = sortedMembers.reduce((a, m) => a + m.totalBeli, 0)

  function cetakLaba() {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>
      @page{margin:12mm;size:A4}body{font-family:Arial;font-size:11px}
      h1{font-size:16px;text-align:center;margin:0}h2{font-size:13px;text-align:center;color:#666;margin:4px 0 12px}
      table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:5px 8px;border:1px solid #ccc;font-size:10px}
      td{padding:4px 8px;border:1px solid #ccc;font-size:10px}.r{text-align:right}.b{font-weight:bold}
      .total td{background:#1565c0;color:#fff;font-weight:bold}
      .footer{text-align:center;font-size:9px;color:#999;margin-top:16px}@media print{button{display:none}}
    </style></head><body>
      <h1>${settings?.name || 'KOPERASI YONIF 527/BY'}</h1>
      <h2>LABA PER ANGGOTA — TAHUN ${year}<br>Untuk Perhitungan SHU</h2>
      <table><tr><th>No</th><th>Pangkat</th><th>Nama</th><th>NRP</th><th>Kompi</th><th class="r">Transaksi</th><th class="r">Total Belanja</th><th class="r">Laba Diberikan</th><th class="r">% Kontribusi</th></tr>
      ${sortedMembers.map((m, i) => '<tr><td>'+(i+1)+'</td><td>'+m.pangkat+'</td><td class="b">'+m.name+'</td><td>'+m.nrp+'</td><td>'+m.kompi+'</td><td class="r">'+m.txCount+'</td><td class="r">'+Number(m.totalBeli).toLocaleString('id-ID')+'</td><td class="r">'+Number(Math.round(m.totalLaba)).toLocaleString('id-ID')+'</td><td class="r">'+(totalLabaSemua>0?((m.totalLaba/totalLabaSemua)*100).toFixed(1):0)+'%</td></tr>').join('')}
      <tr class="total"><td colspan="6" class="r">TOTAL</td><td class="r">${Number(totalBeliSemua).toLocaleString('id-ID')}</td><td class="r">${Number(Math.round(totalLabaSemua)).toLocaleString('id-ID')}</td><td class="r">100%</td></tr>
      </table>
      <div class="footer">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      <script>setTimeout(()=>{window.print()},500)<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Laba per Anggota (SHU)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={S.input} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button style={{ ...S.primaryBtn, background: '#2e7d32' }} onClick={cetakLaba}>Cetak Laporan</button>
        </div>
      </div>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={S.statLabel}>Total Laba dari Anggota</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{formatRp(Math.round(totalLabaSemua))}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total Belanja Anggota</div><div style={S.statVal}>{formatRp(totalBeliSemua)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Jumlah Anggota Aktif Belanja</div><div style={S.statVal}>{sortedMembers.filter(m => m.mid !== '_umum').length}</div></div>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['No', 'Pangkat', 'Nama', 'NRP', 'Kompi', 'Transaksi', 'Total Belanja', 'Laba Diberikan', '% SHU'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sortedMembers.map((m, i) => (
            <tr key={m.mid} style={S.tr}>
              <td style={S.td}>{i+1}</td>
              <td style={S.td}>{m.pangkat}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{m.nrp}</td>
              <td style={S.td}>{m.kompi}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>{m.txCount}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>{formatRp(m.totalBeli)}</td>
              <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>{formatRp(Math.round(m.totalLaba))}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>{totalLabaSemua > 0 ? ((m.totalLaba/totalLabaSemua)*100).toFixed(1) : 0}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ ...S.card, background: '#f5f6fa', fontSize: 13, color: '#6b7280' }}>
        <strong>Cara baca:</strong> "Laba Diberikan" = selisih harga jual - harga beli dari semua transaksi anggota tersebut.
        "% SHU" = kontribusi laba anggota terhadap total laba. Untuk pembagian SHU, kalikan persentase ini dengan dana SHU Jasa Anggota.
      </div>
    </div>
  )
}

const IC = {
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
}

const S = {
  title: { fontSize: 22, fontWeight: 700, marginBottom: 20 },
  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: 700 },
  card: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 14 },
  table: { width: '100%', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  tr: { transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  linkBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#1565c0', fontWeight: 600, fontSize: 12 },
  filterBtn: { padding: '5px 12px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  filterActive: { background: '#1565c0', color: '#fff', borderColor: '#1565c0' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#6b7280' },
  input: { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' },
}
