// =============================================
// MODUL LAPORAN LANJUTAN (PRIORITAS 3)
// Export, Rekap Bulanan, Grafik Trend, Audit Trail
// =============================================
import { useState, useEffect, useRef } from 'react'
import { cetakLaporanPDF } from './Extra'

function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { return new Date().toISOString().slice(0, 10) }
function monthName(m) { return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m] }
function monthFull(m) { return ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][m] }

const IC = {
  download: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  print: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
}

// =============================================
// IMPORT & EXPORT DATA
// =============================================
export function ExportData({ members, savings, loans, products, transactions, kasData, settings, saveImportedMembers, saveImportedProducts, showToast }) {
  const [tab, setTab] = useState('import')
  const [preview, setPreview] = useState(null)
  const [importType, setImportType] = useState('members')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [exporting, setExporting] = useState(null)
  const fileRef = useRef()

  function exportCSV(filename, headers, rows) {
    const BOM = '\uFEFF'
    const csv = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const exports = [
    { id: 'members', label: 'Data Anggota', desc: 'No, Nama, Telepon, Alamat, Status', run: () => exportCSV('anggota.csv', ['No','Nama','Telepon','Alamat','Tgl Gabung','Status'], members.map(m => [m.no, m.name, m.phone, m.address, m.joinDate, m.status])) },
    { id: 'products', label: 'Stok Barang', desc: 'SKU, Nama, Harga Beli/Jual, Stok', run: () => exportCSV('stok_barang.csv', ['SKU','Nama','Kategori','Harga Beli','Harga Jual 1','Harga Jual 2','Stok','Satuan','Min Stok'], products.map(p => [p.sku, p.name, p.category, p.buyPrice, p.sellPrice, p.sellPrice2||'', p.stock, p.unit, p.minStock])) },
    { id: 'kas', label: 'Data Kas', desc: 'Kas masuk & keluar', run: () => exportCSV('kas.csv', ['Tanggal','Tipe','Kategori','Jumlah','Keterangan'], kasData.map(k => [k.date, k.type, k.category, k.amount, k.note])) },
  ]

  async function loadSheetJS() {
    if (window.XLSX) return window.XLSX
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
      s.onload = () => resolve(window.XLSX)
      s.onerror = () => reject(new Error('Gagal memuat SheetJS'))
      document.head.appendChild(s)
    })
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setPreview(null)
    try {
      const XLSX = await loadSheetJS()
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (json.length === 0) { setImporting(false); return }
      setPreview({ headers: Object.keys(json[0]), rows: json, filename: file.name, count: json.length })
    } catch (err) { console.error(err) }
    setImporting(false)
  }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

  async function doImport() {
    if (!preview) return
    const rows = preview.rows
    let items = []
    setImporting(true)
    setImportProgress('Mempersiapkan data...')

    const onProgress = (done, total) => {
      setImportProgress(`Menyimpan ke database... ${done}/${total} (${Math.round(done/total*100)}%)`)
    }

    try {
      if (importType === 'members') {
        items = rows.map((r, i) => ({
          id: genId(), no: String(r['No']||r['no']||r['NO']||i+1).padStart(3,'0'),
          name: r['Nama']||r['nama']||r['NAMA']||r['Name']||'',
          phone: String(r['Telepon']||r['telepon']||r['Phone']||r['HP']||''),
          address: r['Alamat']||r['alamat']||r['Address']||'',
          joinDate: r['Tgl Gabung']||r['tanggal']||today(), status: 'active'
        })).filter(m => m.name)

        setImportProgress('Menyimpan ' + items.length + ' anggota ke database...')
        if (saveImportedMembers) await saveImportedMembers(items, onProgress)

      } else if (importType === 'products') {
        items = rows.map((r, i) => ({
          id: genId(), sku: r['SKU']||r['sku']||r['Kode']||r['KodeBrg']||('BRG-'+String(i+1).padStart(3,'0')),
          name: r['Nama']||r['nama']||r['Produk']||r['NamaBrg']||'',
          category: r['Kategori']||r['kategori']||r['Rak']||r['Jenis']||'Lainnya',
          buyPrice: Number(r['Harga Beli']||r['harga_beli']||r['Hpp']||r['buyPrice']||0),
          sellPrice: Number(r['Harga Jual']||r['harga_jual']||r['Harga1']||r['sellPrice']||0),
          sellPrice2: Number(r['Harga Jual 2']||r['harga_jual_2']||r['Harga2']||r['sellPrice2']||0),
          stock: Number(r['Stok']||r['stok']||r['Stock']||r['JmlStock']||r['stock']||0),
          unit: r['Satuan']||r['satuan']||r['Unit']||r['Sat']||r['unit']||'pcs',
          minStock: Number(r['Min Stok']||r['min_stok']||r['minStock']||2), supplierId: ''
        })).filter(p => p.name)

        setImportProgress('Menyimpan ' + items.length + ' produk ke database...')
        if (saveImportedProducts) await saveImportedProducts(items, onProgress)
      }

      setImportProgress('')
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      if (showToast) showToast('Import berhasil: ' + items.length + ' data tersimpan ke database')
    } catch (err) {
      console.error('Import error:', err)
      setImportProgress('Error: ' + err.message)
      if (showToast) showToast('Import gagal: ' + err.message, 'error')
    }
    setImporting(false)
    return items.length
  }

  const importTemplates = [
    { type: 'members', l: 'Anggota', cols: 'No, Nama, Telepon, Alamat, Tgl Gabung' },
    { type: 'products', l: 'Produk / Barang', cols: 'SKU, Nama, Kategori, Harga Beli, Harga Jual, Stok, Satuan, Min Stok' },
  ]

  return (
    <div>
      <h2 style={S.title}>Import & Export Data</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button style={{ ...S.filterBtn, ...(tab === 'import' ? S.filterActive : {}) }} onClick={() => setTab('import')}>Import Excel</button>
        <button style={{ ...S.filterBtn, ...(tab === 'export' ? S.filterActive : {}) }} onClick={() => setTab('export')}>Export CSV</button>
      </div>

      {tab === 'import' ? (
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 12 }}>Import dari Excel / CSV</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Upload file <b>.xlsx</b>, <b>.xls</b>, atau <b>.csv</b></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <label style={S.formLabel}>Tipe Data
              <select style={S.input} value={importType} onChange={e => setImportType(e.target.value)}>
                {importTemplates.map(t => <option key={t.type} value={t.type}>{t.l}</option>)}
              </select>
            </label>
            <label style={S.formLabel}>Pilih File
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ ...S.input, padding: 8, fontSize: 13 }} />
            </label>
          </div>
          <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 6 }}>Format kolom: {importTemplates.find(t => t.type === importType)?.l}</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{importTemplates.find(t => t.type === importType)?.cols}</div>
          </div>
          {importing && <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>{importProgress || 'Membaca file...'}</div>}
          {preview && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Preview: {preview.filename} ({preview.count} baris)</span>
                <button style={S.primaryBtn} onClick={doImport}>Import {preview.count} Data</button>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 300, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <table style={{ ...S.table, fontSize: 12 }}>
                  <thead><tr>{preview.headers.map(h => <th key={h} style={{ ...S.th, fontSize: 10, padding: '6px 8px' }}>{h}</th>)}</tr></thead>
                  <tbody>{preview.rows.slice(0, 15).map((r, i) => <tr key={i}>{preview.headers.map(h => <td key={h} style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontSize: 12 }}>{String(r[h] || '')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {exports.map(e => (
            <div key={e.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              onClick={() => { setExporting(e.id); e.run(); setTimeout(() => setExporting(null), 1000) }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e3f2fd', color: '#1565c0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{IC.download}</div>
              <div><div style={{ fontWeight: 600, fontSize: 14 }}>{e.label}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{e.desc}</div></div>
              {exporting === e.id && <span style={{ color: '#2e7d32', fontWeight: 600 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================
// REKAP BULANAN
// =============================================
export function RekapBulanan({ members, savings, loans, transactions, kasData, products, settings }) {
  const [period, setPeriod] = useState(today().slice(0, 7))
  const [y, m] = period.split('-').map(Number)

  const monthSavings = savings.filter(s => s.date.startsWith(period))
  const monthTx = transactions.filter(t => t.date.startsWith(period))
  const monthKas = kasData.filter(k => k.date.startsWith(period))
  const monthInstallments = loans.flatMap(l => (l.installments||[]).filter(i => i.date.startsWith(period)))

  const totalSimpananMasuk = monthSavings.filter(s => (s.amount||0) > 0).reduce((a, s) => a + (s.amount||0), 0)
  const totalSimpananKeluar = monthSavings.filter(s => (s.amount||0) < 0).reduce((a, s) => a + Math.abs(s.amount||0), 0)
  const totalPenjualan = monthTx.reduce((a, t) => a + (t.total||0), 0)
  const totalAngsuran = monthInstallments.reduce((a, i) => a + (i.amount||0), 0)
  const totalAngsuranPokok = monthInstallments.reduce((a, i) => a + (i.principal||0), 0)
  const totalAngsuranBunga = monthInstallments.reduce((a, i) => a + (i.interest||0), 0)
  const kasMasuk = monthKas.filter(k => k.type === 'masuk').reduce((a, k) => a + (k.amount||0), 0)
  const kasKeluar = monthKas.filter(k => k.type === 'keluar').reduce((a, k) => a + (k.amount||0), 0)
  const newMembers = members.filter(m => m.joinDate.startsWith(period)).length
  const activeLoanCount = loans.filter(l => l.status === 'active').length

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Rekap Bulanan</h2>
        <input type="month" style={{ ...S.input, maxWidth: 180, padding: '8px 12px' }} value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{settings.name}</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Rekap Bulan {monthFull(m - 1)} {y}</div>
      </div>

      <div style={S.grid4}>
        <div style={S.statCard}><div style={S.statLabel}>Anggota Baru</div><div style={S.statVal}>{newMembers}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Penjualan Toko</div><div style={{ ...S.statVal, color: 'var(--b)' }}>{formatRp(totalPenjualan)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Angsuran Diterima</div><div style={{ ...S.statVal, color: 'var(--g)' }}>{formatRp(totalAngsuran)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Pinjaman Aktif</div><div style={{ ...S.statVal, color: 'var(--o)' }}>{activeLoanCount}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Simpanan</h3>
          <table style={S.table}>
            <tbody>
              <tr style={S.tr}><td style={S.td}>Simpanan Masuk</td><td style={{ ...S.td, textAlign: 'right', color: 'var(--g)', fontWeight: 600 }}>+ {formatRp(totalSimpananMasuk)}</td></tr>
              <tr style={S.tr}><td style={S.td}>Penarikan</td><td style={{ ...S.td, textAlign: 'right', color: 'var(--r)', fontWeight: 600 }}>- {formatRp(totalSimpananKeluar)}</td></tr>
              <tr style={{ background: '#f5f6fa' }}><td style={{ ...S.td, fontWeight: 700 }}>Neto</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(totalSimpananMasuk - totalSimpananKeluar)}</td></tr>
              <tr style={S.tr}><td style={{ ...S.td, fontSize: 12, color: '#999' }} colSpan={2}>{monthSavings.length} transaksi</td></tr>
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Pinjaman & Angsuran</h3>
          <table style={S.table}>
            <tbody>
              <tr style={S.tr}><td style={S.td}>Angsuran Pokok</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{formatRp(totalAngsuranPokok)}</td></tr>
              <tr style={S.tr}><td style={S.td}>Pendapatan Bunga</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--g)' }}>{formatRp(totalAngsuranBunga)}</td></tr>
              <tr style={{ background: '#f5f6fa' }}><td style={{ ...S.td, fontWeight: 700 }}>Total Angsuran</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(totalAngsuran)}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Kas</h3>
          <table style={S.table}>
            <tbody>
              <tr style={S.tr}><td style={S.td}>Kas Masuk</td><td style={{ ...S.td, textAlign: 'right', color: 'var(--g)', fontWeight: 600 }}>+ {formatRp(kasMasuk)}</td></tr>
              <tr style={S.tr}><td style={S.td}>Kas Keluar</td><td style={{ ...S.td, textAlign: 'right', color: 'var(--r)', fontWeight: 600 }}>- {formatRp(kasKeluar)}</td></tr>
              <tr style={{ background: '#f5f6fa' }}><td style={{ ...S.td, fontWeight: 700 }}>Saldo</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(kasMasuk - kasKeluar)}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Penjualan Toko</h3>
          <table style={S.table}>
            <tbody>
              <tr style={S.tr}><td style={S.td}>Jumlah Transaksi</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{monthTx.length}</td></tr>
              <tr style={S.tr}><td style={S.td}>Total Penjualan</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--b)' }}>{formatRp(totalPenjualan)}</td></tr>
              <tr style={S.tr}><td style={S.td}>Rata-rata/Transaksi</td><td style={{ ...S.td, textAlign: 'right' }}>{formatRp(monthTx.length > 0 ? Math.round(totalPenjualan / monthTx.length) : 0)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <button style={{ ...S.primaryBtn, marginTop: 16, justifyContent: 'center', width: '100%' }} onClick={() => {
        cetakLaporanPDF('Rekap Bulanan - ' + monthFull(m - 1) + ' ' + y,
          ['Keterangan', 'Jumlah'],
          [
            ['Simpanan Masuk', formatRp(totalSimpananMasuk)],
            ['Penarikan Simpanan', '- ' + formatRp(totalSimpananKeluar)],
            ['Neto Simpanan', formatRp(totalSimpananMasuk - totalSimpananKeluar)],
            ['', ''],
            ['Angsuran Pokok', formatRp(totalAngsuranPokok)],
            ['Pendapatan Bunga', formatRp(totalAngsuranBunga)],
            ['Total Angsuran', formatRp(totalAngsuran)],
            ['', ''],
            ['Kas Masuk', formatRp(kasMasuk)],
            ['Kas Keluar', '- ' + formatRp(kasKeluar)],
            ['Saldo Kas', formatRp(kasMasuk - kasKeluar)],
            ['', ''],
            ['Jumlah Transaksi Toko', monthTx.length],
            ['Total Penjualan', formatRp(totalPenjualan)],
            ['Anggota Baru', newMembers],
            ['Pinjaman Aktif', activeLoanCount],
          ], settings,
          'Total Pemasukan: ' + formatRp(totalSimpananMasuk + totalAngsuran + kasMasuk + totalPenjualan) +
          ' | Total Pengeluaran: ' + formatRp(totalSimpananKeluar + kasKeluar)
        )
      }}>{IC.print} Cetak Rekap (PDF)</button>
    </div>
  )
}

// =============================================
// GRAFIK TREND KEUANGAN (Pure CSS/SVG)
// =============================================
export function GrafikTrend({ savings, loans, transactions, kasData, products }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const months = Array.from({ length: 12 }, (_, i) => i)
  const yearStr = String(year)

  // Hitung data per bulan
  const monthlyData = months.map(m => {
    const mm = String(m + 1).padStart(2, '0')
    const prefix = `${yearStr}-${mm}`
    const simpanan = savings.filter(s => s.date.startsWith(prefix) && (s.amount||0) > 0).reduce((a, s) => a + (s.amount||0), 0)
    const penjualan = transactions.filter(t => t.date.startsWith(prefix)).reduce((a, t) => a + (t.total||0), 0)
    const angsuran = loans.flatMap(l => (l.installments||[]).filter(i => i.date.startsWith(prefix))).reduce((a, i) => a + (i.amount||0), 0)
    const kasM = kasData.filter(k => k.date.startsWith(prefix) && k.type === 'masuk').reduce((a, k) => a + (k.amount||0), 0)
    const kasK = kasData.filter(k => k.date.startsWith(prefix) && k.type === 'keluar').reduce((a, k) => a + (k.amount||0), 0)
    const hpp = transactions.filter(t => t.date.startsWith(prefix)).reduce((a, t) =>
      a + (t.items||[]).reduce((s, it) => { const p = products.find(pr => pr.id === it.productId); return s + ((p?.buyPrice || 0) * (it.qty||0)) }, 0), 0)
    return { month: m, simpanan, penjualan, angsuran, kasMasuk: kasM, kasKeluar: kasK, laba: penjualan - hpp + angsuran - kasK }
  })

  const datasets = [
    { key: 'simpanan', label: 'Simpanan', color: '#2e7d32' },
    { key: 'penjualan', label: 'Penjualan', color: '#1565c0' },
    { key: 'angsuran', label: 'Angsuran', color: '#6a1b9a' },
    { key: 'laba', label: 'Laba Bersih', color: '#e65100' },
  ]

  const [active, setActive] = useState(['simpanan', 'penjualan', 'laba'])

  const maxVal = Math.max(1, ...monthlyData.flatMap(d => active.map(k => Math.abs(d[k]))))
  const chartH = 260
  const chartW = 600
  const barW = 38
  const gap = (chartW - 12 * barW) / 13

  function toggleDataset(key) {
    setActive(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Grafik Trend Keuangan</h2>
        <select style={{ ...S.input, width: 100, padding: '6px 10px' }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {datasets.map(ds => (
          <label key={ds.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, opacity: active.includes(ds.key) ? 1 : 0.4, transition: 'opacity 0.15s' }}
            onClick={() => toggleDataset(ds.key)}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: ds.color }} />
            {ds.label}
          </label>
        ))}
      </div>

      {/* Bar Chart SVG */}
      <div style={S.card}>
        <svg viewBox={`0 0 ${chartW + 40} ${chartH + 50}`} style={{ width: '100%', maxHeight: 350 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = chartH - pct * chartH + 20
            return <g key={i}>
              <line x1="40" y1={y} x2={chartW + 20} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x="36" y={y + 4} textAnchor="end" fontSize="10" fill="#999">{formatRp(Math.round(maxVal * pct)).replace('Rp ', '')}</text>
            </g>
          })}

          {/* Bars */}
          {monthlyData.map((d, mi) => {
            const x = 40 + gap + mi * (barW + gap)
            const activeDs = datasets.filter(ds => active.includes(ds.key))
            const bw = activeDs.length > 0 ? barW / activeDs.length : barW

            return <g key={mi}>
              {activeDs.map((ds, di) => {
                const val = d[ds.key]
                const h = Math.abs(val) / maxVal * chartH
                const bx = x + di * bw
                const by = val >= 0 ? chartH - h + 20 : chartH + 20
                return <g key={ds.key}>
                  <rect x={bx} y={by} width={bw - 1} height={Math.max(h, 1)} fill={ds.color} rx="2" opacity="0.8">
                    <title>{ds.label}: {formatRp(val)}</title>
                  </rect>
                </g>
              })}
              <text x={x + barW / 2} y={chartH + 38} textAnchor="middle" fontSize="11" fill="#666">{monthName(mi)}</text>
            </g>
          })}
        </svg>
      </div>

      {/* Data Table */}
      <div style={S.card}>
        <h3 style={{ ...S.cardTitle, marginBottom: 12 }}>Data Bulanan {year}</h3>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Bulan</th>
            {datasets.map(ds => <th key={ds.key} style={{ ...S.th, color: ds.color }}>{ds.label}</th>)}
          </tr></thead>
          <tbody>
            {monthlyData.map((d, i) => (
              <tr key={i} style={S.tr}>
                <td style={{ ...S.td, fontWeight: 600 }}>{monthFull(i)}</td>
                {datasets.map(ds => (
                  <td key={ds.key} style={{ ...S.td, color: d[ds.key] < 0 ? 'var(--r)' : undefined }}>{formatRp(d[ds.key])}</td>
                ))}
              </tr>
            ))}
            <tr style={{ background: '#f5f6fa' }}>
              <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
              {datasets.map(ds => (
                <td key={ds.key} style={{ ...S.td, fontWeight: 700, color: ds.color }}>{formatRp(monthlyData.reduce((a, d) => a + (d[ds.key]||0), 0))}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================
// AUDIT TRAIL / LOG AKTIVITAS
// =============================================
export function AuditTrail({ auditLogs, members, getMember }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  let filtered = auditLogs
  if (filter !== 'all') filtered = filtered.filter(l => l.module === filter)
  if (search) filtered = filtered.filter(l => l.detail.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase()))
  const sorted = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200)

  const modules = [...new Set(auditLogs.map(l => l.module))].sort()

  return (
    <div>
      <h2 style={S.title}>Audit Trail / Log Aktivitas</h2>

      <div style={S.grid4}>
        <div style={S.statCard}><div style={S.statLabel}>Total Log</div><div style={S.statVal}>{auditLogs.length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Hari Ini</div><div style={{ ...S.statVal, color: 'var(--b)' }}>{auditLogs.filter(l => l.timestamp.startsWith(today())).length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>User Aktif</div><div style={{ ...S.statVal, color: 'var(--g)' }}>{new Set(auditLogs.map(l => l.user)).size}</div></div>
      </div>

      <div style={S.toolbar}>
        <div style={{ ...S.searchBox, maxWidth: 280 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input style={S.searchInput} placeholder="Cari aktivitas..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={S.filterGroup}>
          <button style={{ ...S.filterBtn, ...(filter === 'all' ? S.filterActive : {}) }} onClick={() => setFilter('all')}>Semua</button>
          {modules.map(m => (
            <button key={m} style={{ ...S.filterBtn, ...(filter === m ? S.filterActive : {}) }} onClick={() => setFilter(m)}>{m}</button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        {sorted.length === 0 ? <p style={S.empty}>Belum ada log aktivitas</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sorted.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: actionColor(l.action) }} />
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{l.user}</span>
                    <span style={{ color: '#6b7280' }}> — {l.detail}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    <span style={{ ...S.badge, background: moduleBg(l.module), color: moduleFg(l.module), fontSize: 10 }}>{l.module}</span>
                    {' '}{fmtDateTime(l.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function actionColor(action) {
  if (action === 'create') return '#2e7d32'
  if (action === 'update') return '#1565c0'
  if (action === 'delete') return '#c62828'
  if (action === 'login') return '#6a1b9a'
  return '#999'
}

function moduleBg(mod) {
  const map = { Anggota: '#e3f2fd', Simpanan: '#e8f5e9', Pinjaman: '#fff3e0', Produk: '#f3e5f5', Kas: '#fce4ec', Penjualan: '#e0f2f1', Auth: '#f5f5f5' }
  return map[mod] || '#f5f5f5'
}
function moduleFg(mod) {
  const map = { Anggota: '#1565c0', Simpanan: '#2e7d32', Pinjaman: '#e65100', Produk: '#7b1fa2', Kas: '#c62828', Penjualan: '#00695c', Auth: '#616161' }
  return map[mod] || '#616161'
}

function fmtDateTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// =============================================
// AUDIT LOGGER HELPER (digunakan di App.jsx)
// =============================================
export function createAuditLog(user, module, action, detail) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    user: user?.name || 'System',
    userId: user?.id || '',
    module,
    action,
    detail,
  }
}

// =============================================
// SHARED STYLES
// =============================================
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
  input: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' },
  empty: { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },
}
