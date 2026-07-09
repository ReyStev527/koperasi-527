// =============================================
// MODUL KEUANGAN LANJUTAN
// Kas, Jurnal Umum, Laba Rugi, SHU, Kwitansi
// =============================================
import { useState, useRef } from 'react'
import { cetakLaporanPDF } from './Extra'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
function today() { 
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function monthName(m) { return ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][m] }

// Pisahkan pangkat dari nama. Kalau field pangkat kosong (data lama), ambil dari kata pertama nama bila cocok daftar pangkat TNI.
const RANKS_TNI = ['Jenderal','Letjen','Mayjen','Brigjen','Kolonel','Letkol','Mayor','Kapten','Lettu','Letda','Peltu','Pelda','Serma','Serka','Sertu','Serda','Kopka','Koptu','Kopda','Praka','Prakka','Prada','Tamtama','PNS','Honorer']
function splitPangkat(m) {
  const pkt = (m.pangkat || '').trim()
  const full = (m.name || '').trim()
  if (pkt) return { pangkat: pkt, nama: full }
  const parts = full.split(/\s+/)
  if (parts.length > 1 && RANKS_TNI.some(r => r.toLowerCase() === parts[0].toLowerCase())) {
    return { pangkat: parts[0], nama: parts.slice(1).join(' ') }
  }
  return { pangkat: '-', nama: full }
}

const IC = {
  plus: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  print: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  up: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  down: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
}

// Daftar akun standar koperasi
const AKUN = [
  { kode: '101', nama: 'Kas', tipe: 'aset' },
  { kode: '102', nama: 'Bank', tipe: 'aset' },
  { kode: '103', nama: 'Piutang Pinjaman', tipe: 'aset' },
  { kode: '104', nama: 'Persediaan Barang', tipe: 'aset' },
  { kode: '201', nama: 'Simpanan Anggota', tipe: 'kewajiban' },
  { kode: '202', nama: 'Hutang Usaha', tipe: 'kewajiban' },
  { kode: '301', nama: 'Modal / Simpanan Pokok', tipe: 'modal' },
  { kode: '401', nama: 'Pendapatan Bunga Pinjaman', tipe: 'pendapatan' },
  { kode: '402', nama: 'Pendapatan Penjualan Toko', tipe: 'pendapatan' },
  { kode: '403', nama: 'Pendapatan Lain-lain', tipe: 'pendapatan' },
  { kode: '501', nama: 'Harga Pokok Penjualan', tipe: 'beban' },
  { kode: '502', nama: 'Beban Operasional', tipe: 'beban' },
  { kode: '503', nama: 'Beban Administrasi', tipe: 'beban' },
  { kode: '504', nama: 'Beban Lain-lain', tipe: 'beban' },
]

