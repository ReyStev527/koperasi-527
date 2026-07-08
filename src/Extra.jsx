// =============================================
// MODUL TAMBAHAN: PDF, Hutang Supplier, Kartu Anggota,
// Struk Thermal, Backup/Restore, Dashboard Grafik
// =============================================
import { useState, useRef, useEffect } from 'react'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { 
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function toLocalDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }


// =============================================
// 1. CETAK STRUK THERMAL (browser print - 58mm/80mm)
// =============================================
export function cetakStruk(tx, settings, members) {
  const member = members?.find(m => m.id === tx.memberId)
  const win = window.open('', '_blank', 'width=300,height=500')
  win.document.write(`<!DOCTYPE html><html><head><style>
    @page { margin: 0; size: 58mm auto; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 10px; width: 54mm; margin: 2mm; padding: 0; color: #000; line-height: 1.3; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 3px 0; }
    .dline { border-top: 2px solid #000; margin: 3px 0; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .row span:last-child { text-align: right; white-space: nowrap; }
    .right { text-align: right; }
    .small { font-size: 8px; }
    .item-name { font-size: 10px; font-weight: bold; margin-bottom: 0; }
    .item-detail { font-size: 9px; display: flex; justify-content: space-between; }
    .total-box { font-size: 13px; font-weight: bold; padding: 3px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 0; vertical-align: top; font-size: 9px; }
  </style></head><body>
    <div class="center bold" style="font-size:11px;letter-spacing:1px">${settings?.name || 'KOPERASI YONIF 527/BY'}</div>
    <div class="center small">Baladibya Yudha</div>
    <div class="center small">Lumajang, Jawa Timur</div>
    <div class="dline"></div>
    <div class="row" style="font-size:9px"><span>No: ${tx.noNota || '-'}</span><span>${tx.date || today()}</span></div>
    <div style="font-size:9px">Kasir: ${tx.cashier || 'admin'}</div>
    ${member ? '<div style="font-size:9px">Pembeli: ' + member.name + '</div>' : ''}
    <div class="line"></div>
    ${(tx.items || []).map(item => {
      const sub = item.price * item.qty
      const dis = item.diskon ? sub * item.diskon / 100 : 0
      const net = sub - dis
      return '<div class="item-name">' + item.name + '</div>' +
        '<div class="item-detail"><span>' + item.qty + ' x ' + Number(item.price).toLocaleString('id-ID') +
        (item.diskon ? ' (-' + item.diskon + '%)' : '') +
        '</span><span style="font-weight:bold">' + Number(net).toLocaleString('id-ID') + '</span></div>'
    }).join('')}
    <div class="dline"></div>
    ${tx.totalDiskon > 0 ? '<div class="row" style="font-size:9px"><span>Subtotal</span><span>' + Number(tx.totalSebelumDiskon).toLocaleString('id-ID') + '</span></div><div class="row" style="font-size:9px"><span>Diskon</span><span>-' + Number(tx.totalDiskon).toLocaleString('id-ID') + '</span></div>' : ''}
    <div class="row total-box"><span>TOTAL</span><span>Rp ${Number(tx.total).toLocaleString('id-ID')}</span></div>
    <div class="line"></div>
    <div class="row" style="font-size:9px"><span>${tx.caraBayar || 'TUNAI'}</span><span>${Number(tx.payment || 0).toLocaleString('id-ID')}</span></div>
    ${tx.caraBayar !== 'KREDIT' && tx.change > 0 ? '<div class="row" style="font-size:9px;font-weight:bold"><span>Kembali</span><span>' + Number(tx.change).toLocaleString('id-ID') + '</span></div>' : ''}
    ${tx.caraBayar === 'KREDIT' ? '<div class="row" style="font-size:10px;font-weight:bold;color:#000"><span>SISA PIUTANG</span><span>' + Number(tx.total - (tx.payment || 0)).toLocaleString('id-ID') + '</span></div>' : ''}
    <div class="line"></div>
    <div class="center small">Terima kasih atas kunjungan Anda</div>
    <div class="center small">Barang yg sudah dibeli tidak dapat dikembalikan</div>
    <div class="center small" style="margin-top:4px">--- ${new Date().toLocaleString('id-ID')} ---</div>
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
// 3. KARTU ANGGOTA DIGITAL + BARCODE
// =============================================
// Load JsBarcode dari CDN
async function loadJsBarcode() {
  if (window.JsBarcode) return window.JsBarcode
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
    s.onload = () => resolve(window.JsBarcode)
    s.onerror = () => reject(new Error('Gagal memuat JsBarcode'))
    document.head.appendChild(s)
  })
}

export function KartuAnggota({ member, settings, logoSrc }) {
  const cardRef = useRef()
  const barcodeRef = useRef()

  // Kode barcode: prefix AGT- + ID unik anggota (dijamin tidak bentrok)
  const barcodeValue = 'AGT-' + (member.id || '000')

  // Render barcode di canvas saat komponen dimuat
  useEffect(() => {
    loadJsBarcode().then(JsBarcode => {
      if (barcodeRef.current) {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: 30,
          displayValue: true,
          fontSize: 10,
          font: 'Arial',
          textMargin: 2,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        })
      }
    }).catch(err => console.warn('Barcode load error:', err))
  }, [barcodeValue])

  function cetakKartu() {
    const win = window.open('', '_blank', 'width=500,height=350')
    win.document.write(`<!DOCTYPE html><html><head>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
    <style>
      @page { margin: 10mm; size: 86mm 54mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .card { width: 86mm; height: 54mm; border: 2px solid #1565c0; border-radius: 10px; overflow: hidden; position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%) !important; color: #fff; padding: 8px 12px; box-sizing: border-box; }
      .logo { width: 32px; height: 32px; border-radius: 6px; object-fit: contain; }
      .header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
      .title { font-size: 10px; font-weight: bold; line-height: 1.2; }
      .subtitle { font-size: 7px; opacity: 0.7; }
      .info { font-size: 8px; margin-top: 2px; }
      .info div { margin-bottom: 1px; }
      .no { font-size: 14px; font-weight: bold; letter-spacing: 2px; color: #ffd54f !important; margin-top: 2px; }
      .name { font-size: 12px; font-weight: bold; margin-top: 1px; }
      .barcode-area { position: absolute; bottom: 4px; left: 12px; right: 12px; text-align: center; background: #fff !important; border-radius: 4px; padding: 3px 6px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .barcode-area canvas { max-width: 100%; }
      .footer { position: absolute; bottom: 4px; right: 12px; font-size: 7px; opacity: 0.5; }
      @media print { body { margin: 0; } .card { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%) !important; } }
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
        </div>
        <div class="barcode-area">
          <canvas id="print-barcode"></canvas>
        </div>
      </div>
      <script>
        window.onload = function() {
          try {
            JsBarcode("#print-barcode", "${barcodeValue}", {
              format: "CODE128", width: 2, height: 35,
              displayValue: true, fontSize: 10, font: "Arial",
              textMargin: 2, margin: 4,
              background: "#ffffff", lineColor: "#000000"
            });
          } catch(e) { console.warn('Barcode error:', e); }
          setTimeout(function(){ window.print(); }, 500);
        }
      <\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div ref={cardRef} style={{ width: 340, height: 220, borderRadius: 12, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', color: '#fff', padding: '12px 18px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {logoSrc && <img src={logoSrc} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{settings?.name || 'KOPERASI YONIF 527/BY'}</div>
            <div style={{ fontSize: 8, opacity: 0.6 }}>Baladibya Yudha — Kartu Anggota</div>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffd54f', letterSpacing: 2, marginTop: 2 }}>No. {member.no}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{member.name}</div>
        <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5, opacity: 0.85 }}>
          <div>Telepon: {member.phone || '-'}</div>
        </div>
        {/* Barcode area */}
        <div style={{ position: 'absolute', bottom: 8, left: 18, right: 18, textAlign: 'center', background: '#fff', borderRadius: 4, padding: '3px 6px' }}>
          <canvas ref={barcodeRef} style={{ maxWidth: '100%' }} />
        </div>
      </div>
      <div style={{ marginTop: 10, padding: '8px 12px', background: '#e3f2fd', borderRadius: 8, fontSize: 12, color: '#1565c0' }}>
        Kode Barcode: <strong>{barcodeValue}</strong> — scan di Kasir untuk auto-pilih anggota
      </div>
      <button onClick={cetakKartu} style={{ marginTop: 10, padding: '8px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cetak Kartu</button>
    </div>
  )
}

// =============================================
// 3b. CETAK SEMUA KARTU ANGGOTA (4 atau 6 per halaman A4)
// Ukuran kartu = ukuran ATM: 85.6mm x 54mm
// =============================================
export function cetakSemuaKartu(members, settings, logoSrc, perPage = 6) {
  const activeMembers = members.filter(m => m.status === 'active')
  if (activeMembers.length === 0) { alert('Tidak ada anggota aktif'); return }

  // CEK DUPLIKAT BARCODE
  const barcodeMap = {}
  const duplicates = []
  activeMembers.forEach(m => {
    const code = 'AGT-' + (m.id || '000')
    if (barcodeMap[code]) {
      duplicates.push(m.name + ' & ' + barcodeMap[code] + ' = ' + code)
    }
    barcodeMap[code] = m.name
  })
  if (duplicates.length > 0) {
    alert('⚠️ PERINGATAN: Ada barcode DUPLIKAT!\n\n' + duplicates.join('\n') + '\n\nHubungi admin untuk perbaiki data anggota.')
  }

  const cols = 2
  const rows = perPage === 4 ? 2 : 3
  const cardW = '85.6mm'
  const cardH = '54mm'
  const totalPages = Math.ceil(activeMembers.length / perPage)

  let cardsHtml = ''
  activeMembers.forEach((m, i) => {
    const barcodeId = 'bc-' + i
    const barcodeValue = 'AGT-' + (m.id || '000')
    if (i > 0 && i % perPage === 0) {
      cardsHtml += '<div class="page-break"></div>'
    }
    cardsHtml += `
      <div class="card">
        <div class="header">
          ${logoSrc ? '<img src="' + logoSrc + '" class="logo">' : ''}
          <div>
            <div class="title">${settings?.name || 'KOPERASI YONIF 527/BY'}</div>
            <div class="subtitle">Baladibya Yudha — Kartu Anggota</div>
          </div>
        </div>
        <div class="no">No. ${m.no}</div>
        <div class="name">${m.pangkat ? m.pangkat + ' ' : ''}${m.name}</div>
        <div class="info">
          <div>${m.nrp ? 'NRP: ' + m.nrp : ''} ${m.kompi ? '| ' + m.kompi : ''}</div>
        </div>
        <div class="barcode-area"><canvas id="${barcodeId}" data-value="${barcodeValue}"></canvas></div>
        <div class="footer">${barcodeValue}</div>
      </div>`
  })

  const win = window.open('', '_blank', 'width=800,height=600')
  win.document.write(`<!DOCTYPE html><html><head>
  <title>Cetak Kartu Anggota - ${activeMembers.length} kartu</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    @page { margin: 8mm; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .print-info { padding: 10px 20px; background: #e3f2fd; text-align: center; font-size: 13px; color: #1565c0; }
    .print-info button { margin-left: 12px; padding: 6px 20px; background: #1565c0; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .grid { 
      display: grid; 
      grid-template-columns: repeat(${cols}, ${cardW}); 
      gap: 6mm; 
      justify-content: center; 
      padding: 4mm 0;
    }
    .page-break { 
      grid-column: 1 / -1; 
      height: 0; 
      page-break-after: always; 
      break-after: page; 
    }
    .card {
      width: ${cardW}; height: ${cardH};
      border: 1.5px solid #1565c0; border-radius: 8px; overflow: hidden;
      position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%) !important;
      color: #fff; padding: 5px 8px;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .header { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
    .logo { width: 22px; height: 22px; border-radius: 4px; object-fit: contain; }
    .title { font-size: 7.5px; font-weight: bold; line-height: 1.2; }
    .subtitle { font-size: 5.5px; opacity: 0.7; }
    .no { font-size: 11px; font-weight: bold; letter-spacing: 1.5px; color: #ffd54f; margin-top: 1px; }
    .name { font-size: 9px; font-weight: bold; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .info { font-size: 6.5px; margin-top: 1px; line-height: 1.4; opacity: 0.85; }
    .info div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .barcode-area { position: absolute; bottom: 3px; left: 8px; right: 8px; text-align: center; background: #fff !important; border-radius: 3px; padding: 3px 6px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .barcode-area canvas { max-width: 100%; }
    .footer { position: absolute; bottom: 2px; right: 8px; font-size: 5px; opacity: 0.4; }
    @media print { 
      .print-info { display: none; } 
      body { background: #fff; }
      .card { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%) !important; color: #fff !important; }
      .no { color: #ffd54f !important; }
    }
  </style></head><body>
    <div class="print-info">
      Cetak ${activeMembers.length} Kartu Anggota — ${totalPages} halaman (${perPage} kartu/halaman)
      <button onclick="window.print()">🖨️ Print Sekarang</button>
    </div>
    <div class="grid">${cardsHtml}</div>
    <script>
      window.onload = function() {
        document.querySelectorAll('.barcode-area canvas').forEach(function(canvas) {
          var val = canvas.getAttribute('data-value');
          if (val) {
            try {
              JsBarcode(canvas, val, {
                format: 'CODE128', width: 1.8, height: 28,
                displayValue: true, fontSize: 8, font: 'Arial',
                textMargin: 2, margin: 3,
                background: '#ffffff', lineColor: '#000000'
              });
            } catch(e) { console.warn('Barcode error:', e); }
          }
        });
        setTimeout(function(){ window.print(); }, 800);
      }
    <\/script>
  </body></html>`)
  win.document.close()
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
export function BackupRestore({ members, savings, loans, products, suppliers, kasData, jurnalData, transactions, stockInData, piutangs, hutangs, returs, mutasis, setorans, settings, showToast, deleteCollection, removeOne, saveImportedProducts, saveImportedMembers }) {
  const [restoring, setRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState('')
  const fileRef = useRef()

  // Reset Data state
  const [showReset, setShowReset] = useState(false)
  const [resetPin, setResetPin] = useState('')
  const [resetSelections, setResetSelections] = useState({}) // { key: true } = hapus semua
  const [expandedKey, setExpandedKey] = useState(null) // kategori yg dibuka
  const [selectedItems, setSelectedItems] = useState({}) // { key: Set(id1, id2) }
  const [resetting, setResetting] = useState(false)
  const [resetProgress, setResetProgress] = useState('')

  const RESET_PIN = '527reset'

  // Data untuk setiap kategori
  const dataMap = {
    transactions: transactions||[],
    stockIn: stockInData||[],
    kas: kasData||[],
    jurnal: jurnalData||[],
    piutangs: piutangs||[],
    hutangs: hutangs||[],
    returs: returs||[],
    mutasis: mutasis||[],
    setorans: setorans||[],
    auditLogs: [],
  }

  const resetOptions = [
    { key: 'transactions', label: 'Riwayat Penjualan (Kasir)', color: '#1565c0' },
    { key: 'stockIn', label: 'Riwayat Barang Masuk', color: '#6a1b9a' },
    { key: 'kas', label: 'Riwayat Kas Masuk/Keluar', color: '#2e7d32' },
    { key: 'jurnal', label: 'Jurnal Umum', color: '#e65100' },
    { key: 'piutangs', label: 'Data Piutang', color: '#c62828' },
    { key: 'hutangs', label: 'Data Hutang Supplier', color: '#ad1457' },
    { key: 'returs', label: 'Data Retur', color: '#4527a0' },
    { key: 'mutasis', label: 'Mutasi Stok', color: '#00695c' },
    { key: 'setorans', label: 'Setoran Harian', color: '#ef6c00' },
    { key: 'auditLogs', label: 'Audit Log', color: '#546e7a' },
  ]

  // Deskripsi item untuk ditampilkan di list
  function itemLabel(key, item) {
    const d = fmtDate(item.date||'')
    switch(key) {
      case 'transactions': return d + ' — ' + (item.noNota||'-') + ' — ' + (item.customerName||'Umum') + ' — ' + formatRp(item.total||0)
      case 'stockIn': return d + ' — ' + (item.invoice||'-') + ' — ' + formatRp(item.total||0)
      case 'kas': return d + ' — ' + (item.type==='masuk'?'Masuk':'Keluar') + ' — ' + (item.description||item.category||'-') + ' — ' + formatRp(item.amount||0)
      case 'jurnal': return d + ' — ' + (item.description||'-')
      case 'piutangs': return d + ' — ' + (item.customerName||'-') + ' — ' + formatRp(item.total||0) + (item.status==='LUNAS'?' ✅':'')
      case 'hutangs': return d + ' — ' + (item.supplierName||'-') + ' — ' + formatRp(item.total||0)
      case 'returs': return d + ' — ' + (item.productName||'-') + ' × ' + (item.qty||0)
      case 'mutasis': return d + ' — ' + (item.tipe||'') + ' — ' + (item.productName||products.find(p=>p.id===item.productId)?.name||'-')
      case 'setorans': return d + ' — ' + formatRp(item.total||item.penjualan||0)
      default: return d + ' — ' + (item.id||'')
    }
  }

  function toggleReset(key) {
    setResetSelections(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
        // Clear individual selections too
        setSelectedItems(p => { const n = {...p}; delete n[key]; return n })
      } else {
        next[key] = true
      }
      return next
    })
    setExpandedKey(null)
  }

  // Expand/collapse item list
  function toggleExpand(key) {
    if (expandedKey === key) { setExpandedKey(null); return }
    setExpandedKey(key)
    // Init selected items for this key if not exists
    if (!selectedItems[key]) {
      setSelectedItems(prev => ({ ...prev, [key]: new Set() }))
    }
  }

  function toggleItem(key, id) {
    setSelectedItems(prev => {
      const set = new Set(prev[key] || [])
      if (set.has(id)) set.delete(id); else set.add(id)
      // If some items selected, remove "select all" flag
      if (set.size > 0 && set.size < dataMap[key].length) {
        setResetSelections(p => { const n = {...p}; delete n[key]; return n })
      }
      return { ...prev, [key]: set }
    })
  }

  function selectAllItems(key) {
    const allIds = dataMap[key].map(item => item.id)
    setSelectedItems(prev => ({ ...prev, [key]: new Set(allIds) }))
    setResetSelections(prev => ({ ...prev, [key]: true }))
  }

  function deselectAllItems(key) {
    setSelectedItems(prev => ({ ...prev, [key]: new Set() }))
    setResetSelections(prev => { const n = {...prev}; delete n[key]; return n })
  }

  // Hitung total yang akan dihapus
  function getDeleteCount(key) {
    if (resetSelections[key]) return dataMap[key].length // hapus semua
    return (selectedItems[key]?.size) || 0
  }

  const totalToDelete = resetOptions.reduce((a, opt) => a + getDeleteCount(opt.key), 0)

  async function doReset() {
    if (resetPin !== RESET_PIN) {
      alert('❌ Sandi salah!')
      return
    }
    if (totalToDelete === 0) {
      alert('Pilih minimal 1 data yang ingin direset.')
      return
    }

    // Build summary
    const summary = resetOptions
      .filter(opt => getDeleteCount(opt.key) > 0)
      .map(opt => '- ' + opt.label + ': ' + getDeleteCount(opt.key) + ' dari ' + dataMap[opt.key].length)
      .join('\n')

    const confirmed = window.confirm(
      '⚠️ PERINGATAN RESET DATA ⚠️\n\n' +
      'Data yang akan DIHAPUS:\n' + summary + '\n\n' +
      'Total: ' + totalToDelete + ' record\n\n' +
      'AKSI INI TIDAK BISA DIBATALKAN!\nKetik OK untuk melanjutkan.'
    )
    if (!confirmed) return

    setResetting(true)
    let totalDeleted = 0

    for (const opt of resetOptions) {
      const count = getDeleteCount(opt.key)
      if (count === 0) continue

      setResetProgress('Menghapus ' + opt.label + '...')

      if (resetSelections[opt.key] && (!selectedItems[opt.key] || selectedItems[opt.key].size === 0 || selectedItems[opt.key].size >= dataMap[opt.key].length)) {
        // Hapus semua → pakai deleteCollection (batch, lebih cepat)
        try {
          const deleted = await deleteCollection(opt.key)
          totalDeleted += deleted
        } catch (err) { console.error('Reset all error:', opt.key, err) }
      } else {
        // Hapus sebagian → pakai removeOne per item
        const ids = [...(selectedItems[opt.key] || [])]
        for (let i = 0; i < ids.length; i++) {
          try {
            await removeOne(opt.key, ids[i])
            totalDeleted++
            setResetProgress('Menghapus ' + opt.label + ' (' + (i+1) + '/' + ids.length + ')')
          } catch (err) { console.error('Remove error:', opt.key, ids[i], err) }
        }
      }
    }

    setResetting(false)
    setResetProgress('')
    setResetPin('')
    setResetSelections({})
    setSelectedItems({})
    setExpandedKey(null)
    setShowReset(false)
    showToast(totalDeleted + ' data berhasil dihapus', 'error')
  }

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

      {/* RESET DATA */}
      <div style={{ ...S.card, padding: 24, marginTop: 24, border: '2px solid #c62828' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#c62828', marginBottom: 4 }}>Reset Data Transaksi</h3>
            <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Hapus riwayat transaksi tanpa menghapus data master (anggota, barang, supplier)</p>
          </div>
          <button style={{ ...S.primaryBtn, background: showReset ? '#666' : '#c62828' }} onClick={() => setShowReset(!showReset)}>
            {showReset ? 'Tutup' : '🔒 Buka Reset Data'}
          </button>
        </div>

        {showReset && (
          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 16 }}>
              <label style={{ ...S.formLabel, marginBottom: 0, flex: 1 }}>
                Masukkan Sandi Reset
                <input style={{ ...S.input, fontSize: 14, fontWeight: 600, letterSpacing: 2 }} type="password" value={resetPin} onChange={e => setResetPin(e.target.value)} placeholder="Ketik sandi..." />
              </label>
              <div style={{ padding: '10px 16px', background: resetPin === RESET_PIN ? '#e8f5e9' : '#f5f5f5', borderRadius: 8, fontSize: 13, fontWeight: 600, color: resetPin === RESET_PIN ? '#2e7d32' : '#999' }}>
                {resetPin === RESET_PIN ? '✅ Sandi benar' : '🔒 Terkunci'}
              </div>
            </div>

            {resetPin === RESET_PIN && (
              <>
                <div style={{ padding: '10px 14px', background: '#e8f5e9', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <strong style={{ color: '#2e7d32' }}>✅ Data yang TIDAK akan dihapus:</strong>
                  <span style={{ color: '#333', marginLeft: 8 }}>
                    Anggota ({members.length}), Barang ({products.length}), Supplier ({suppliers.length}), Simpanan ({savings.length}), Pinjaman ({loans.length}), Users, Pengaturan
                  </span>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: '#c62828', marginBottom: 8 }}>Pilih data yang ingin direset:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {resetOptions.map(opt => {
                    const data = dataMap[opt.key]
                    const deleteCount = getDeleteCount(opt.key)
                    const isExpanded = expandedKey === opt.key
                    const itemSet = selectedItems[opt.key] || new Set()
                    return (
                      <div key={opt.key} style={{ border: deleteCount > 0 ? '2px solid #c62828' : '1px solid #e0e0e0', borderRadius: 8, background: deleteCount > 0 ? '#ffebee' : '#f8f9fa', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!resetSelections[opt.key]} onChange={() => toggleReset(opt.key)}
                            style={{ width: 18, height: 18, accentColor: '#c62828' }} title="Pilih semua" />
                          <div style={{ flex: 1 }} onClick={() => data.length > 0 && toggleExpand(opt.key)}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: deleteCount > 0 ? '#c62828' : '#333' }}>{opt.label}</div>
                            {deleteCount > 0 && deleteCount < data.length && <div style={{ fontSize: 10, color: '#e65100' }}>{deleteCount} dari {data.length} dipilih</div>}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: opt.color, background: '#fff', padding: '2px 8px', borderRadius: 10, border: '1px solid ' + opt.color }}>{data.length}</span>
                          {data.length > 0 && (
                            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#666', padding: '2px 4px' }} onClick={() => toggleExpand(opt.key)} title="Lihat detail">
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        {/* Expanded item list */}
                        {isExpanded && data.length > 0 && (
                          <div style={{ borderTop: '1px solid #e0e0e0', padding: '8px 12px', maxHeight: 250, overflow: 'auto', background: '#fff' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                              <button style={{ fontSize: 10, color: '#1565c0', border: '1px solid #e0e0e0', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', background: '#fff' }} onClick={() => selectAllItems(opt.key)}>Pilih Semua</button>
                              <button style={{ fontSize: 10, color: '#c62828', border: '1px solid #e0e0e0', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', background: '#fff' }} onClick={() => deselectAllItems(opt.key)}>Hapus Pilihan</button>
                              <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>{itemSet.size}/{data.length} dipilih</span>
                            </div>
                            {[...data].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(item => (
                              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 11 }}>
                                <input type="checkbox" checked={itemSet.has(item.id)} onChange={() => toggleItem(opt.key, item.id)}
                                  style={{ width: 14, height: 14, accentColor: '#c62828', flexShrink: 0 }} />
                                <span style={{ color: itemSet.has(item.id) ? '#c62828' : '#333', wordBreak: 'break-all' }}>{itemLabel(opt.key, item)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button style={{ ...S.primaryBtn, background: '#c62828', fontSize: 14, padding: '12px 24px' }}
                    disabled={resetting || totalToDelete === 0}
                    onClick={doReset}>
                    🗑️ Hapus {totalToDelete} Data Terpilih
                  </button>
                  {resetting && <span style={{ fontSize: 13, color: '#c62828', fontWeight: 600 }}>{resetProgress}</span>}
                </div>
              </>
            )}
          </div>
        )}
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
    return toLocalDate(d)
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

  const [startDate, setStartDate] = useState(toLocalDate(defaultStart))
  const [endDate, setEndDate] = useState(toLocalDate(defaultEnd))
  const [filterKompi, setFilterKompi] = useState('all')

  // Filter transaksi dalam periode (EXCLUDE return)
  const periodTx = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.caraBayar !== 'RETURN' && !t.returned && !(transactions||[]).some(r => r.caraBayar === 'RETURN' && r.returnFrom === t.noNota))

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
    ;(stockIn||[]).filter(si => si.date > targetDate).forEach(si => {
      (si.items||[]).forEach(it => {
        if (it.productId === p.id) stok -= (it.qty||0)
      })
    })

    // Tambahkan kembali stok dari penjualan SETELAH tanggal target
    ;(transactions||[]).filter(tx => tx.date > targetDate).forEach(tx => {
      (tx.items||[]).forEach(it => {
        if (it.productId === p.id) stok += (it.qty||0)
      })
    })

    // Reverse mutasi SETELAH tanggal target
    ;(mutasis||[]).filter(m => m.date > targetDate).forEach(m => {
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
export function TagihanJuyar({ transactions, piutangs, members, settings, savePiutang, bayarPiutang, showToast, setModal }) {
  const now = new Date()
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 25)
  const defaultStart = new Date(defaultEnd); defaultStart.setMonth(defaultStart.getMonth() - 1); defaultStart.setDate(26)

  const [startDate, setStartDate] = useState(toLocalDate(defaultStart))
  const [endDate, setEndDate] = useState(toLocalDate(defaultEnd))
  const [filterKompi, setFilterKompi] = useState('all')
  const [bayarMid, setBayarMid] = useState(null)
  const [bayarAmount, setBayarAmount] = useState('')

  async function prosesBayarTunggakan(mid) {
    const amount = Number(bayarAmount)
    if (!amount || amount <= 0) { showToast('Masukkan jumlah pembayaran', 'error'); return }
    const memberPiutangs = piutangs
      .filter(p => p.memberId === mid && (Math.max(0, (p.total||0) - (p.totalBayar||0))) > 0 && p.status !== 'LUNAS')
      .sort((a, b) => (a.date||'').localeCompare(b.date||''))
    if (memberPiutangs.length === 0) { showToast('Tidak ada piutang untuk dibayar', 'error'); return }
    if (!confirm('Bayar tunggakan ' + formatRp(amount) + ' atas nama ' + (members.find(m => m.id === mid)?.name||'') + '?')) return
    let remaining = amount, paidCount = 0
    for (const p of memberPiutangs) {
      if (remaining <= 0) break
      const sisa = Math.max(0, (p.total||0) - (p.totalBayar||0))
      const bayar = Math.min(remaining, sisa)
      await bayarPiutang(p, bayar)
      remaining -= bayar
      paidCount++
    }
    showToast('Pembayaran ' + formatRp(amount) + ' berhasil — ' + paidCount + ' piutang diupdate')
    setBayarMid(null)
    setBayarAmount('')
  }

  const kompiList = [...new Set(members.map(m => m.kompi || 'LAINNYA'))].filter(Boolean).sort()

  // ============================================
  // HITUNG TAGIHAN & TUNGGAKAN
  // ============================================

  // 1. Kumpulkan semua piutang yang belum lunas (recalculate sisa dari total - totalBayar)
  const activePiutangs = piutangs.filter(p => {
    const sisa = Math.max(0, (p.total||0) - (p.totalBayar||0))
    return sisa > 0 && p.status !== 'LUNAS'
  }).map(p => ({
    ...p,
    sisa: Math.max(0, (p.total||0) - (p.totalBayar||0)) // recalculate, jangan pakai p.sisa yang mungkin salah
  }))

  // 2. Cari transaksi KREDIT yang TIDAK punya piutang (data lama)
  const piutangNotas = new Set(piutangs.map(p => p.noNota).filter(Boolean))
  const piutangMemberDates = new Set(piutangs.map(p => (p.memberId||'') + '_' + (p.date||'')))
  const orphanKredit = (transactions||[]).filter(t => {
    if (t.caraBayar !== 'KREDIT') return false
    if (t.noNota && piutangNotas.has(t.noNota)) return false // sudah ada piutang
    if (piutangMemberDates.has((t.memberId||'') + '_' + (t.date||''))) return false
    const sisa = (t.total||0) - (t.payment||0)
    return sisa > 0
  }).map(t => ({
    ...t,
    sisa: (t.total||0) - (t.payment||0)
  }))

  // 3. Gabungkan semua data kredit belum lunas
  const allUnpaid = [...activePiutangs, ...orphanKredit]

  // 4. Pisah tagihan bulan ini vs tunggakan
  const kreditPeriod = allUnpaid.filter(k => k.date >= startDate && k.date <= endDate)
  const tunggakanList = allUnpaid.filter(k => k.date < startDate)

  // 5. Group per kompi → per anggota
  const kompiData = {}

  function addToKompi(record, isTunggakan) {
    const member = members.find(m => m.id === record.memberId)
    const kompi = member?.kompi || 'NON-ANGGOTA'
    if (filterKompi !== 'all' && kompi !== filterKompi) return
    if (!kompiData[kompi]) kompiData[kompi] = {}
    const mid = record.memberId || 'umum'
    if (!kompiData[kompi][mid]) kompiData[kompi][mid] = {
      member, pangkat: member?.pangkat || '-', nrp: member?.nrp || '-',
      name: member?.name || record.customerName || 'Umum', items: [], totalTagihan: 0, totalTunggakan: 0, tunggakanItems: []
    }
    if (isTunggakan) {
      kompiData[kompi][mid].totalTunggakan += (record.sisa||0)
      kompiData[kompi][mid].tunggakanItems.push(record)
    } else {
      kompiData[kompi][mid].totalTagihan += (record.sisa||0)
      kompiData[kompi][mid].items.push(record)
    }
  }

  kreditPeriod.forEach(k => addToKompi(k, false))
  tunggakanList.forEach(k => addToKompi(k, true))

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
        <div style={S.statCard}><div style={S.statLabel}>Tagihan Bulan Ini</div><div style={{ ...S.statVal, color: '#1565c0' }}>{formatRp(Object.values(kompiData).reduce((a, m) => a + Object.values(m).reduce((b, x) => b + x.totalTagihan, 0), 0))}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Tunggakan Bulan Lalu</div><div style={{ ...S.statVal, color: '#c62828' }}>{formatRp(Object.values(kompiData).reduce((a, m) => a + Object.values(m).reduce((b, x) => b + x.totalTunggakan, 0), 0))}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Grand Total Potong</div><div style={{ ...S.statVal, color: '#2e7d32' }}>{formatRp(grandTotal)}</div><div style={{ fontSize: 11, color: '#999' }}>{Object.values(kompiData).reduce((a, m) => a + Object.keys(m).length, 0)} anggota</div></div>
      </div>
      {sortedKompi.map(kompi => {
        const anggotaList = Object.values(kompiData[kompi]).sort((a,b) => (a.name||'').localeCompare(b.name||''))
        return (
          <div key={kompi} style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1565c0', marginBottom: 12 }}>{kompi}</h3>
            <table style={S.table}>
              <thead><tr>{['No', 'Pangkat', 'Nama', 'NRP', 'Tagihan Bln Ini', 'Tunggakan', 'Total Potong', 'Bayar'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{anggotaList.map((m, i) => {
                const mid = Object.keys(kompiData[kompi]).find(k => kompiData[kompi][k] === m)
                const isBayar = bayarMid === mid
                return (
                <tr key={i} style={{ ...S.tr, background: isBayar ? '#fff3e0' : undefined }}>
                  <td style={S.td}>{i+1}</td><td style={S.td}>{m.pangkat}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{m.nrp}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{formatRp(m.totalTagihan)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: m.totalTunggakan > 0 ? '#c62828' : '#6b7280', fontWeight: m.totalTunggakan > 0 ? 700 : 400 }}>{formatRp(m.totalTunggakan)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(m.totalTagihan + m.totalTunggakan)}</td>
                  <td style={{ ...S.td, minWidth: isBayar ? 200 : 60 }}>
                    {(m.totalTunggakan > 0 || m.totalTagihan > 0) && !isBayar && (
                      <button style={{ fontSize: 11, padding: '4px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => { setBayarMid(mid); setBayarAmount('') }}>💰 Bayar</button>
                    )}
                    {isBayar && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input style={{ ...S.input, width: 100, fontSize: 12, padding: '4px 8px', textAlign: 'right' }} type="number" value={bayarAmount} onChange={e => setBayarAmount(e.target.value)} placeholder="Jumlah..." autoFocus />
                        <button style={{ fontSize: 11, padding: '4px 8px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => prosesBayarTunggakan(mid)}>✓</button>
                        <button style={{ fontSize: 11, padding: '4px 8px', background: '#999', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => setBayarMid(null)}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              )})}</tbody>
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
  const returnedNotas = new Set((transactions||[]).filter(t => t.caraBayar === 'RETURN' && t.returnFrom).map(t => t.returnFrom))

  // Hitung laba per anggota dari transaksi (buang RETURN & nota yang sudah diretur)
  const memberProfit = {}
  transactions.filter(t => (t.date||'').startsWith(yearStr) && t.caraBayar !== 'RETURN' && !t.returned && !returnedNotas.has(t.noNota)).forEach(tx => {
    const mid = tx.memberId || '_umum'
    if (!memberProfit[mid]) memberProfit[mid] = { totalBeli: 0, totalLaba: 0, txCount: 0 }
    memberProfit[mid].txCount++
    memberProfit[mid].totalBeli += (tx.total||0)

    // Hitung laba = harga jual - HPP. HPP pakai harga beli SAAT transaksi (it.buyPrice), fallback ke master untuk data lama
    ;(tx.items||[]).forEach(it => {
      const prod = products.find(p => p.id === it.productId)
      const hpp = (it.buyPrice != null ? it.buyPrice : (prod?.buyPrice||0)) * (it.qty||0)
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
