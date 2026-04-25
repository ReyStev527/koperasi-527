// =============================================
// MODUL LAPORAN LANJUTAN (PRIORITAS 3)
// Export, Rekap Bulanan, Grafik Trend, Audit Trail
// =============================================
import { useState, useEffect, useRef } from 'react'
import { cetakLaporanPDF } from './Extra'

function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { 
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function toLocalDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

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
      const ext = file.name.split('.').pop().toLowerCase()

      // Parse XML file
      if (ext === 'xml') {
        const text = await file.text()
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(text, 'text/xml')
        const parseError = xmlDoc.querySelector('parsererror')
        if (parseError) { showToast('Format XML tidak valid', 'error'); setImporting(false); return }

        let json = []

        // Deteksi format Crystal Reports (FormattedReport / FormattedReportObject)
        const isCrystalReport = xmlDoc.querySelector('FormattedReport') ||
          xmlDoc.getElementsByTagNameNS('urn:crystal-reports:schemas', 'FormattedReport').length > 0

        if (isCrystalReport) {
          // Parse Crystal Reports XML
          // Ambil semua FormattedAreaPair yang tipe Details
          const allAreas = xmlDoc.querySelectorAll('FormattedAreaPair[Type="Details"]') ||
            xmlDoc.getElementsByTagName('FormattedAreaPair')
          
          for (let i = 0; i < allAreas.length; i++) {
            const area = allAreas[i]
            if (area.getAttribute('Type') !== 'Details') continue
            const fields = area.getElementsByTagName('FormattedReportObject')
            if (fields.length === 0) continue

            const row = {}
            for (let j = 0; j < fields.length; j++) {
              const field = fields[j]
              let fieldName = field.getAttribute('FieldName') || ''
              // Extract field name: {Barang.NamaBrg} → NamaBrg
              const match = fieldName.match(/\{.*?\.(\w+)\}/)
              const key = match ? match[1] : field.querySelector('ObjectName')?.textContent || ('field_' + j)
              // Ambil <Value> (bukan <FormattedValue>)
              const valEl = field.querySelector('Value')
              row[key] = valEl ? valEl.textContent.trim() : ''
            }
            if (Object.keys(row).length > 0) json.push(row)
          }
        } else {
          // Parse XML biasa: <root><item><field>value</field></item></root>
          const root = xmlDoc.documentElement
          const items = root.children
          for (let i = 0; i < items.length; i++) {
            const row = {}
            const children = items[i].children
            for (let j = 0; j < children.length; j++) {
              row[children[j].tagName] = children[j].textContent || ''
            }
            if (Object.keys(row).length > 0) json.push(row)
          }
        }

        if (json.length === 0) { showToast('Tidak ada data ditemukan di file XML', 'error'); setImporting(false); return }
        setPreview({ headers: Object.keys(json[0]), rows: json, filename: file.name, count: json.length })

      } else {
        // Parse XLSX / XLS / CSV via SheetJS
        const XLSX = await loadSheetJS()
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (json.length === 0) { setImporting(false); return }
        setPreview({ headers: Object.keys(json[0]), rows: json, filename: file.name, count: json.length })
      }
    } catch (err) { console.error(err); showToast('Gagal membaca file: ' + err.message, 'error') }
    setImporting(false)
  }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

  const [clearBefore, setClearBefore] = useState(false)

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
          name: r['Nama']||r['nama']||r['NAMA']||r['Name']||r['NamaPlg']||'',
          nrp: String(r['NRP']||r['nrp']||r['Nrp']||''),
          kompi: String(r['Kompi']||r['kompi']||r['KOMPI']||r['Satuan']||''),
          phone: String(r['Telepon']||r['telepon']||r['Phone']||r['HP']||''),
          address: r['Alamat']||r['alamat']||r['Address']||'',
          joinDate: r['Tgl Gabung']||r['tanggal']||today(), status: 'active'
        })).filter(m => m.name)

        setImportProgress('Menyimpan ' + items.length + ' anggota ke database...')
        const saved = await saveImportedMembers(items, onProgress)
        setImportProgress(`✅ Berhasil: ${saved} anggota tersimpan ke Firestore`)

      } else if (importType === 'products') {
        items = rows.map((r, i) => ({
          id: genId(), sku: String(r['SKU']||r['sku']||r['Kode']||r['KodeBrg']||('BRG-'+String(i+1).padStart(3,'0'))),
          name: String(r['Nama']||r['nama']||r['Produk']||r['NamaBrg']||''),
          category: String(r['Kategori']||r['kategori']||r['Jenis']||'Lainnya'),
          rak: String(r['Rak']||r['rak']||r['Lokasi']||''),
          buyPrice: Number(r['Harga Beli']||r['harga_beli']||r['Hpp']||r['buyPrice']||0),
          sellPrice: Number(r['Harga Jual']||r['harga_jual']||r['Harga1']||r['sellPrice']||0),
          sellPrice2: Number(r['Harga Jual 2']||r['harga_jual_2']||r['Harga2']||r['sellPrice2']||0),
          limitQty: Number(r['Limit Qty']||r['limitQty']||r['Limit2']||0),
          stock: Number(r['Stok']||r['stok']||r['Stock']||r['JmlStock']||r['stock']||0),
          unit: String(r['Satuan']||r['satuan']||r['Unit']||r['Sat']||r['unit']||'pcs'),
          minStock: Number(r['Min Stok']||r['min_stok']||r['minStock']||2), supplierId: ''
        })).filter(p => p.name)

        setImportProgress('Menyimpan ' + items.length + ' produk ke database...')
        const saved = await saveImportedProducts(items, onProgress)
        setImportProgress(`✅ Berhasil: ${saved} produk tersimpan ke Firestore`)
      }

      // Tandai seed sudah dijalankan agar tidak menimpa data import
      localStorage.setItem('koperasi_seeded', 'true')

      setTimeout(() => {
        setImportProgress('')
        setPreview(null)
        if (fileRef.current) fileRef.current.value = ''
      }, 2000)
      if (showToast) showToast('Import berhasil: ' + items.length + ' data tersimpan ke Firestore! Data aman saat refresh.')
    } catch (err) {
      console.error('Import error:', err)
      setImportProgress('❌ GAGAL: ' + err.message)
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
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Upload file <b>.xlsx</b>, <b>.xls</b>, <b>.csv</b>, atau <b>.xml</b></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <label style={S.formLabel}>Tipe Data
              <select style={S.input} value={importType} onChange={e => setImportType(e.target.value)}>
                {importTemplates.map(t => <option key={t.type} value={t.type}>{t.l}</option>)}
              </select>
            </label>
            <label style={S.formLabel}>Pilih File
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.xml" onChange={handleFile} style={{ ...S.input, padding: 8, fontSize: 13 }} />
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
// LAPORAN PENJUALAN (match Kartika VB6)
// =============================================
export function LaporanPenjualan({ transactions, products, members, suppliers, settings, stockIn, returs }) {
  const [tgl1, setTgl1] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toLocalDate(d) })
  const [tgl2, setTgl2] = useState(today())
  const [tab, setTab] = useState('detail')
  const [filterKompi, setFilterKompi] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all') // all | LUNAS | KREDIT
  const [filterPlg, setFilterPlg] = useState('') // memberId filter

  // Filter transaksi berdasarkan periode
  const txFiltered = transactions.filter(t => {
    if (t.date < tgl1 || t.date > tgl2) return false
    if (filterStatus !== 'all' && (t.caraBayar||'LUNAS') !== filterStatus) return false
    if (filterPlg && t.memberId !== filterPlg) return false
    return true
  }).sort((a, b) => (b.date||'').localeCompare(a.date||''))

  // Lookup helpers
  const getMember = (id) => members.find(m => m.id === id)
  const getProduct = (id) => products.find(p => p.id === id)

  // Kompi list dari members
  const allKompi = [...new Set(members.map(m => m.kompi).filter(Boolean))].sort()

  // === REKAP PER PELANGGAN ===
  function rekapPerPelanggan() {
    const map = {}
    txFiltered.forEach(tx => {
      const key = tx.memberId || '_umum'
      if (!map[key]) {
        const m = getMember(tx.memberId)
        map[key] = { name: m?.name || tx.customerName || 'PELANGGAN UMUM', nrp: m?.nrp || '-', kompi: m?.kompi || '-', totalJual: 0, totalHpp: 0 }
      }
      map[key].totalJual += tx.total || 0
      ;(tx.items||[]).forEach(it => {
        const prod = getProduct(it.productId)
        map[key].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).sort((a, b) => b.totalJual - a.totalJual)
  }

  // === REKAP PER BARANG ===
  function rekapPerBarang() {
    const map = {}
    txFiltered.forEach(tx => {
      ;(tx.items||[]).forEach(it => {
        const key = it.productId || it.name
        if (!map[key]) {
          const prod = getProduct(it.productId)
          map[key] = { name: it.name, sku: prod?.sku || '-', category: prod?.category || '-', qty: 0, totalJual: 0, totalHpp: 0 }
        }
        map[key].qty += it.qty || 0
        map[key].totalJual += it.subtotal || (it.price * it.qty) || 0
        const prod = getProduct(it.productId)
        map[key].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).sort((a, b) => b.totalJual - a.totalJual)
  }

  // === REKAP PER JENIS ===
  function rekapPerJenis() {
    const map = {}
    txFiltered.forEach(tx => {
      ;(tx.items||[]).forEach(it => {
        const prod = getProduct(it.productId)
        const cat = prod?.category || 'Lainnya'
        if (!map[cat]) map[cat] = { category: cat, qty: 0, totalJual: 0, totalHpp: 0 }
        map[cat].qty += it.qty || 0
        map[cat].totalJual += it.subtotal || (it.price * it.qty) || 0
        map[cat].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).sort((a, b) => b.totalJual - a.totalJual)
  }

  // === REKAP PER TANGGAL ===
  function rekapPerTanggal() {
    const map = {}
    txFiltered.forEach(tx => {
      const d = tx.date
      if (!map[d]) map[d] = { date: d, count: 0, totalJual: 0, totalHpp: 0, kredit: 0, tunai: 0 }
      map[d].count++
      map[d].totalJual += tx.total || 0
      if (tx.caraBayar === 'KREDIT') map[d].kredit += tx.total || 0
      else map[d].tunai += tx.total || 0
      ;(tx.items||[]).forEach(it => {
        const prod = getProduct(it.productId)
        map[d].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }

  // === REKAP PER KOMPI ===
  function rekapPerKompi() {
    const map = {}
    txFiltered.forEach(tx => {
      const m = getMember(tx.memberId)
      const kompi = m?.kompi || 'UMUM'
      if (!map[kompi]) map[kompi] = { kompi, count: 0, totalJual: 0, totalHpp: 0, kredit: 0, tunai: 0, members: new Set() }
      map[kompi].count++
      map[kompi].totalJual += tx.total || 0
      if (tx.caraBayar === 'KREDIT') map[kompi].kredit += tx.total || 0
      else map[kompi].tunai += tx.total || 0
      if (tx.memberId) map[kompi].members.add(tx.memberId)
      ;(tx.items||[]).forEach(it => {
        const prod = getProduct(it.productId)
        map[kompi].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).map(r => ({ ...r, memberCount: r.members.size })).sort((a, b) => b.totalJual - a.totalJual)
  }

  // === REKAP ASET BARANG ===
  function rekapAset() {
    const cats = {}
    products.forEach(p => {
      const cat = p.category || 'Lainnya'
      if (!cats[cat]) cats[cat] = { category: cat, count: 0, totalStock: 0, totalNilai: 0, totalJual: 0 }
      cats[cat].count++
      cats[cat].totalStock += p.stock || 0
      cats[cat].totalNilai += (p.stock || 0) * (p.buyPrice || 0)
      cats[cat].totalJual += (p.stock || 0) * (p.sellPrice || 0)
    })
    return Object.values(cats).sort((a, b) => b.totalNilai - a.totalNilai)
  }

  // === REKAP PER SUPPLIER (Penjualan) ===
  function rekapPerSupplier() {
    const map = {}
    txFiltered.forEach(tx => {
      ;(tx.items||[]).forEach(it => {
        const prod = getProduct(it.productId)
        const sup = prod?.supplierId ? suppliers.find(s => s.id === prod.supplierId) : null
        const key = sup?.id || '_none'
        if (!map[key]) map[key] = { name: sup?.name || 'Tanpa Supplier', qty: 0, totalJual: 0, totalHpp: 0 }
        map[key].qty += it.qty || 0
        map[key].totalJual += it.subtotal || (it.price * it.qty) || 0
        map[key].totalHpp += (prod?.buyPrice || 0) * (it.qty || 0)
      })
    })
    return Object.values(map).sort((a, b) => b.totalJual - a.totalJual)
  }

  // === REKAP BARANG MASUK ===
  function rekapBarangMasuk() {
    return (stockIn||[]).filter(s => s.date >= tgl1 && s.date <= tgl2).sort((a, b) => (b.date||'').localeCompare(a.date||''))
  }

  // === LAPORAN RETUR ===
  function laporanRetur() {
    return (returs||[]).filter(r => (r.date||'') >= tgl1 && (r.date||'') <= tgl2).sort((a, b) => (b.date||'').localeCompare(a.date||''))
  }

  // Grand totals
  const grandJual = txFiltered.reduce((a, t) => a + (t.total||0), 0)
  const grandHpp = txFiltered.reduce((a, t) => a + (t.items||[]).reduce((b, it) => b + ((getProduct(it.productId)?.buyPrice||0) * (it.qty||0)), 0), 0)
  const grandLaba = grandJual - grandHpp
  const totalKredit = txFiltered.filter(t => t.caraBayar === 'KREDIT').reduce((a, t) => a + (t.total||0), 0)
  const totalTunai = grandJual - totalKredit

  const tabs = [
    ['detail', 'Detail Penjualan'], ['pelanggan', 'Per Pelanggan'], ['barang', 'Per Barang'],
    ['jenis', 'Per Jenis'], ['supplier', 'Per Supplier'], ['tanggal', 'Per Tanggal'], ['kompi', 'Per Kompi'],
    ['kredit', 'Kredit'], ['tunai', 'Tunai'], ['potongan', 'Rekap Potongan'],
    ['masuk', 'Barang Masuk'], ['retur', 'Laporan Retur'], ['aset', 'Aset Barang']
  ]

  function handlePrint() {
    const title = tabs.find(t => t[0] === tab)?.[1] || 'Laporan'
    const periode = `Periode: ${fmtDate(tgl1)} s/d ${fmtDate(tgl2)}`
    let headers = [], rows = [], summary = ''

    if (tab === 'pelanggan') {
      const data = rekapPerPelanggan()
      headers = ['No', 'Nama Pelanggan', 'NRP', 'Total Hrg Jual', 'Total HPP', 'Total Laba']
      rows = data.map((r, i) => [i+1, r.name, r.nrp, formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: Jual ${formatRp(grandJual)} | HPP ${formatRp(grandHpp)} | Laba ${formatRp(grandLaba)}`
    } else if (tab === 'barang') {
      const data = rekapPerBarang()
      headers = ['No', 'SKU', 'Nama Barang', 'Qty', 'Total Jual', 'Total HPP', 'Laba']
      rows = data.map((r, i) => [i+1, r.sku, r.name, r.qty, formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: Jual ${formatRp(grandJual)} | Laba ${formatRp(grandLaba)}`
    } else if (tab === 'kompi') {
      const data = rekapPerKompi()
      headers = ['No', 'Kompi', 'Jml Anggota', 'Nota', 'Tunai', 'Kredit', 'Total', 'HPP', 'Laba']
      rows = data.map((r, i) => [i+1, r.kompi, r.memberCount, r.count, formatRp(r.tunai), formatRp(r.kredit), formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: ${formatRp(grandJual)}`
    } else if (tab === 'potongan') {
      const kreditTx = txFiltered.filter(t => t.caraBayar === 'KREDIT')
      const plgMap = {}
      kreditTx.forEach(tx => {
        const m = getMember(tx.memberId)
        const key = tx.memberId || '_umum'
        if (!plgMap[key]) plgMap[key] = { name: m?.name || tx.customerName || 'Umum', nrp: m?.nrp || '-', kompi: m?.kompi || '-', total: 0, count: 0 }
        plgMap[key].total += tx.total || 0; plgMap[key].count++
      })
      const data = Object.values(plgMap).sort((a, b) => a.kompi.localeCompare(b.kompi) || b.total - a.total)
      headers = ['No', 'Nama', 'NRP', 'Kompi', 'Jml Nota', 'Total Potongan']
      rows = data.map((r, i) => [i+1, r.name, r.nrp, r.kompi, r.count, formatRp(r.total)])
      summary = `Grand Total Potongan: ${formatRp(kreditTx.reduce((a,t) => a+(t.total||0), 0))}`
    } else if (tab === 'supplier') {
      const data = rekapPerSupplier()
      headers = ['No', 'Supplier', 'Qty', 'Total Jual', 'Total HPP', 'Laba']
      rows = data.map((r, i) => [i+1, r.name, r.qty, formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: Jual ${formatRp(grandJual)} | Laba ${formatRp(grandLaba)}`
    } else if (tab === 'masuk') {
      const data = rekapBarangMasuk()
      headers = ['No', 'Tanggal', 'Invoice', 'Supplier', 'Total', 'Status']
      rows = data.map((s, i) => { const sup = suppliers.find(sp => sp.id === s.supplierId); return [i+1, fmtDate(s.date), s.invoice||'-', sup?.name||'-', formatRp(s.total), s.caraBayar||'LUNAS'] })
      summary = `Total Pembelian: ${formatRp(data.reduce((a,s) => a+(s.total||0), 0))}`
    } else if (tab === 'retur') {
      const data = laporanRetur()
      headers = ['No', 'Tanggal', 'No Retur', 'Produk', 'Supplier', 'Qty', 'Total']
      rows = data.map((r, i) => [i+1, fmtDate(r.date), r.noRetur||'-', r.productName||'-', r.supplierName||'-', r.qty, formatRp((r.qty||0)*(r.price||0))])
      summary = `Total Retur: ${formatRp(data.reduce((a,r) => a+((r.qty||0)*(r.price||0)), 0))}`
    } else if (tab === 'detail') {
      headers = ['No', 'Tanggal', 'Nota', 'Pelanggan', 'Total', 'Status']
      rows = txFiltered.slice(0, 500).map((tx, i) => { const m = getMember(tx.memberId); return [i+1, fmtDate(tx.date), tx.noNota||'-', m?.name||tx.customerName||'Umum', formatRp(tx.total), tx.caraBayar||'LUNAS'] })
      summary = `Grand Total: ${formatRp(grandJual)} (${txFiltered.length} nota)`
    } else if (tab === 'tanggal') {
      const data = rekapPerTanggal()
      headers = ['Tanggal', 'Nota', 'Tunai', 'Kredit', 'Total', 'HPP', 'Laba']
      rows = data.map(r => [fmtDate(r.date), r.count, formatRp(r.tunai), formatRp(r.kredit), formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: ${formatRp(grandJual)}`
    } else if (tab === 'jenis') {
      const data = rekapPerJenis()
      headers = ['No', 'Jenis', 'Qty', 'Total Jual', 'Total HPP', 'Laba']
      rows = data.map((r, i) => [i+1, r.category, r.qty, formatRp(r.totalJual), formatRp(r.totalHpp), formatRp(r.totalJual - r.totalHpp)])
      summary = `Grand Total: ${formatRp(grandJual)}`
    }
    if (headers.length) cetakLaporanPDF('Rekap Penjualan ' + title, headers, rows, settings, periode + '\n' + summary)
  }

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Laporan Penjualan</h2>
        <button style={S.primaryBtn} onClick={handlePrint}>🖨️ Cetak Laporan</button>
      </div>

      {/* Date range + filters */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Tanggal:</label>
        <input style={{ ...S.input, width: 140, fontSize: 12 }} type="date" value={tgl1} onChange={e => setTgl1(e.target.value)} />
        <span style={{ fontSize: 13 }}>s/d</span>
        <input style={{ ...S.input, width: 140, fontSize: 12 }} type="date" value={tgl2} onChange={e => setTgl2(e.target.value)} />
        <select style={{ ...S.input, width: 'auto', fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Semua (Tunai + Kredit)</option>
          <option value="LUNAS">Tunai / Lunas saja</option>
          <option value="KREDIT">Kredit saja</option>
        </select>
        <select style={{ ...S.input, width: 'auto', fontSize: 12, maxWidth: 200 }} value={filterPlg} onChange={e => setFilterPlg(e.target.value)}>
          <option value="">Semua Pelanggan</option>
          {members.filter(m => !m.status || m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.no} - {m.name}</option>)}
        </select>
        {filterPlg && <button style={{ ...S.filterBtn, color: '#c62828', fontSize: 11 }} onClick={() => setFilterPlg('')}>× Reset</button>}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={S.statCard}><div style={S.statLabel}>Total Nota</div><div style={S.statVal}>{txFiltered.length}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total Penjualan</div><div style={{ ...S.statVal, color: '#1565c0' }}>{formatRp(grandJual)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total HPP</div><div style={{ ...S.statVal, color: '#e65100' }}>{formatRp(grandHpp)}</div></div>
        <div style={S.statCard}><div style={{ ...S.statLabel }}>Total Laba</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{formatRp(grandLaba)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Tunai</div><div style={S.statVal}>{formatRp(totalTunai)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Kredit</div><div style={{ ...S.statVal, color: '#c62828' }}>{formatRp(totalKredit)}</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} style={{ ...S.filterBtn, ...(tab === k ? S.filterActive : {}) }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={S.card}>
        {/* DETAIL PENJUALAN */}
        {tab === 'detail' && (
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'Nota', 'Pelanggan', 'NRP', 'Item', 'Total', 'Bayar', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{txFiltered.slice(0, 200).map(tx => {
              const m = getMember(tx.memberId)
              return (<tr key={tx.id} style={S.tr}>
                <td style={S.td}>{fmtDate(tx.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.noNota||'-'}</td>
                <td style={S.td}>{m?.name || tx.customerName || 'Umum'}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{m?.nrp || '-'}</td>
                <td style={S.td}>{(tx.items||[]).map((it,i) => <div key={i} style={{ fontSize: 11 }}>{it.name} ×{it.qty}</div>)}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(tx.total)}</td>
                <td style={S.td}>{formatRp(tx.payment)}</td>
                <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: tx.caraBayar === 'KREDIT' ? '#fff3e0' : '#e8f5e9', color: tx.caraBayar === 'KREDIT' ? '#e65100' : '#2e7d32' }}>{tx.caraBayar || 'LUNAS'}</span></td>
              </tr>)
            })}{txFiltered.length === 0 && <tr><td colSpan={8} style={S.empty}>Tidak ada transaksi</td></tr>}
            {txFiltered.length > 200 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Menampilkan 200 dari {txFiltered.length} transaksi</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={5} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{formatRp(grandJual)}</td><td colSpan={2} style={S.td}></td>
            </tr></tfoot>
          </table>
        )}

        {/* REKAP PER PELANGGAN */}
        {tab === 'pelanggan' && (() => { const data = rekapPerPelanggan(); return (
          <table style={S.table}>
            <thead><tr>{['No', 'Nama Pelanggan', 'NRP', 'Kompi', 'Total Hrg Jual', 'Total HPP', 'Total Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.name}</td>
                <td style={{ ...S.td, fontSize: 11, fontFamily: 'monospace' }}>{r.nrp}</td>
                <td style={S.td}>{r.kompi}</td>
                <td style={S.td}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: (r.totalJual - r.totalHpp) >= 0 ? '#2e7d32' : '#c62828' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}{data.length === 0 && <tr><td colSpan={7} style={S.empty}>Tidak ada data</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={4} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP PER BARANG */}
        {tab === 'barang' && (() => { const data = rekapPerBarang(); return (
          <table style={S.table}>
            <thead><tr>{['No', 'SKU', 'Nama Barang', 'Kategori', 'Qty Terjual', 'Total Jual', 'Total HPP', 'Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{r.sku}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.name}</td>
                <td style={S.td}>{r.category}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.qty}</td>
                <td style={S.td}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}{data.length === 0 && <tr><td colSpan={8} style={S.empty}>Tidak ada data</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={4} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{data.reduce((a,r) => a+r.qty, 0)}</td><td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP PER JENIS */}
        {tab === 'jenis' && (() => { const data = rekapPerJenis(); return (
          <table style={S.table}>
            <thead><tr>{['No', 'Jenis / Kategori', 'Qty Terjual', 'Total Jual', 'Total HPP', 'Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.category}</td>
                <td style={S.td}>{r.qty}</td>
                <td style={S.td}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={2} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{data.reduce((a,r) => a+r.qty, 0)}</td><td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP PER TANGGAL */}
        {tab === 'tanggal' && (() => { const data = rekapPerTanggal(); return (
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'Jml Nota', 'Tunai', 'Kredit', 'Total Jual', 'Total HPP', 'Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{fmtDate(r.date)}</td>
                <td style={S.td}>{r.count}</td>
                <td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(r.tunai)}</td>
                <td style={{ ...S.td, color: '#e65100' }}>{formatRp(r.kredit)}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td style={{ ...S.td, textAlign: 'right' }}>TOTAL</td>
              <td style={S.td}>{txFiltered.length}</td><td style={S.td}>{formatRp(totalTunai)}</td><td style={S.td}>{formatRp(totalKredit)}</td>
              <td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP PER KOMPI */}
        {tab === 'kompi' && (() => { const data = rekapPerKompi(); return (
          <table style={S.table}>
            <thead><tr>{['No', 'Kompi', 'Jml Anggota', 'Nota', 'Tunai', 'Kredit', 'Total Jual', 'Total HPP', 'Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.kompi}</td>
                <td style={S.td}>{r.memberCount}</td>
                <td style={S.td}>{r.count}</td>
                <td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(r.tunai)}</td>
                <td style={{ ...S.td, color: '#e65100' }}>{formatRp(r.kredit)}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={4} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{formatRp(totalTunai)}</td><td style={S.td}>{formatRp(totalKredit)}</td>
              <td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP KREDIT */}
        {tab === 'kredit' && (() => { const kreditTx = txFiltered.filter(t => t.caraBayar === 'KREDIT'); return (
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'Nota', 'Pelanggan', 'NRP', 'Kompi', 'Total', 'DP', 'Sisa'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{kreditTx.map(tx => {
              const m = getMember(tx.memberId)
              return (<tr key={tx.id} style={S.tr}>
                <td style={S.td}>{fmtDate(tx.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.noNota||'-'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{m?.name || tx.customerName || 'Umum'}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{m?.nrp || '-'}</td>
                <td style={S.td}>{m?.kompi || '-'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(tx.total)}</td>
                <td style={S.td}>{formatRp(tx.payment||0)}</td>
                <td style={{ ...S.td, color: '#c62828', fontWeight: 600 }}>{formatRp((tx.total||0) - (tx.payment||0))}</td>
              </tr>)
            })}{kreditTx.length === 0 && <tr><td colSpan={8} style={S.empty}>Tidak ada transaksi kredit</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#fff3e0', fontWeight: 700 }}>
              <td colSpan={5} style={{ ...S.td, textAlign: 'right' }}>TOTAL KREDIT</td>
              <td style={S.td}>{formatRp(totalKredit)}</td><td colSpan={2} style={{ ...S.td, color: '#c62828' }}>{kreditTx.length} nota</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP TUNAI */}
        {tab === 'tunai' && (() => { const tunaiTx = txFiltered.filter(t => (t.caraBayar||'LUNAS') !== 'KREDIT'); return (
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'Nota', 'Pelanggan', 'Total', 'Bayar', 'Kembali'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{tunaiTx.slice(0, 200).map(tx => {
              const m = getMember(tx.memberId)
              return (<tr key={tx.id} style={S.tr}>
                <td style={S.td}>{fmtDate(tx.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{tx.noNota||'-'}</td>
                <td style={S.td}>{m?.name || tx.customerName || 'Umum'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(tx.total)}</td>
                <td style={S.td}>{formatRp(tx.payment)}</td>
                <td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(tx.change||0)}</td>
              </tr>)
            })}{tunaiTx.length === 0 && <tr><td colSpan={6} style={S.empty}>Tidak ada transaksi tunai</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#e8f5e9', fontWeight: 700 }}>
              <td colSpan={3} style={{ ...S.td, textAlign: 'right' }}>TOTAL TUNAI</td>
              <td style={S.td}>{formatRp(totalTunai)}</td><td colSpan={2} style={{ ...S.td, color: '#2e7d32' }}>{tunaiTx.length} nota</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP PER SUPPLIER */}
        {tab === 'supplier' && (() => { const data = rekapPerSupplier(); return (
          <table style={S.table}>
            <thead><tr>{['No', 'Supplier', 'Qty Terjual', 'Total Jual', 'Total HPP', 'Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.name}</td>
                <td style={S.td}>{r.qty}</td>
                <td style={S.td}>{formatRp(r.totalJual)}</td>
                <td style={S.td}>{formatRp(r.totalHpp)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }}>{formatRp(r.totalJual - r.totalHpp)}</td>
              </tr>
            ))}{data.length === 0 && <tr><td colSpan={6} style={S.empty}>Tidak ada data</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={2} style={{ ...S.td, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={S.td}>{data.reduce((a,r) => a+r.qty, 0)}</td><td style={S.td}>{formatRp(grandJual)}</td><td style={S.td}>{formatRp(grandHpp)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(grandLaba)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP BARANG MASUK / PENAMBAHAN STOCK */}
        {tab === 'masuk' && (() => { const data = rekapBarangMasuk(); const totalBeli = data.reduce((a,s) => a+(s.total||0), 0); return (
          <div>
            <table style={S.table}>
              <thead><tr>{['Tanggal', 'No Invoice', 'Supplier', 'Item', 'Total', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{data.map(s => {
                const sup = suppliers.find(sp => sp.id === s.supplierId)
                return (<tr key={s.id} style={S.tr}>
                  <td style={S.td}>{fmtDate(s.date)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{s.invoice||'-'}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{sup?.name || '-'}</td>
                  <td style={S.td}>{(s.items||[]).map((it,i) => { const p = products.find(pr => pr.id === it.productId); return <div key={i} style={{ fontSize: 11 }}>{p?.name||it.productId} × {it.qty} @ {formatRp(it.buyPrice)}</div> })}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(s.total)}</td>
                  <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: s.caraBayar === 'KREDIT' ? '#fff3e0' : '#e8f5e9', color: s.caraBayar === 'KREDIT' ? '#e65100' : '#2e7d32' }}>{s.caraBayar || 'LUNAS'}</span></td>
                </tr>)
              })}{data.length === 0 && <tr><td colSpan={6} style={S.empty}>Tidak ada barang masuk</td></tr>}</tbody>
              <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
                <td colSpan={4} style={{ ...S.td, textAlign: 'right' }}>TOTAL PEMBELIAN</td>
                <td style={S.td}>{formatRp(totalBeli)}</td><td style={S.td}>{data.length} nota</td>
              </tr></tfoot>
            </table>
          </div>
        )})()}

        {/* LAPORAN RETUR */}
        {tab === 'retur' && (() => { const data = laporanRetur(); const totalRetur = data.reduce((a,r) => a+((r.qty||0)*(r.price||0)), 0); return (
          <table style={S.table}>
            <thead><tr>{['Tanggal', 'No Retur', 'Produk', 'Supplier', 'Qty', 'Harga', 'Total', 'Keterangan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map(r => (
              <tr key={r.id} style={S.tr}>
                <td style={S.td}>{fmtDate(r.date)}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{r.noRetur||'-'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.productName||'-'}</td>
                <td style={S.td}>{r.supplierName||'-'}</td>
                <td style={S.td}>{r.qty}</td>
                <td style={S.td}>{formatRp(r.price||0)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#c62828' }}>{formatRp((r.qty||0)*(r.price||0))}</td>
                <td style={S.td}>{r.reason||r.note||'-'}</td>
              </tr>
            ))}{data.length === 0 && <tr><td colSpan={8} style={S.empty}>Tidak ada retur</td></tr>}</tbody>
            <tfoot><tr style={{ background: '#ffebee', fontWeight: 700 }}>
              <td colSpan={6} style={{ ...S.td, textAlign: 'right' }}>TOTAL RETUR</td>
              <td style={{ ...S.td, color: '#c62828' }}>{formatRp(totalRetur)}</td><td style={S.td}>{data.length} retur</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP ASET BARANG */}
        {tab === 'aset' && (() => { const data = rekapAset(); const totalNilai = data.reduce((a,r) => a+r.totalNilai, 0); const totalJual = data.reduce((a,r) => a+r.totalJual, 0); return (
          <table style={S.table}>
            <thead><tr>{['No', 'Kategori', 'Jml Produk', 'Total Stok', 'Nilai Beli (HPP)', 'Nilai Jual', 'Potensi Laba'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{i+1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{r.category}</td>
                <td style={S.td}>{r.count}</td>
                <td style={S.td}>{r.totalStock}</td>
                <td style={S.td}>{formatRp(r.totalNilai)}</td>
                <td style={S.td}>{formatRp(r.totalJual)}</td>
                <td style={{ ...S.td, color: '#2e7d32', fontWeight: 600 }}>{formatRp(r.totalJual - r.totalNilai)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#f5f6fa', fontWeight: 700 }}>
              <td colSpan={2} style={{ ...S.td, textAlign: 'right' }}>TOTAL</td>
              <td style={S.td}>{products.length}</td><td style={S.td}>{products.reduce((a,p) => a+(p.stock||0), 0)}</td>
              <td style={S.td}>{formatRp(totalNilai)}</td><td style={S.td}>{formatRp(totalJual)}</td><td style={{ ...S.td, color: '#2e7d32' }}>{formatRp(totalJual - totalNilai)}</td>
            </tr></tfoot>
          </table>
        )})()}

        {/* REKAP POTONGAN (Potongan gaji per Kompi - kredit yang dipotong dari gaji anggota) */}
        {tab === 'potongan' && (() => {
          const kreditTx = txFiltered.filter(t => t.caraBayar === 'KREDIT')
          // Group by kompi -> member
          const kompiMap = {}
          kreditTx.forEach(tx => {
            const m = getMember(tx.memberId)
            const kompi = m?.kompi || 'UMUM'
            if (!kompiMap[kompi]) kompiMap[kompi] = {}
            const key = tx.memberId || '_umum'
            if (!kompiMap[kompi][key]) kompiMap[kompi][key] = { name: m?.name || tx.customerName || 'Umum', nrp: m?.nrp || '-', no: m?.no || '-', total: 0, count: 0 }
            kompiMap[kompi][key].total += tx.total || 0
            kompiMap[kompi][key].count++
          })
          const kompiList = Object.entries(kompiMap).sort((a, b) => a[0].localeCompare(b[0]))
          const grandTotal = kreditTx.reduce((a, t) => a + (t.total||0), 0)
          return (
            <div>
              <div style={{ padding: '10px 14px', background: '#fff3e0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#e65100' }}>
                Rekap potongan gaji anggota dari transaksi <strong>KREDIT</strong> per kompi. Periode: {fmtDate(tgl1)} s/d {fmtDate(tgl2)}
              </div>
              {kompiList.map(([kompi, membersMap]) => {
                const memberList = Object.values(membersMap).sort((a, b) => b.total - a.total)
                const kompiTotal = memberList.reduce((a, m) => a + m.total, 0)
                return (
                  <div key={kompi} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, padding: '8px 12px', background: '#e3f2fd', borderRadius: '8px 8px 0 0', color: '#1565c0' }}>{kompi} — {memberList.length} anggota — Total: {formatRp(kompiTotal)}</div>
                    <table style={S.table}>
                      <thead><tr>{['No', 'Kode', 'Nama Anggota', 'NRP', 'Jml Nota', 'Total Potongan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>{memberList.map((m, i) => (
                        <tr key={i} style={S.tr}>
                          <td style={S.td}>{i+1}</td>
                          <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{m.no}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
                          <td style={{ ...S.td, fontSize: 11 }}>{m.nrp}</td>
                          <td style={S.td}>{m.count}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#c62828' }}>{formatRp(m.total)}</td>
                        </tr>
                      ))}</tbody>
                      <tfoot><tr style={{ background: '#fff3e0', fontWeight: 700 }}>
                        <td colSpan={4} style={{ ...S.td, textAlign: 'right' }}>SUBTOTAL {kompi}</td>
                        <td style={S.td}>{memberList.reduce((a,m) => a+m.count, 0)}</td>
                        <td style={{ ...S.td, color: '#c62828' }}>{formatRp(kompiTotal)}</td>
                      </tr></tfoot>
                    </table>
                  </div>
                )
              })}
              {kompiList.length === 0 && <p style={S.empty}>Tidak ada transaksi kredit dalam periode ini</p>}
              {kompiList.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#ffebee', borderRadius: 8, fontSize: 16, fontWeight: 700, color: '#c62828', textAlign: 'center' }}>
                  GRAND TOTAL POTONGAN: {formatRp(grandTotal)} ({kreditTx.length} nota)
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
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
