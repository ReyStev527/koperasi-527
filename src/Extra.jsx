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
    ${member?.nrp ? '<div>NRP: ' + member.nrp + '</div>' : ''}
    ${member?.kompi ? '<div>Kompi: ' + member.kompi + '</div>' : ''}
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
export function KartuAnggota({ member, members, settings, logoSrc }) {
  const [mode, setMode] = useState('single') // single | batch

  // === BARCODE CODE128 generator (SVG) ===
  function code128svg(text, w, h) {
    const CODE128 = [212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112]
    const START_B = 104, STOP = 106
    let codes = [START_B], checksum = START_B
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i) - 32
      codes.push(c); checksum += c * (i + 1)
    }
    codes.push(checksum % 103, STOP)
    let pattern = ''
    codes.forEach(c => { const p = CODE128[c].toString(); for (let i = 0; i < p.length; i++) pattern += (i % 2 === 0 ? '1' : '0').repeat(Number(p[i])) })
    const barW = w / pattern.length
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') svg += `<rect x="${i * barW}" y="0" width="${barW + 0.5}" height="${h}" fill="#fff"/>`
    }
    svg += '</svg>'
    return svg
  }

  // Cetak 1 kartu
  function cetakKartu() {
    const win = window.open('', '_blank', 'width=500,height=400')
    win.document.write(generateCardHTML([member], settings, logoSrc, code128svg))
    win.document.close()
  }

  // Cetak 6 kartu per halaman HVS A4
  function cetakBatch() {
    const list = members || [member]
    const win = window.open('', '_blank', 'width=800,height=1000')
    win.document.write(generateBatchHTML(list, settings, logoSrc, code128svg))
    win.document.close()
  }

  const bc = code128svg(member.no || 'M00', 120, 28)

  return (
    <div>
      {/* Preview kartu */}
      <div style={{ width: 340, height: 214, borderRadius: 12, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', color: '#fff', padding: '12px 16px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {logoSrc && <img src={logoSrc} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{settings?.name || 'KOPERASI YONIF 527/BY'}</div>
            <div style={{ fontSize: 7, opacity: 0.6 }}>Baladibya Yudha — Kartu Anggota</div>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffd54f', letterSpacing: 2 }}>No. {member.no}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{member.name}</div>
        <div style={{ fontSize: 9, marginTop: 4, lineHeight: 1.5, opacity: 0.85 }}>
          <div>NRP: {member.nrp || '-'} | Kompi: {member.kompi || '-'}</div>
          <div>Bergabung: {fmtDate(member.joinDate)}</div>
        </div>
        {/* Barcode kanan bawah */}
        <div style={{ position: 'absolute', bottom: 8, right: 12, textAlign: 'center' }}>
          <div dangerouslySetInnerHTML={{ __html: bc }} />
          <div style={{ fontSize: 6, opacity: 0.5, marginTop: 1 }}>{member.no}</div>
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: 16, fontSize: 7, opacity: 0.4 }}>Valid s/d 31 Des {new Date().getFullYear() + 1}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={cetakKartu} style={{ padding: '8px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🖨️ Cetak 1 Kartu</button>
        {members && members.length > 1 && (
          <button onClick={cetakBatch} style={{ padding: '8px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🖨️ Cetak Semua ({members.length} kartu, {Math.ceil(members.length / 6)} lembar)</button>
        )}
      </div>
    </div>
  )
}

// Generate HTML untuk 1 kartu (cetak individual)
function generateCardHTML(memberList, settings, logoSrc, code128svg) {
  return `<!DOCTYPE html><html><head><style>
    @page { margin: 5mm; size: A4 portrait; }
    body { margin: 0; font-family: Arial, sans-serif; }
    .card { width: 85.6mm; height: 53.98mm; border: 1px solid #333; border-radius: 3mm; overflow: hidden; position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 3mm 4mm; box-sizing: border-box; page-break-inside: avoid; }
    .header { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.5mm; }
    .logo { width: 8mm; height: 8mm; border-radius: 1.5mm; object-fit: contain; }
    .title { font-size: 8pt; font-weight: bold; line-height: 1.2; }
    .subtitle { font-size: 5.5pt; opacity: 0.7; }
    .no { font-size: 12pt; font-weight: bold; letter-spacing: 1.5px; color: #ffd54f; margin-top: 1mm; }
    .name { font-size: 10pt; font-weight: bold; margin-top: 0.5mm; }
    .info { font-size: 7pt; margin-top: 1mm; line-height: 1.5; opacity: 0.85; }
    .barcode { position: absolute; bottom: 2mm; right: 3mm; text-align: center; }
    .barcode-label { font-size: 5pt; opacity: 0.5; margin-top: 0.5mm; }
    .valid { position: absolute; bottom: 2.5mm; left: 4mm; font-size: 5.5pt; opacity: 0.4; }
    @media print { body { margin: 0; } }
  </style></head><body>
    ${memberList.map(m => `<div class="card">
      <div class="header">
        ${logoSrc ? '<img src="' + logoSrc + '" class="logo">' : ''}
        <div><div class="title">${settings?.name || 'KOPERASI YONIF 527/BY'}</div><div class="subtitle">Baladibya Yudha — Kartu Anggota</div></div>
      </div>
      <div class="no">No. ${m.no}</div>
      <div class="name">${m.name}</div>
      <div class="info">
        <div>NRP: ${m.nrp || '-'} | Kompi: ${m.kompi || '-'}</div>
        <div>Bergabung: ${fmtDate(m.joinDate)}</div>
      </div>
      <div class="barcode">${code128svg(m.no || 'M00', 80, 18)}<div class="barcode-label">${m.no}</div></div>
      <div class="valid">Valid s/d 31 Des ${new Date().getFullYear() + 1}</div>
    </div>`).join('')}
    <script>setTimeout(()=>{window.print();},500)</script>
  </body></html>`
}

// Generate HTML batch: 6 kartu per halaman HVS A4 (2 kolom x 3 baris)
function generateBatchHTML(memberList, settings, logoSrc, code128svg) {
  // Ukuran kartu ATM: 85.6mm x 53.98mm
  // HVS A4: 210mm x 297mm
  // 2 kolom x 3 baris = 6 kartu per halaman
  const pages = []
  for (let i = 0; i < memberList.length; i += 6) {
    pages.push(memberList.slice(i, i + 6))
  }

  return `<!DOCTYPE html><html><head><style>
    @page { margin: 8mm 10mm; size: A4 portrait; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    .page { width: 190mm; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; page-break-after: always; padding: 2mm 0; }
    .page:last-child { page-break-after: auto; }
    .card { width: 85.6mm; height: 53.98mm; border: 1px solid #555; border-radius: 2.5mm; overflow: hidden; position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 3mm 4mm; }
    .header { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.5mm; }
    .logo { width: 7mm; height: 7mm; border-radius: 1.5mm; object-fit: contain; }
    .title { font-size: 7.5pt; font-weight: bold; line-height: 1.2; }
    .subtitle { font-size: 5pt; opacity: 0.7; }
    .no { font-size: 11pt; font-weight: bold; letter-spacing: 1.5px; color: #ffd54f; margin-top: 0.5mm; }
    .name { font-size: 9pt; font-weight: bold; margin-top: 0.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55mm; }
    .info { font-size: 6.5pt; margin-top: 1mm; line-height: 1.4; opacity: 0.85; }
    .barcode { position: absolute; bottom: 2mm; right: 3mm; text-align: center; }
    .barcode-label { font-size: 5pt; opacity: 0.5; margin-top: 0.3mm; }
    .valid { position: absolute; bottom: 2mm; left: 4mm; font-size: 5pt; opacity: 0.4; }
    @media print { body { margin: 0; } .page { margin: 0; } }
  </style></head><body>
    ${pages.map(pg => `<div class="page">${pg.map(m => `
      <div class="card">
        <div class="header">
          ${logoSrc ? '<img src="' + logoSrc + '" class="logo">' : ''}
          <div><div class="title">${settings?.name || 'KOPERASI YONIF 527/BY'}</div><div class="subtitle">Baladibya Yudha — Kartu Anggota</div></div>
        </div>
        <div class="no">No. ${m.no}</div>
        <div class="name">${m.name}</div>
        <div class="info">
          <div>NRP: ${m.nrp || '-'} | Kompi: ${m.kompi || '-'}</div>
          <div>Bergabung: ${fmtDate(m.joinDate)}</div>
        </div>
        <div class="barcode">${code128svg(m.no || 'M00', 70, 16)}<div class="barcode-label">${m.no}</div></div>
        <div class="valid">Valid s/d 31 Des ${new Date().getFullYear() + 1}</div>
      </div>
    `).join('')}</div>`).join('')}
    <script>setTimeout(()=>{window.print();},600)</script>
  </body></html>`
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
// ICONS & STYLES
// =============================================
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