// =============================================
// KAS MASUK / KELUAR
// =============================================
export function KasMasukKeluar({ kasData, saveKas, deleteKas, setModal, showToast, settings, user }) {
  const [filter, setFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const kasPin = settings?.kasPin || '527'

  function verifyPin() {
    if (pinInput === kasPin) {
      setUnlocked(true)
      setPinError('')
      setPinInput('')
    } else {
      setPinError('PIN salah! Coba lagi.')
      setPinInput('')
    }
  }

  // Fungsi yang memerlukan PIN
  function requirePin(action) {
    if (unlocked) { action(); return }
    setModal({
      title: '🔒 Masukkan PIN Kas',
      content: <PinPrompt kasPin={kasPin} onSuccess={() => { setUnlocked(true); setModal(null); action() }} onCancel={() => setModal(null)} />,
    })
  }

  let filtered = kasData
  if (filter !== 'all') filtered = filtered.filter(k => k.type === filter)
  if (monthFilter) filtered = filtered.filter(k => k.date.startsWith(monthFilter))
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const totalMasuk = kasData.filter(k => k.type === 'masuk').reduce((a, b) => a + (b.amount||0), 0)
  const totalKeluar = kasData.filter(k => k.type === 'keluar').reduce((a, b) => a + (b.amount||0), 0)
  const saldo = totalMasuk - totalKeluar

  function openForm(type) {
    requirePin(() => {
      setModal({
        title: type === 'masuk' ? 'Catat Kas Masuk' : 'Catat Kas Keluar',
        content: <KasForm type={type} onSave={async d => {
          await saveKas(d)
          setModal(null)
          showToast(type === 'masuk' ? 'Kas masuk dicatat' : 'Kas keluar dicatat')
        }} />,
      })
    })
  }

  function handleDelete(k) {
    requirePin(async () => {
      if (confirm('Hapus data kas ini?')) {
        await deleteKas(k.id)
        showToast('Dihapus', 'error')
      }
    })
  }

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Kas Masuk & Keluar</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unlocked ? (
            <span style={{ fontSize: 12, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Akses Terbuka
              <button style={{ ...S.smallBtn, fontSize: 11, color: '#c62828', marginLeft: 4 }} onClick={() => setUnlocked(false)}>Kunci</button>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: '#c62828', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Terkunci
            </span>
          )}
          <button style={{ ...S.primaryBtn, background: '#e65100' }} onClick={() => openForm('keluar')}>{IC.down} Kas Keluar</button>
          <button style={S.primaryBtn} onClick={() => openForm('masuk')}>{IC.up} Kas Masuk</button>
        </div>
      </div>

      <div style={S.grid4}>
        <div style={S.statCard}><div style={S.statLabel}>Total Kas Masuk</div><div style={{ ...S.statVal, color: 'var(--g)' }}>{formatRp(totalMasuk)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Total Kas Keluar</div><div style={{ ...S.statVal, color: 'var(--r)' }}>{formatRp(totalKeluar)}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Saldo Kas</div><div style={{ ...S.statVal, color: saldo >= 0 ? 'var(--b)' : 'var(--r)' }}>{formatRp(saldo)}</div></div>
      </div>

      <div style={S.toolbar}>
        <div style={S.filterGroup}>
          {[['all', 'Semua'], ['masuk', 'Kas Masuk'], ['keluar', 'Kas Keluar']].map(([k, l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input type="month" style={{ ...S.input, maxWidth: 180, padding: '6px 10px', fontSize: 13 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.map(k => (
              <tr key={k.id} style={S.tr}>
                <td style={S.td}>{fmtDate(k.date)}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, background: k.type === 'masuk' ? '#e8f5e9' : '#ffebee', color: k.type === 'masuk' ? '#2e7d32' : '#c62828' }}>
                    {k.type === 'masuk' ? '↑ Masuk' : '↓ Keluar'}
                  </span>
                </td>
                <td style={S.td}>{k.category}</td>
                <td style={S.td}>{k.note}</td>
                <td style={{ ...S.td, fontWeight: 600, color: k.type === 'masuk' ? 'var(--g)' : 'var(--r)' }}>
                  {k.type === 'masuk' ? '+ ' : '- '}{formatRp(k.amount)}
                </td>
                <td style={S.td}>
                  <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={() => handleDelete(k)}>{IC.trash}</button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KasForm({ type, onSave }) {
  const cats = type === 'masuk'
    ? ['Simpanan Anggota', 'Penjualan Toko', 'Angsuran Pinjaman', 'Pendapatan Bunga', 'Lain-lain']
    : ['Pembelian Barang', 'Gaji/Honor', 'Listrik/Air', 'Transport', 'Perlengkapan', 'Operasional', 'Lain-lain']
  const [d, setD] = useState({ type, date: today(), category: cats[0], amount: '', note: '' })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      <label style={S.formLabel}>Kategori
        <select style={S.input} value={d.category} onChange={e => set('category', e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label style={S.formLabel}>Jumlah (Rp)<input style={S.input} type="number" value={d.amount} onChange={e => set('amount', e.target.value)} /></label>
      <label style={S.formLabel}>Keterangan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave({ ...d, amount: Number(d.amount) })}>Simpan</button>
    </div>
  )
}

// =============================================
// PIN PROMPT UNTUK AKSES KAS
// =============================================
function PinPrompt({ kasPin, onSuccess, onCancel }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)

  function handleSubmit() {
    if (pin === kasPin) {
      onSuccess()
    } else {
      setAttempts(a => a + 1)
      setError('PIN salah! (' + (attempts + 1) + '/5 percobaan)')
      setPin('')
      if (attempts + 1 >= 5) {
        setError('Terlalu banyak percobaan. Hubungi admin.')
      }
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
        Masukkan PIN untuk mengakses Kas Masuk/Keluar.<br/>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Hanya Admin & Bendahara yang memiliki PIN</span>
      </p>
      {error && <div style={{ padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <input
        style={{ ...S.input, textAlign: 'center', fontSize: 24, letterSpacing: 8, maxWidth: 200, margin: '0 auto', fontWeight: 700 }}
        type="password"
        value={pin}
        onChange={e => setPin(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && pin && attempts < 5) handleSubmit() }}
        placeholder="• • •"
        autoFocus
        disabled={attempts >= 5}
        maxLength={20}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button style={{ ...S.filterBtn, padding: '8px 20px' }} onClick={onCancel}>Batal</button>
        <button style={{ ...S.primaryBtn, padding: '8px 24px' }} onClick={handleSubmit} disabled={!pin || attempts >= 5}>Buka Kunci</button>
      </div>
    </div>
  )
}

// =============================================
// JURNAL UMUM
// =============================================
export function JurnalUmum({ jurnalData, saveJurnal, deleteJurnal, setModal, showToast }) {
  const [monthFilter, setMonthFilter] = useState('')

  let filtered = jurnalData
  if (monthFilter) filtered = filtered.filter(j => j.date.startsWith(monthFilter))
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  function openForm() {
    setModal({
      title: 'Buat Jurnal Baru',
      content: <JurnalForm onSave={async d => {
        await saveJurnal(d)
        setModal(null)
        showToast('Jurnal berhasil dicatat')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Jurnal Umum</h2>
        <button style={S.primaryBtn} onClick={openForm}>{IC.plus} Buat Jurnal</button>
      </div>

      <div style={S.toolbar}>
        <input type="month" style={{ ...S.input, maxWidth: 180, padding: '6px 10px', fontSize: 13 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} placeholder="Filter bulan" />
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.map(j => (
              j.entries.map((e, i) => (
                <tr key={j.id + '-' + i} style={{ ...S.tr, ...(i === 0 ? { borderTop: '2px solid var(--border)' } : {}) }}>
                  {i === 0 && <td style={S.td} rowSpan={j.entries.length}>{fmtDate(j.date)}</td>}
                  {i === 0 && <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }} rowSpan={j.entries.length}>{j.bukti}</td>}
                  {i === 0 && (
                    <td style={S.td} rowSpan={j.entries.length}>
                      {j.note}
                      <button style={{ ...S.smallBtn, color: 'var(--r)', marginLeft: 8 }} onClick={async () => { if (confirm('Hapus jurnal?')) { await deleteJurnal(j.id); showToast('Dihapus', 'error') } }}>{IC.trash}</button>
                    </td>
                  )}
                  <td style={{ ...S.td, paddingLeft: e.type === 'kredit' ? 28 : 12 }}>
                    {AKUN.find(a => a.kode === e.akun)?.nama || e.akun}
                  </td>
                  <td style={{ ...S.td, fontWeight: 600, color: 'var(--b)' }}>{e.type === 'debit' ? formatRp(e.amount) : ''}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: 'var(--g)' }}>{e.type === 'kredit' ? formatRp(e.amount) : ''}</td>
                </tr>
              ))
            ))}
            {sorted.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Belum ada jurnal</td></tr>}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f5f6fa' }}>
                <td colSpan={4} style={{ ...S.td, fontWeight: 700, textAlign: 'right' }}>TOTAL</td>
                <td style={{ ...S.td, fontWeight: 700, color: 'var(--b)' }}>{formatRp(sorted.reduce((a, j) => a + (j.entries||[]).filter(e => e.type === 'debit').reduce((s, e) => s + (e.amount||0), 0), 0))}</td>
                <td style={{ ...S.td, fontWeight: 700, color: 'var(--g)' }}>{formatRp(sorted.reduce((a, j) => a + (j.entries||[]).filter(e => e.type === 'kredit').reduce((s, e) => s + (e.amount||0), 0), 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function JurnalForm({ onSave }) {
  const [date, setDate] = useState(today())
  const [bukti, setBukti] = useState('JU-' + Date.now().toString().slice(-6))
  const [note, setNote] = useState('')
  const [entries, setEntries] = useState([
    { akun: '101', type: 'debit', amount: '' },
    { akun: '401', type: 'kredit', amount: '' },
  ])

  function updateEntry(i, k, v) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))
  }
  function addEntry() { setEntries(prev => [...prev, { akun: '101', type: 'debit', amount: '' }]) }
  function removeEntry(i) { if (entries.length > 2) setEntries(prev => prev.filter((_, idx) => idx !== i)) }

  const totalDebit = entries.filter(e => e.type === 'debit').reduce((a, e) => a + Number(e.amount || 0), 0)
  const totalKredit = entries.filter(e => e.type === 'kredit').reduce((a, e) => a + Number(e.amount || 0), 0)
  const balanced = totalDebit === totalKredit && totalDebit > 0

  return (
    <div style={S.form}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={S.formLabel}>No. Bukti<input style={S.input} value={bukti} onChange={e => setBukti(e.target.value)} /></label>
      </div>
      <label style={S.formLabel}>Keterangan<input style={S.input} value={note} onChange={e => setNote(e.target.value)} /></label>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginTop: 8 }}>Entri Jurnal</div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <label style={S.formLabel}>Akun
            <select style={S.input} value={e.akun} onChange={ev => updateEntry(i, 'akun', ev.target.value)}>
              {AKUN.map(a => <option key={a.kode} value={a.kode}>{a.kode} - {a.nama}</option>)}
            </select>
          </label>
          <label style={S.formLabel}>D/K
            <select style={S.input} value={e.type} onChange={ev => updateEntry(i, 'type', ev.target.value)}>
              <option value="debit">Debit</option>
              <option value="kredit">Kredit</option>
            </select>
          </label>
          <label style={S.formLabel}>Jumlah<input style={S.input} type="number" value={e.amount} onChange={ev => updateEntry(i, 'amount', ev.target.value)} /></label>
          {entries.length > 2 && <button style={{ ...S.smallBtn, color: 'var(--r)', marginBottom: 4 }} onClick={() => removeEntry(i)}>{IC.x}</button>}
        </div>
      ))}
      <button style={{ ...S.filterBtn, width: '100%' }} onClick={addEntry}>{IC.plus} Tambah Baris</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px', background: balanced ? '#e8f5e9' : '#ffebee', borderRadius: 8, fontSize: 13 }}>
        <div>Debit: <strong style={{ color: 'var(--b)' }}>{formatRp(totalDebit)}</strong></div>
        <div>Kredit: <strong style={{ color: 'var(--g)' }}>{formatRp(totalKredit)}</strong></div>
      </div>
      {!balanced && <div style={{ fontSize: 12, color: 'var(--r)' }}>Debit dan kredit harus seimbang</div>}

      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 4 }} disabled={!balanced}
        onClick={() => onSave({ date, bukti, note, entries: entries.map(e => ({ ...e, amount: Number(e.amount) })) })}>
        Simpan Jurnal
      </button>
    </div>
  )
}

// =============================================
// LAPORAN LABA RUGI
// =============================================
export function LabaRugi({ kasData, transactions, loans, products, settings }) {
  const [period, setPeriod] = useState(today().slice(0, 7)) // YYYY-MM

  const monthKas = kasData.filter(k => k.date.startsWith(period))
  const returnedNotas = new Set((transactions||[]).filter(t => t.caraBayar === "RETURN" && t.returnFrom).map(t => t.returnFrom))
  const monthTx = transactions.filter(t => t.date.startsWith(period) && !t.returned && !returnedNotas.has(t.noNota))
  const monthLoans = loans.flatMap(l => (l.installments||[]).filter(i => i.date.startsWith(period)))

  // Split transaksi tunai vs kredit (EXCLUDE return)
  const txTunai = monthTx.filter(t => t.caraBayar !== 'KREDIT' && t.caraBayar !== 'RETURN' && !t.returned)
  const txKredit = monthTx.filter(t => t.caraBayar === 'KREDIT' && !t.returned)
  const txReturn = monthTx.filter(t => t.caraBayar === 'RETURN')
  const totalReturn = txReturn.reduce((a, t) => a + Math.abs(t.total||0), 0)

  // Fungsi hitung HPP per list transaksi
  function hitungHpp(txList) {
    return txList.reduce((a, t) => {
      return a + (t.items||[]).reduce((s, it) => {
        const prod = products.find(p => p.id === it.productId)
        return s + ((it.buyPrice != null ? it.buyPrice : (prod?.buyPrice || 0)) * (it.qty||0))
      }, 0)
    }, 0)
  }

  // Pendapatan TUNAI
  const penjualanTunai = txTunai.reduce((a, t) => a + (t.total||0), 0)
  const hppTunai = hitungHpp(txTunai)
  const labaKotorTunai = penjualanTunai - hppTunai

  // Pendapatan KREDIT
  const penjualanKredit = txKredit.reduce((a, t) => a + (t.total||0), 0)
  const hppKredit = hitungHpp(txKredit)
  const labaKotorKredit = penjualanKredit - hppKredit
  const sisaPiutang = txKredit.reduce((a, t) => a + ((t.total||0) - (t.payment||0)), 0)
  const sudahDibayar = txKredit.reduce((a, t) => a + (t.payment||0), 0)

  // Total
  const pendapatanToko = penjualanTunai + penjualanKredit
  const hpp = hppTunai + hppKredit
  const labaKotor = labaKotorTunai + labaKotorKredit
  const pendapatanBunga = monthLoans.reduce((a, i) => a + (i.interest||0), 0)
  const pendapatanLain = monthKas.filter(k => k.type === 'masuk' && k.category === 'Lain-lain').reduce((a, k) => a + (k.amount||0), 0)
  const totalPendapatan = labaKotor + pendapatanBunga + pendapatanLain

  // Beban
  const bebanOps = monthKas.filter(k => k.type === 'keluar' && ['Gaji/Honor', 'Listrik/Air', 'Transport', 'Operasional'].includes(k.category)).reduce((a, k) => a + (k.amount||0), 0)
  const bebanAdmin = monthKas.filter(k => k.type === 'keluar' && k.category === 'Perlengkapan').reduce((a, k) => a + (k.amount||0), 0)
  const bebanLain = monthKas.filter(k => k.type === 'keluar' && k.category === 'Lain-lain').reduce((a, k) => a + (k.amount||0), 0)
  const totalBeban = bebanOps + bebanAdmin + bebanLain

  const labaBersih = totalPendapatan - totalBeban
  const labaBersihTunai = labaKotorTunai - totalBeban // beban ditanggung tunai
  const labaBersihKredit = labaKotorKredit // kredit belum kena beban

  const [y, m] = period.split('-').map(Number)

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Laporan Laba Rugi</h2>
        <input type="month" style={{ ...S.input, maxWidth: 180, padding: '8px 12px' }} value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      {/* Ringkasan Tunai vs Kredit */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200, ...S.card, padding: 16, borderLeft: '4px solid #2e7d32' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>💵 LABA TUNAI</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2e7d32' }}>{formatRp(labaKotorTunai)}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Penjualan: {formatRp(penjualanTunai)} — HPP: {formatRp(hppTunai)}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{txTunai.length} transaksi tunai</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, ...S.card, padding: 16, borderLeft: '4px solid #e65100' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📋 LABA KREDIT</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e65100' }}>{formatRp(labaKotorKredit)}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Penjualan: {formatRp(penjualanKredit)} — HPP: {formatRp(hppKredit)}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{txKredit.length} transaksi kredit</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, ...S.card, padding: 16, borderLeft: '4px solid #c62828' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏳ PIUTANG KREDIT</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#c62828' }}>{formatRp(sisaPiutang)}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Sudah bayar: {formatRp(sudahDibayar)}</div>
          <div style={{ fontSize: 11, color: '#999' }}>Belum terbayar dari {txKredit.length} nota</div>
        </div>
      </div>

      <div style={{ ...S.card, maxWidth: 700 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{settings.name}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>LAPORAN LABA RUGI</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Periode: {monthName(m - 1)} {y}</div>
        </div>

        <table style={{ ...S.table, fontSize: 14 }}>
          <tbody>
            <tr style={{ background: '#f0f7ff' }}><td style={{ ...S.td, fontWeight: 700, color: 'var(--b)' }} colSpan={2}>PENDAPATAN</td></tr>

            {/* Penjualan Tunai */}
            <tr style={{ background: '#f8fff8' }}><td style={{ ...S.td, fontWeight: 600, color: '#2e7d32' }} colSpan={2}>Penjualan Tunai ({txTunai.length} transaksi)</td></tr>
            <tr style={S.tr}><td style={{ ...S.td, paddingLeft: 24 }}>Penjualan</td><td style={R}>{formatRp(penjualanTunai)}</td></tr>
            <tr style={S.tr}><td style={{ ...S.td, paddingLeft: 24 }}>HPP Tunai</td><td style={{ ...R, color: 'var(--r)' }}>({formatRp(hppTunai)})</td></tr>
            <tr style={{ ...S.tr, background: '#e8f5e9' }}><td style={{ ...S.td, paddingLeft: 24, fontWeight: 600 }}>Laba Kotor Tunai</td><td style={{ ...R, fontWeight: 700, color: '#2e7d32' }}>{formatRp(labaKotorTunai)}</td></tr>

            {/* Penjualan Kredit */}
            <tr style={{ background: '#fff8f0' }}><td style={{ ...S.td, fontWeight: 600, color: '#e65100' }} colSpan={2}>Penjualan Kredit ({txKredit.length} transaksi)</td></tr>
            <tr style={S.tr}><td style={{ ...S.td, paddingLeft: 24 }}>Penjualan</td><td style={R}>{formatRp(penjualanKredit)}</td></tr>
            <tr style={S.tr}><td style={{ ...S.td, paddingLeft: 24 }}>HPP Kredit</td><td style={{ ...R, color: 'var(--r)' }}>({formatRp(hppKredit)})</td></tr>
            <tr style={{ ...S.tr, background: '#fff3e0' }}><td style={{ ...S.td, paddingLeft: 24, fontWeight: 600 }}>Laba Kotor Kredit</td><td style={{ ...R, fontWeight: 700, color: '#e65100' }}>{formatRp(labaKotorKredit)}</td></tr>
            <tr style={S.tr}><td style={{ ...S.td, paddingLeft: 24, fontSize: 12, color: '#c62828' }}>Sisa Piutang (belum terbayar)</td><td style={{ ...R, fontSize: 12, color: '#c62828' }}>{formatRp(sisaPiutang)}</td></tr>

            <tr><td style={{ padding: 4 }} colSpan={2}></td></tr>

            {/* Total Gabungan */}
            <tr style={{ background: '#e3f2fd' }}><td style={{ ...S.td, fontWeight: 700 }}>Total Penjualan (Tunai + Kredit)</td><td style={{ ...R, fontWeight: 600 }}>{formatRp(pendapatanToko)}</td></tr>
            <tr style={S.tr}><td style={S.td}>Total HPP</td><td style={{ ...R, color: 'var(--r)' }}>({formatRp(hpp)})</td></tr>
            <tr style={{ ...S.tr, background: '#fafafa' }}><td style={{ ...S.td, fontWeight: 600 }}>Total Laba Kotor Toko</td><td style={{ ...R, fontWeight: 600 }}>{formatRp(labaKotor)}</td></tr>
            <tr style={S.tr}><td style={S.td}>Pendapatan Bunga Pinjaman</td><td style={R}>{formatRp(pendapatanBunga)}</td></tr>
            <tr style={S.tr}><td style={S.td}>Pendapatan Lain-lain</td><td style={R}>{formatRp(pendapatanLain)}</td></tr>
            <tr style={{ ...S.tr, background: '#e8f5e9' }}><td style={{ ...S.td, fontWeight: 700 }}>Total Pendapatan</td><td style={{ ...R, fontWeight: 700, color: 'var(--g)' }}>{formatRp(totalPendapatan)}</td></tr>

            <tr><td style={{ padding: 8 }} colSpan={2}></td></tr>

            <tr style={{ background: '#fff3e0' }}><td style={{ ...S.td, fontWeight: 700, color: 'var(--o)' }} colSpan={2}>BEBAN</td></tr>
            <tr style={S.tr}><td style={S.td}>Beban Operasional (Gaji, Listrik, Transport)</td><td style={R}>{formatRp(bebanOps)}</td></tr>
            <tr style={S.tr}><td style={S.td}>Beban Administrasi / Perlengkapan</td><td style={R}>{formatRp(bebanAdmin)}</td></tr>
            <tr style={S.tr}><td style={S.td}>Beban Lain-lain</td><td style={R}>{formatRp(bebanLain)}</td></tr>
            <tr style={{ ...S.tr, background: '#ffebee' }}><td style={{ ...S.td, fontWeight: 700 }}>Total Beban</td><td style={{ ...R, fontWeight: 700, color: 'var(--r)' }}>{formatRp(totalBeban)}</td></tr>

            <tr><td style={{ padding: 8 }} colSpan={2}></td></tr>

            <tr style={{ background: labaBersih >= 0 ? '#e8f5e9' : '#ffebee' }}>
              <td style={{ ...S.td, fontWeight: 700, fontSize: 16 }}>LABA (RUGI) BERSIH</td>
              <td style={{ ...R, fontWeight: 700, fontSize: 16, color: labaBersih >= 0 ? 'var(--g)' : 'var(--r)' }}>{formatRp(labaBersih)}</td>
            </tr>
          </tbody>
        </table>

        <button style={{ ...S.primaryBtn, width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={() => window.print()}>
          {IC.print} Cetak Laporan
        </button>
      </div>
    </div>
  )
}

const R = { ...{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }, textAlign: 'right' }

// =============================================
// PERHITUNGAN SHU
// =============================================
export function HitungSHU({ members, savings, loans, transactions, kasData, products, settings }) {
  const [year, setYear] = useState(new Date().getFullYear())

  const yearStr = String(year)
  const yearKas = kasData.filter(k => k.date.startsWith(yearStr))
  const returnedNotasSHU = new Set((transactions||[]).filter(t => t.caraBayar === 'RETURN' && t.returnFrom).map(t => t.returnFrom))
  const yearTx = transactions.filter(t => t.date.startsWith(yearStr) && !t.returned && !returnedNotasSHU.has(t.noNota))
  const yearInstallments = loans.flatMap(l => (l.installments||[]).filter(i => i.date.startsWith(yearStr)))

  // Pendapatan tahunan (EXCLUDE return)
  const yearTxSales = yearTx.filter(t => t.caraBayar !== 'RETURN' && !t.returned)
  const yearTxReturn = yearTx.filter(t => t.caraBayar === 'RETURN')
  const pendapatanToko = yearTxSales.reduce((a, t) => a + (t.total||0), 0)
  const hpp = yearTxSales.reduce((a, t) => a + (t.items||[]).reduce((s, it) => { const p = products.find(pr => pr.id === it.productId); return s + ((it.buyPrice != null ? it.buyPrice : (p?.buyPrice || 0)) * (it.qty||0)) }, 0), 0)
  const totalReturnYear = yearTxReturn.reduce((a, t) => a + Math.abs(t.total||0), 0)
  // Nota yang diretur sudah dibuang dari pendapatanToko & hpp (filter !t.returned di atas) → jangan potong retur 2x
  const labaKotorToko = pendapatanToko - hpp
  const pendapatanBunga = yearInstallments.reduce((a, i) => a + (i.interest||0), 0)
  const pendapatanLain = yearKas.filter(k => k.type === 'masuk' && k.category === 'Lain-lain').reduce((a, k) => a + (k.amount||0), 0)

  // Beban operasional saja — JANGAN masukkan Pembelian Barang / Pembayaran Hutang (biaya stok sudah dihitung di HPP, bukan beban)
  const totalBeban = yearKas.filter(k => k.type === 'keluar'
    && !['Pembelian Barang', 'Pembayaran Hutang', 'Pembayaran Piutang'].includes(k.category))
    .reduce((a, k) => a + (k.amount||0), 0)
  const shuTotal = labaKotorToko + pendapatanBunga + pendapatanLain - totalBeban

  // Distribusi SHU standar koperasi
  const distribusi = [
    { label: 'Cadangan Koperasi', pct: 25 },
    { label: 'Jasa Anggota (Simpanan)', pct: 25 },
    { label: 'Jasa Anggota (Transaksi)', pct: 25 },
    { label: 'Dana Pengurus', pct: 10 },
    { label: 'Dana Pendidikan', pct: 5 },
    { label: 'Dana Sosial', pct: 5 },
    { label: 'Dana Pembangunan', pct: 5 },
  ]

  // Hitung SHU per anggota
  const activeMembers = members.filter(m => m.status === 'active')
  const totalSimpananAll = activeMembers.reduce((a, m) => a + savings.filter(s => s.memberId === m.id).reduce((s, sv) => s + (sv.amount||0), 0), 0)
  const totalTxAll = activeMembers.reduce((a, m) => a + yearTxSales.filter(t => t.memberId === m.id).reduce((s, t) => s + (t.total||0), 0), 0)

  const shuJasaSimpanan = shuTotal * 0.25
  const shuJasaTx = shuTotal * 0.25

  const perMember = activeMembers.map(m => {
    const simpananM = savings.filter(s => s.memberId === m.id).reduce((a, s) => a + (s.amount||0), 0)
    const txM = yearTxSales.filter(t => t.memberId === m.id).reduce((a, t) => a + (t.total||0), 0)
    const jasaSimpanan = totalSimpananAll > 0 ? (simpananM / totalSimpananAll) * shuJasaSimpanan : 0
    const jasaTx = totalTxAll > 0 ? (txM / totalTxAll) * shuJasaTx : 0
    const sp = splitPangkat(m)
    return { ...m, pkt: sp.pangkat, nm: sp.nama, simpanan: simpananM, transaksi: txM, jasaSimpanan, jasaTx, totalSHU: jasaSimpanan + jasaTx }
  }).sort((a, b) => b.totalSHU - a.totalSHU)

  // Anggota yang dapat SHU (untuk daftar pembagian ke Juru Bayar)
  const penerimaSHU = perMember.filter(m => Math.round(m.totalSHU) > 0)
  const totalDibagi = penerimaSHU.reduce((a, m) => a + Math.round(m.totalSHU), 0)

  function cetakDaftarSHU() {
    if (penerimaSHU.length === 0) {
      alert('Belum ada anggota dengan SHU untuk dibagikan.\nTotal SHU tahun ' + year + ': ' + formatRp(Math.round(shuTotal)) + (shuTotal <= 0 ? '\n(SHU tidak positif — tidak ada yang dibagikan)' : ''))
      return
    }
    // Kelompokkan per kompi
    const byKompi = {}
    penerimaSHU.forEach(m => { const k = (m.kompi || 'LAINNYA'); (byKompi[k] = byKompi[k] || []).push(m) })
    const kompiOrder = Object.keys(byKompi).sort()
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><style>
      @page{margin:12mm;size:A4 landscape}body{font-family:Arial;font-size:11px;color:#000}
      h1{font-size:16px;text-align:center;margin:0}
      h2{font-size:13px;text-align:center;color:#444;margin:4px 0 2px}
      h3{font-size:12px;margin:14px 0 6px;padding:4px 8px;background:#1565c0;color:#fff;border-radius:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#f0f2f5;padding:5px 6px;border:1px solid #999;font-size:10px}
      td{padding:4px 6px;border:1px solid #999;font-size:10px}
      .r{text-align:right}.c{text-align:center}.b{font-weight:bold}
      .sub td{background:#f5f6fa;font-weight:bold}
      .grand td{background:#1565c0;color:#fff;font-weight:bold;font-size:11px}
      .sign{display:flex;justify-content:space-around;margin-top:30px;font-size:11px;text-align:center}
      .sign div{width:30%}.sign .sp{height:52px}
      .foot{text-align:center;font-size:9px;color:#888;margin-top:14px}
      @media print{button{display:none}}
    </style></head><body>
      <h1>${settings?.name || 'KOPERASI YONIF 527/BY'}</h1>
      <h2>DAFTAR PEMBAGIAN SISA HASIL USAHA (SHU) TAHUN ${year}</h2>
      <div class="c" style="font-size:10px;margin-bottom:8px">Total dibagikan: <b>${formatRp(totalDibagi)}</b> untuk ${penerimaSHU.length} anggota</div>
      ${kompiOrder.map(kompi => {
        const list = byKompi[kompi].slice().sort((a,b) => (a.nm||'').localeCompare(b.nm||''))
        const subtotal = list.reduce((a, m) => a + Math.round(m.totalSHU), 0)
        return '<h3>' + kompi + ' (' + list.length + ' anggota)</h3>' +
          '<table><tr><th style="width:26px">No</th><th style="width:58px">Pangkat</th><th>Nama</th><th style="width:120px">NRP</th><th class="r" style="width:88px">SHU Simpanan</th><th class="r" style="width:80px">SHU Usaha</th><th class="r" style="width:96px">Total SHU</th><th class="c" style="width:200px">Tanda Tangan</th></tr>' +
          list.map((m, i) => '<tr><td class="c">'+(i+1)+'</td><td>'+m.pkt+'</td><td class="b">'+m.nm+'</td><td>'+(m.nrp||'-')+'</td><td class="r">'+Number(Math.round(m.jasaSimpanan)).toLocaleString('id-ID')+'</td><td class="r">'+Number(Math.round(m.jasaTx)).toLocaleString('id-ID')+'</td><td class="r b">'+Number(Math.round(m.totalSHU)).toLocaleString('id-ID')+'</td><td></td></tr>').join('') +
          '<tr class="sub"><td colspan="6" class="r">Subtotal '+kompi+'</td><td class="r">'+Number(subtotal).toLocaleString('id-ID')+'</td><td></td></tr></table>'
      }).join('')}
      <table><tr class="grand"><td colspan="6" class="r">GRAND TOTAL SHU DIBAGIKAN</td><td class="r">Rp ${Number(totalDibagi).toLocaleString('id-ID')}</td><td></td></tr></table>
      <div class="sign">
        <div>Mengetahui,<br>Ketua Koperasi<div class="sp"></div>(______________________)</div>
        <div>Bendahara<div class="sp"></div>(______________________)</div>
        <div>Juru Bayar<div class="sp"></div>(______________________)</div>
      </div>
      <div class="foot">Dicetak: ${new Date().toLocaleString('id-ID')} — Kolom Tanda Tangan diisi saat SHU diterima anggota</div>
      <script>setTimeout(()=>{window.print()},500)<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Perhitungan SHU</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Tahun:</span>
          <select style={{ ...S.input, width: 100, padding: '6px 10px' }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Ringkasan SHU */}
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Ringkasan SHU {year}</h3>
          <div style={{ padding: '16px', background: shuTotal >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: 10, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total SHU</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: shuTotal >= 0 ? 'var(--g)' : 'var(--r)' }}>{formatRp(Math.round(shuTotal))}</div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Sumber Pendapatan</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {[['Laba Kotor Toko', labaKotorToko, 'var(--g)'], ['Pendapatan Bunga', pendapatanBunga, 'var(--b)'], ['Pendapatan Lain', pendapatanLain, 'var(--p)'], ['Total Beban', -totalBeban, 'var(--r)']].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{l}</span><span style={{ fontWeight: 600, color: c }}>{formatRp(Math.round(v))}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Distribusi SHU</div>
          {distribusi.map(d => (
            <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
              <span>{d.label} ({d.pct}%)</span>
              <span style={{ fontWeight: 600 }}>{formatRp(Math.round(shuTotal * d.pct / 100))}</span>
            </div>
          ))}
        </div>

        {/* SHU Per Anggota */}
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>SHU Per Anggota</h3>
          <table style={S.table}>
            <thead><tr>{['Pangkat', 'Nama', 'Simpanan', 'Belanja', 'Jasa Simp.', 'Jasa Tx', 'Total SHU'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{perMember.map(m => (
              <tr key={m.id} style={S.tr}>
                <td style={{ ...S.td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{m.pkt}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{m.nm}</td>
                <td style={S.td}>{formatRp(m.simpanan)}</td>
                <td style={S.td}>{formatRp(m.transaksi)}</td>
                <td style={{ ...S.td, color: 'var(--b)' }}>{formatRp(Math.round(m.jasaSimpanan))}</td>
                <td style={{ ...S.td, color: 'var(--p)' }}>{formatRp(Math.round(m.jasaTx))}</td>
                <td style={{ ...S.td, fontWeight: 700, color: 'var(--g)' }}>{formatRp(Math.round(m.totalSHU))}</td>
              </tr>
            ))}</tbody>
          </table>
          <button style={{ ...S.primaryBtn, width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={cetakDaftarSHU}>
            {IC.print} Cetak Daftar Pembagian SHU (Juyar) — {penerimaSHU.length} anggota
          </button>
          <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8, justifyContent: 'center', background: '#6b7280' }} onClick={() => window.print()}>
            {IC.print} Cetak Halaman Ini
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// CETAK KWITANSI
// =============================================
export function CetakKwitansi({ transactions, savings, loans, members, getMember, settings, setModal }) {
  const [tab, setTab] = useState('penjualan')

  const allReceipts = []
  // Dari transaksi penjualan
  transactions.forEach(t => allReceipts.push({ id: t.id, date: t.date, type: 'penjualan', memberId: t.memberId, amount: t.total, detail: t }))
  // Dari simpanan
  savings.forEach(s => { if (s.amount > 0) allReceipts.push({ id: s.id, date: s.date, type: 'simpanan', memberId: s.memberId, amount: s.amount, detail: s }) })
  // Dari angsuran pinjaman
  loans.forEach(l => l.installments.forEach((inst, i) => allReceipts.push({ id: l.id + '-' + i, date: inst.date, type: 'angsuran', memberId: l.memberId, amount: inst.amount, detail: { ...inst, loanId: l.id, loanAmount: l.amount } })))

  let filtered = allReceipts
  if (tab !== 'semua') filtered = filtered.filter(r => r.type === tab)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50)

  function openReceipt(receipt) {
    const member = getMember(receipt.memberId)
    setModal({
      title: 'Kwitansi',
      content: <ReceiptView receipt={receipt} member={member} settings={settings} />,
    })
  }

  return (
    <div>
      <h2 style={S.title}>Cetak Kwitansi</h2>

      <div style={S.toolbar}>
        <div style={S.filterGroup}>
          {[['semua', 'Semua'], ['penjualan', 'Penjualan'], ['simpanan', 'Simpanan'], ['angsuran', 'Angsuran']].map(([k, l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(tab === k ? S.filterActive : {}) }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'Tipe', 'Anggota', 'Jumlah', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(r => {
            const m = getMember(r.memberId)
            return (
              <tr key={r.id} style={S.tr}>
                <td style={S.td}>{fmtDate(r.date)}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, ...receiptBadge(r.type) }}>{r.type}</span>
                </td>
                <td style={S.td}>{m?.name || 'Umum'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{formatRp(r.amount)}</td>
                <td style={S.td}>
                  <button style={{ ...S.smallBtn, color: 'var(--b)', fontWeight: 600, fontSize: 12 }} onClick={() => openReceipt(r)}>
                    {IC.print} Cetak
                  </button>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function ReceiptView({ receipt, member, settings }) {
  const receiptRef = useRef()

  function handlePrint() {
    const content = receiptRef.current
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(`<html><head><title>Kwitansi</title><style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'DM Sans',sans-serif; }
      body { padding:20px; font-size:13px; }
      .center { text-align:center; }
      .bold { font-weight:700; }
      .line { border-bottom:1px dashed #999; margin:8px 0; }
      table { width:100%; border-collapse:collapse; }
      td { padding:4px 0; }
      .right { text-align:right; }
    </style></head><body>${content.innerHTML}</body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <div ref={receiptRef} style={{ padding: 20, background: '#fff', border: '1px dashed #ccc', borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{settings.name}</div>
          <div style={{ fontSize: 11, color: '#666' }}>Baladibya Yudha</div>
          <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }}></div>
          <div style={{ fontWeight: 700 }}>KWITANSI</div>
        </div>

        <table style={{ width: '100%', fontSize: 12 }}>
          <tbody>
            <tr><td>No</td><td style={{ textAlign: 'right' }}>{String(receipt.id||'').toUpperCase()}</td></tr>
            <tr><td>Tanggal</td><td style={{ textAlign: 'right' }}>{fmtDate(receipt.date)}</td></tr>
            <tr><td>Diterima dari</td><td style={{ textAlign: 'right' }}>{member?.name || 'Umum'}</td></tr>
            <tr><td>Tipe</td><td style={{ textAlign: 'right', textTransform: 'capitalize' }}>{receipt.type}</td></tr>
          </tbody>
        </table>

        <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }}></div>

        {receipt.type === 'penjualan' && receipt.detail.items && (
          <table style={{ width: '100%', fontSize: 12, marginBottom: 8 }}>
            <tbody>
              {receipt.detail.items.map((it, i) => (
                <tr key={i}><td>{it.name} × {it.qty}</td><td style={{ textAlign: 'right' }}>{formatRp(it.price * it.qty)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {receipt.type === 'simpanan' && (
          <table style={{ width: '100%', fontSize: 12, marginBottom: 8 }}>
            <tbody>
              <tr><td>Jenis Simpanan</td><td style={{ textAlign: 'right', textTransform: 'capitalize' }}>{receipt.detail.type}</td></tr>
              <tr><td>Catatan</td><td style={{ textAlign: 'right' }}>{receipt.detail.note || '-'}</td></tr>
            </tbody>
          </table>
        )}

        {receipt.type === 'angsuran' && (
          <table style={{ width: '100%', fontSize: 12, marginBottom: 8 }}>
            <tbody>
              <tr><td>Pinjaman</td><td style={{ textAlign: 'right' }}>{formatRp(receipt.detail.loanAmount)}</td></tr>
              <tr><td>Pokok</td><td style={{ textAlign: 'right' }}>{formatRp(receipt.detail.principal)}</td></tr>
              <tr><td>Bunga</td><td style={{ textAlign: 'right' }}>{formatRp(receipt.detail.interest)}</td></tr>
            </tbody>
          </table>
        )}

        <div style={{ borderBottom: '1px dashed #999', margin: '8px 0' }}></div>

        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ fontWeight: 700 }}>TOTAL</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRp(receipt.amount)}</td></tr>
          </tbody>
        </table>

        {receipt.type === 'penjualan' && receipt.detail.payment && (
          <table style={{ width: '100%', fontSize: 12, marginTop: 4 }}>
            <tbody>
              <tr><td>Bayar</td><td style={{ textAlign: 'right' }}>{formatRp(receipt.detail.payment)}</td></tr>
              <tr><td>Kembali</td><td style={{ textAlign: 'right' }}>{formatRp(receipt.detail.change)}</td></tr>
            </tbody>
          </table>
        )}

        <div style={{ borderBottom: '1px dashed #999', margin: '12px 0' }}></div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#999' }}>Terima kasih atas kerjasama Anda</div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#bbb', marginTop: 4 }}>{settings.name}</div>
      </div>

      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={handlePrint}>
        {IC.print} Cetak Kwitansi
      </button>
    </div>
  )
}

function receiptBadge(type) {
  if (type === 'penjualan') return { background: '#e3f2fd', color: '#1565c0' }
  if (type === 'simpanan') return { background: '#e8f5e9', color: '#2e7d32' }
  if (type === 'angsuran') return { background: '#fff3e0', color: '#e65100' }
  return { background: '#f5f5f5', color: '#616161' }
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
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  smallBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280', display: 'inline-flex', borderRadius: 4 },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: { padding: '6px 14px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  filterActive: { background: '#1565c0', color: '#fff', borderColor: '#1565c0' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#6b7280' },
  input: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' },
  empty: { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },
}
