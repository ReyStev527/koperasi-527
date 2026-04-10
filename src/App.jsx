import { useState, useEffect, useCallback } from 'react'
import { db } from './firebase'
import {
  getAll, getOne, setOne, addOne, removeOne, listenCollection, seedIfEmpty, seedInventoryIfEmpty, batchSet
} from './db'
import { Products, Suppliers, StockIn, POS } from './Inventory'
import { KasMasukKeluar, JurnalUmum, LabaRugi, HitungSHU, CetakKwitansi } from './Finance'
import { ExportData, RekapBulanan, GrafikTrend, AuditTrail, createAuditLog } from './Reporting'
import { ReturBarang, PiutangPage, HargaBertingkat, MutasiStok, SetoranHarian } from './Legacy'
import { HutangSupplier, BackupRestore, DashboardCharts, cetakStruk, cetakLaporanPDF, KartuAnggota } from './Extra'
import logoSrc from '/logo.png?url'

// =============================================
// HELPERS
// =============================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}
function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

// =============================================
// ICONS
// =============================================
const I = {
  users: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  wallet: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><circle cx="18" cy="15" r="1"/></svg>,
  loan: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  chart: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  home: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  gear: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>,
  plus: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  search: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  check: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>,
  logout: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  down: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  box: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  truck: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  cart: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  supplier: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')

  // Data state
  const [users, setUsers] = useState([])
  const [members, setMembers] = useState([])
  const [savings, setSavings] = useState([])
  const [loans, setLoans] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [stockInData, setStockInData] = useState([])
  const [transactions, setTransactions] = useState([])
  const [kasData, setKasData] = useState([])
  const [jurnalData, setJurnalData] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [returs, setReturs] = useState([])
  const [piutangs, setPiutangs] = useState([])
  const [mutasis, setMutasis] = useState([])
  const [setorans, setSetorans] = useState([])
  const [hutangs, setHutangs] = useState([])
  const [settings, setSettings] = useState({
    name: 'KOPERASI YONIF 527/BY', simpPokok: 500000, simpWajib: 100000, bungaPinjaman: 1.5, maxPinjaman: 10000000
  })

  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  // ---- INIT: seed + realtime listeners ----
  useEffect(() => {
    let unsubs = []
    async function init() {
      try {
        // Timeout 10 detik agar tidak stuck loading
        const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))

        try {
          await Promise.race([seedIfEmpty(), timeout(10000)])
          await Promise.race([seedInventoryIfEmpty(), timeout(10000)])
        } catch (seedErr) {
          console.warn('Seed timeout/error (lanjut tanpa seed):', seedErr.message)
        }

        // Realtime listeners — data otomatis sinkron antar device
        unsubs.push(listenCollection('users', setUsers))
        unsubs.push(listenCollection('members', setMembers))
        unsubs.push(listenCollection('savings', setSavings))
        unsubs.push(listenCollection('loans', setLoans))
        unsubs.push(listenCollection('products', setProducts))
        unsubs.push(listenCollection('suppliers', setSuppliers))
        unsubs.push(listenCollection('stockIn', setStockInData))
        unsubs.push(listenCollection('transactions', setTransactions))
        unsubs.push(listenCollection('kas', setKasData))
        unsubs.push(listenCollection('jurnal', setJurnalData))
        unsubs.push(listenCollection('auditLogs', setAuditLogs))
        unsubs.push(listenCollection('returs', setReturs))
        unsubs.push(listenCollection('piutangs', setPiutangs))
        unsubs.push(listenCollection('mutasis', setMutasis))
        unsubs.push(listenCollection('setorans', setSetorans))
        unsubs.push(listenCollection('hutangs', setHutangs))

        try {
          const s = await Promise.race([getOne('settings', 'main'), timeout(5000)])
          if (s) setSettings(s)
        } catch {}

        // Cek session di localStorage
        const session = localStorage.getItem('koperasi_session')
        if (session) setUser(JSON.parse(session))
      } catch (err) {
        console.error('Init error:', err)
      }
      setLoading(false)
    }
    init()
    return () => unsubs.forEach(fn => fn && fn())
  }, [])

  // ---- AUTH ----
  const defaultUsers = [
    { id: 'u1', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
    { id: 'u2', username: 'bendahara', password: 'bend123', name: 'Bendahara', role: 'bendahara' },
    { id: 'u3', username: 'ketua', password: 'ketua123', name: 'Ketua Koperasi', role: 'ketua' },
  ]

  function handleLogin(username, password) {
    // Cek dari Firestore dulu, kalau kosong pakai default
    const allUsers = users.length > 0 ? users : defaultUsers
    const found = allUsers.find(u => u.username === username && u.password === password)
    if (found) {
      const session = { id: found.id, username: found.username, name: found.name, role: found.role }
      setUser(session)
      localStorage.setItem('koperasi_session', JSON.stringify(session))
      // Simpan user ke Firestore kalau belum ada
      if (users.length === 0) {
        defaultUsers.forEach(u => { try { setOne('users', u.id, u) } catch {} })
      }
      const log = createAuditLog(session, 'Auth', 'login', `Login: ${found.name} (${found.role})`)
      try { setOne('auditLogs', log.id, log) } catch {}
      return true
    }
    return false
  }

  function handleLogout() {
    setUser(null)
    setPage('dashboard')
    localStorage.removeItem('koperasi_session')
  }

  // ---- CRUD wrappers (tulis ke Firestore) ----
  async function saveMember(m, isEdit) {
    if (isEdit) await setOne('members', m.id, m)
    else { m.id = genId(); await setOne('members', m.id, m) }
    await logAction('Anggota', isEdit ? 'update' : 'create', `${isEdit ? 'Edit' : 'Tambah'} anggota: ${m.name}`)
  }
  async function deleteMember(id) { const m = members.find(x => x.id === id); await removeOne('members', id); await logAction('Anggota', 'delete', `Hapus anggota: ${m?.name}`) }

  async function saveSaving(s) { s.id = genId(); await setOne('savings', s.id, s); await logAction('Simpanan', 'create', `Simpanan ${s.type}: Rp ${s.amount}`) }
  async function deleteSaving(id) { await removeOne('savings', id); await logAction('Simpanan', 'delete', 'Hapus simpanan') }

  async function saveLoan(l) { l.id = genId(); l.status = 'active'; l.paid = 0; l.installments = []; await setOne('loans', l.id, l); await logAction('Pinjaman', 'create', `Pinjaman baru: Rp ${l.amount}`) }
  async function payLoan(loan, principal, interest) {
    const newPaid = loan.paid + principal
    const updated = {
      ...loan,
      paid: newPaid,
      status: newPaid >= loan.amount ? 'lunas' : 'active',
      installments: [...loan.installments, { date: today(), amount: principal + interest, principal, interest }],
    }
    await setOne('loans', loan.id, updated)
  }

  async function saveSettings(s) { await setOne('settings', 'main', s); setSettings(s) }
  async function saveUser(u) { if (!u.id) u.id = genId(); await setOne('users', u.id, u) }
  async function deleteUser(id) { await removeOne('users', id) }

  // ---- Inventory CRUD ----
  async function saveProduct(p, isEdit) {
    if (isEdit) await setOne('products', p.id, p)
    else { p.id = genId(); await setOne('products', p.id, p) }
  }
  async function deleteProduct(id) { await removeOne('products', id) }
  async function updateProductStock(id, newStock) {
    const p = products.find(pr => pr.id === id)
    if (p) await setOne('products', id, { ...p, stock: newStock })
  }
  async function saveSupplier(s, isEdit) {
    if (isEdit) await setOne('suppliers', s.id, s)
    else { s.id = genId(); await setOne('suppliers', s.id, s) }
  }
  async function deleteSupplier(id) { await removeOne('suppliers', id) }
  async function saveStockIn(si) { si.id = genId(); await setOne('stockIn', si.id, si) }
  async function saveTransaction(tx) { tx.id = genId(); await setOne('transactions', tx.id, tx) }

  // ---- Legacy CRUD ----
  async function saveRetur(r) { r.id = genId(); await setOne('returs', r.id, r); await logAction('Retur', 'create', `Retur ${r.noRetur}: ${r.productName} x${r.qty}`) }
  async function savePiutang(p) { if (!p.id) p.id = genId(); await setOne('piutangs', p.id, p) }
  async function bayarPiutang(piutang, amount) {
    const payments = piutang.payments || []
    payments.push({ date: new Date().toISOString().slice(0, 10), amount })
    const totalBayar = (piutang.totalBayar || 0) + amount
    const sisa = piutang.total - totalBayar
    await setOne('piutangs', piutang.id, { ...piutang, totalBayar, sisa: Math.max(0, sisa), payments, status: sisa <= 0 ? 'LUNAS' : 'KREDIT' })
    await logAction('Piutang', 'bayar', `Bayar piutang ${piutang.noNota}: ${amount}`)
  }
  async function saveMutasi(m) { m.id = genId(); await setOne('mutasis', m.id, m); await logAction('Mutasi', 'create', `Mutasi ${m.noMutasi}: ${m.productName} ${m.tipe} ${m.qty}`) }
  async function saveSetoran(s) { s.id = genId(); await setOne('setorans', s.id, s); await logAction('Setoran', 'create', `Setoran ${s.date}: cash=${s.penjualanCash}`) }
  async function saveHutang(h) { h.id = genId(); await setOne('hutangs', h.id, h); await logAction('Hutang', 'create', `Hutang ${h.noFaktur}: ${h.supplierName} Rp ${h.total}`) }
  async function bayarHutang(hutang, amount) {
    const payments = hutang.payments || []
    payments.push({ date: new Date().toISOString().slice(0, 10), amount })
    const totalBayar = (hutang.totalBayar || 0) + amount
    const sisa = hutang.total - totalBayar
    await setOne('hutangs', hutang.id, { ...hutang, totalBayar, sisa: Math.max(0, sisa), payments })
    await logAction('Hutang', 'bayar', `Bayar hutang ${hutang.noFaktur}: ${amount}`)
  }

  // ---- Finance CRUD ----
  async function saveKas(k) { k.id = genId(); await setOne('kas', k.id, k); await logAction('Kas', 'create', `Kas ${k.type}: ${k.category} - Rp ${k.amount}`) }
  async function deleteKas(id) { await removeOne('kas', id); await logAction('Kas', 'delete', 'Hapus data kas') }
  async function saveJurnal(j) { j.id = genId(); await setOne('jurnal', j.id, j); await logAction('Kas', 'create', `Jurnal ${j.bukti}: ${j.note}`) }
  async function deleteJurnal(id) { await removeOne('jurnal', id); await logAction('Kas', 'delete', 'Hapus jurnal') }

  // ---- Audit Log ----
  async function logAction(module, action, detail) {
    const log = createAuditLog(user, module, action, detail)
    try { await setOne('auditLogs', log.id, log) } catch {}
  }

  // ---- Helpers ----
  const getMember = (id) => members.find(m => m.id === id)
  const memberSavings = (mid) => savings.filter(s => s.memberId === mid).reduce((a, b) => a + b.amount, 0)
  const memberLoans = (mid) => loans.filter(l => l.memberId === mid && l.status === 'active').reduce((a, b) => a + (b.amount - b.paid), 0)
  const totalSavings = savings.reduce((a, b) => a + b.amount, 0)
  const totalLoansOut = loans.filter(l => l.status === 'active').reduce((a, b) => a + (b.amount - b.paid), 0)
  const totalMembers = members.filter(m => m.status === 'active').length

  // ---- LOADING ----
  if (loading) {
    return (
      <div style={LS.center}>
        <style>{globalCSS}</style>
        <div style={LS.spinner} />
        <p style={{ color: '#94a3b8', marginTop: 16 }}>Menghubungkan ke server...</p>
      </div>
    )
  }

  // ---- LOGIN ----
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // ---- NAV ----
  // ---- RBAC: Role-Based Access Control ----
  const role = user?.role || 'staff'
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: I.home, roles: ['admin','bendahara','ketua','staff'] },
    { id: 'members', label: 'Anggota', icon: I.users, roles: ['admin','bendahara','ketua'] },
    { id: 'savings', label: 'Simpanan', icon: I.wallet, roles: ['admin','bendahara'] },
    { id: 'loans', label: 'Pinjaman', icon: I.loan, roles: ['admin','bendahara','ketua'] },
    { id: '_sep1', label: 'TOKO', sep: true, roles: ['admin','bendahara','staff'] },
    { id: 'products', label: 'Stok Barang', icon: I.box, roles: ['admin','bendahara','staff'] },
    { id: 'stockin', label: 'Barang Masuk', icon: I.truck, roles: ['admin','bendahara'] },
    { id: 'pos', label: 'Kasir / POS', icon: I.cart, roles: ['admin','bendahara','staff'] },
    { id: 'suppliers', label: 'Supplier', icon: I.supplier, roles: ['admin','bendahara'] },
    { id: 'retur', label: 'Retur Barang', icon: I.truck, roles: ['admin','bendahara'] },
    { id: 'harga', label: 'Harga Bertingkat', icon: I.box, roles: ['admin','bendahara'] },
    { id: 'mutasi', label: 'Mutasi Stok', icon: I.box, roles: ['admin','bendahara'] },
    { id: '_sep2', label: 'KEUANGAN', sep: true, roles: ['admin','bendahara','ketua'] },
    { id: 'kas', label: 'Kas Masuk/Keluar', icon: I.wallet, roles: ['admin','bendahara'] },
    { id: 'jurnal', label: 'Jurnal Umum', icon: I.chart, roles: ['admin','bendahara'] },
    { id: 'piutang', label: 'Piutang Pelanggan', icon: I.loan, roles: ['admin','bendahara'] },
    { id: 'setoran', label: 'Setoran Harian', icon: I.wallet, roles: ['admin','bendahara'] },
    { id: 'hutang', label: 'Hutang Supplier', icon: I.truck, roles: ['admin','bendahara'] },
    { id: 'labarugi', label: 'Laba Rugi', icon: I.chart, roles: ['admin','bendahara','ketua'] },
    { id: 'shu', label: 'Hitung SHU', icon: I.loan, roles: ['admin','ketua'] },
    { id: 'kwitansi', label: 'Cetak Kwitansi', icon: I.home, roles: ['admin','bendahara','staff'] },
    { id: '_sep3', label: 'LAPORAN', sep: true, roles: ['admin','bendahara','ketua'] },
    { id: 'reports', label: 'Neraca', icon: I.chart, roles: ['admin','bendahara','ketua'] },
    { id: 'rekap', label: 'Rekap Bulanan', icon: I.chart, roles: ['admin','bendahara','ketua'] },
    { id: 'grafik', label: 'Grafik Trend', icon: I.chart, roles: ['admin','bendahara','ketua'] },
    { id: 'export', label: 'Import/Export', icon: I.home, roles: ['admin','bendahara'] },
    { id: 'audit', label: 'Audit Trail', icon: I.gear, roles: ['admin'] },
    { id: 'notif', label: 'Notifikasi', icon: I.home, roles: ['admin','bendahara','ketua'] },
    { id: '_sep4', label: 'SISTEM', sep: true, roles: ['admin'] },
    { id: 'backup', label: 'Backup & Restore', icon: I.gear, roles: ['admin'] },
    { id: 'settings', label: 'Pengaturan', icon: I.gear, roles: ['admin'] },
  ]
  // Filter nav berdasarkan role user
  const navItems = allNavItems.filter(n => {
    if (n.sep) {
      // Tampilkan separator hanya jika ada menu setelahnya yang bisa diakses
      const idx = allNavItems.indexOf(n)
      const nextItems = allNavItems.slice(idx + 1)
      const nextSepIdx = nextItems.findIndex(x => x.sep)
      const sectionItems = nextSepIdx === -1 ? nextItems : nextItems.slice(0, nextSepIdx)
      return sectionItems.some(x => x.roles?.includes(role))
    }
    return n.roles?.includes(role)
  })

  // ---- Notifikasi Jatuh Tempo ----
  const overdueLoans = loans.filter(l => {
    if (l.status !== 'active') return false
    const lastPay = l.installments.length > 0 ? l.installments[l.installments.length - 1].date : l.date
    const nextDue = new Date(lastPay)
    nextDue.setMonth(nextDue.getMonth() + 1)
    return new Date() > nextDue
  })
  const notifCount = overdueLoans.length

  return (
    <div style={S.root}>
      <style>{globalCSS}</style>

      {/* MOBILE HEADER */}
      <div className="mobile-header" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#0f172a', zIndex: 50, alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button onClick={() => setSideOpen(true)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <img src={logoSrc} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, flex: 1 }}>YONIF 527/BY</span>
        {notifCount > 0 && <button onClick={() => { setPage('notif'); setSideOpen(false) }} style={{ border: 'none', background: '#c62828', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{notifCount}</button>}
      </div>

      {/* SIDEBAR OVERLAY (mobile) */}
      <div className={`sidebar-overlay${sideOpen ? ' open' : ''}`} onClick={() => setSideOpen(false)} />

      {/* SIDEBAR */}
      <nav className={`app-sidebar${sideOpen ? ' open' : ''}`} style={S.sidebar}>
        <div style={S.brand}>
          <img src={logoSrc} alt="Logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain' }} />
          <div>
            <div style={S.brandName}>YONIF 527/BY</div>
            <div style={S.brandSub}>Koperasi</div>
          </div>
        </div>
        <div style={S.navList}>
          {navItems.map(n => n.sep ? (
            <div key={n.id} style={{ fontSize: 10, fontWeight: 700, color: '#475569', padding: '14px 12px 6px', letterSpacing: 1.5 }}>{n.label}</div>
          ) : (
            <button key={n.id} onClick={() => { setPage(n.id); setSideOpen(false) }}
              style={{ ...S.navBtn, ...(page === n.id ? S.navActive : {}) }}>
              <span style={{ display: 'flex', flexShrink: 0 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'notif' && notifCount > 0 && <span style={{ background: '#c62828', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{notifCount}</span>}
            </button>
          ))}
        </div>
        <div style={S.sideFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={S.avatar}>{user.name.charAt(0)}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={S.logoutBtn}>{I.logout} Keluar</button>
        </div>
      </nav>

      {/* MAIN */}
      <main className="app-main" style={S.main}>
        {page === 'dashboard' && <Dashboard {...{ totalMembers, totalSavings, totalLoansOut, members, savings, loans, getMember, setPage, products, transactions, kasData }} />}
        {page === 'members' && <Members {...{ members, saveMember, deleteMember, memberSavings, memberLoans, setModal, showToast, settings, logoSrc }} />}
        {page === 'savings' && <Savings {...{ savings, saveSaving, deleteSaving, members, getMember, setModal, showToast }} />}
        {page === 'loans' && <Loans {...{ loans, saveLoan, payLoan, members, getMember, setModal, showToast, settings }} />}
        {page === 'reports' && <Reports {...{ members, savings, loans, getMember }} />}
        {page === 'products' && <Products {...{ products, saveProduct, deleteProduct, suppliers, setModal, showToast }} />}
        {page === 'stockin' && <StockIn {...{ stockIn: stockInData, saveStockIn, products, suppliers, updateProductStock, setModal, showToast }} />}
        {page === 'pos' && <POS {...{ products, transactions, saveTransaction, updateProductStock, members, showToast, savePiutang, settings }} />}
        {page === 'suppliers' && <Suppliers {...{ suppliers, saveSupplier, deleteSupplier, products, setModal, showToast }} />}
        {page === 'retur' && <ReturBarang {...{ returs, saveRetur, products, suppliers, updateProductStock, setModal, showToast }} />}
        {page === 'harga' && <HargaBertingkat {...{ products, saveProduct, setModal, showToast }} />}
        {page === 'mutasi' && <MutasiStok {...{ mutasis, saveMutasi, products, updateProductStock, setModal, showToast }} />}
        {page === 'kas' && <KasMasukKeluar {...{ kasData, saveKas, deleteKas, setModal, showToast }} />}
        {page === 'jurnal' && <JurnalUmum {...{ jurnalData, saveJurnal, deleteJurnal, setModal, showToast }} />}
        {page === 'piutang' && <PiutangPage {...{ piutangs, savePiutang, bayarPiutang, members, getMember, setModal, showToast }} />}
        {page === 'setoran' && <SetoranHarian {...{ setorans, saveSetoran, transactions, kasData, loans, setModal, showToast }} />}
        {page === 'hutang' && <HutangSupplier {...{ hutangs, saveHutang, bayarHutang, suppliers, setModal, showToast }} />}
        {page === 'labarugi' && <LabaRugi {...{ kasData, transactions, loans, products, settings }} />}
        {page === 'shu' && <HitungSHU {...{ members, savings, loans, transactions, kasData, products, settings }} />}
        {page === 'kwitansi' && <CetakKwitansi {...{ transactions, savings, loans, members, getMember, settings, setModal }} />}
        {page === 'rekap' && <RekapBulanan {...{ members, savings, loans, transactions, kasData, products, settings }} />}
        {page === 'grafik' && <GrafikTrend {...{ savings, loans, transactions, kasData, products }} />}
        {page === 'export' && <ExportData {...{ members, savings, loans, products, transactions, kasData, settings,
          saveImportedMembers: async (items, onProgress) => { return await batchSet('members', items, onProgress) },
          saveImportedProducts: async (items, onProgress) => { return await batchSet('products', items, onProgress) },
          showToast
        }} />}
        {page === 'audit' && <AuditTrail {...{ auditLogs, members, getMember }} />}
        {page === 'notif' && <NotifikasiPage loans={loans} members={members} getMember={getMember} />}
        {page === 'backup' && <BackupRestore {...{ members, savings, loans, products, suppliers, kasData, jurnalData, transactions, settings, showToast,
          saveImportedProducts: async (items, onProgress) => { return await batchSet('products', items, onProgress) },
          saveImportedMembers: async (items, onProgress) => { return await batchSet('members', items, onProgress) }
        }} />}
        {page === 'settings' && <SettingsPage {...{ settings, saveSettings, showToast, users, saveUser, deleteUser, user }} />}
      </main>

      {/* MODAL */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{modal.title}</h3>
              <button style={S.iconBtn} onClick={() => setModal(null)}>{I.x}</button>
            </div>
            {modal.content}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? 'var(--g)' : 'var(--r)' }}>
          {toast.type === 'success' ? I.check : I.x} {toast.msg}
        </div>
      )}
    </div>
  )
}

// =============================================
// LOGIN SCREEN
// =============================================
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  function submit(e) {
    if (e) e.preventDefault()
    if (!username || !password) { setError('Masukkan ID dan password'); return }
    if (!onLogin(username, password)) setError('ID atau password salah')
  }

  return (
    <div style={LS.root}>
      <style>{globalCSS}</style>
      <div style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logoSrc} alt="Logo" style={{ width: 88, height: 88, objectFit: 'contain', marginBottom: 16 }} />
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>KOPERASI YONIF 527/BY</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Baladibya Yudha — Sistem Manajemen Koperasi</p>
        </div>

        <div style={LS.card}>
          <h2 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>Masuk ke Sistem</h2>

          {error && (
            <div style={LS.error}>{I.x} {error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={LS.label}>
              User ID
              <input style={LS.input} placeholder="Masukkan user ID" value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
            </label>
            <label style={LS.label}>
              Password
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input style={{ ...LS.input, marginTop: 0, paddingRight: 44 }}
                  type={show ? 'text' : 'password'} placeholder="Masukkan password" value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && submit()} />
                <button onClick={() => setShow(!show)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                  {show ? I.x : I.search}
                </button>
              </div>
            </label>
            <button onClick={submit} style={LS.submitBtn}>Masuk</button>
          </div>
        </div>

        <div style={LS.hint}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Akun Default</div>
          {[['Admin', 'admin / admin123'], ['Bendahara', 'bendahara / bend123'], ['Ketua', 'ketua / ketua123']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 3 }}>
              <span>{l}</span>
              <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{v}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================
// DASHBOARD
// =============================================
function Dashboard({ totalMembers, totalSavings, totalLoansOut, members, savings, loans, getMember, setPage, products, transactions, kasData }) {
  const totalInventory = products.reduce((a, p) => a + (p.stock * p.buyPrice), 0)
  const todaySales = transactions.filter(t => t.date === today()).reduce((a, t) => a + t.total, 0)
  const lowStock = products.filter(p => p.stock <= p.minStock).length
  const cards = [
    { label: 'Total Anggota', value: totalMembers, icon: I.users, color: 'var(--b)' },
    { label: 'Total Simpanan', value: formatRp(totalSavings), icon: I.wallet, color: 'var(--g)' },
    { label: 'Pinjaman Berjalan', value: formatRp(totalLoansOut), icon: I.loan, color: 'var(--o)' },
    { label: 'Nilai Inventaris', value: formatRp(totalInventory), icon: I.box, color: 'var(--p)' },
    { label: 'Penjualan Hari Ini', value: formatRp(todaySales), icon: I.cart, color: 'var(--g)' },
    { label: 'Stok Menipis', value: lowStock + ' item', icon: I.chart, color: lowStock > 0 ? 'var(--r)' : 'var(--g)' },
  ]
  const recentSavings = [...savings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const activeLoans = loans.filter(l => l.status === 'active')

  return (
    <div>
      <h2 style={S.title}>Dashboard</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: -12 }}>
        <img src={logoSrc} alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--b)' }}>KOPERASI YONIF 527/BY</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Baladibya Yudha</div>
        </div>
      </div>
      <div style={S.grid4}>{cards.map((c, i) => (
        <div key={i} style={S.statCard}>
          <div style={{ ...S.statIcon, background: c.color + '18', color: c.color }}>{c.icon}</div>
          <div style={S.statLabel}>{c.label}</div>
          <div style={S.statVal}>{c.value}</div>
        </div>
      ))}</div>

      <div style={S.row2}>
        <div style={S.card}>
          <div style={S.cardHead}><h3 style={S.cardTitle}>Simpanan Terakhir</h3><button style={S.linkBtn} onClick={() => setPage('savings')}>Lihat Semua</button></div>
          <table style={S.table}>
            <thead><tr>{['Anggota', 'Jenis', 'Jumlah', 'Tanggal'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{recentSavings.map(s => {
              const m = getMember(s.memberId)
              return (<tr key={s.id} style={S.tr}>
                <td style={S.td}>{m?.name || '-'}</td>
                <td style={S.td}><span style={{ ...S.badge, ...badgeColor(s.type) }}>{s.type}</span></td>
                <td style={S.td}>{formatRp(s.amount)}</td>
                <td style={S.td}>{fmtDate(s.date)}</td>
              </tr>)
            })}</tbody>
          </table>
        </div>
        <div style={S.card}>
          <div style={S.cardHead}><h3 style={S.cardTitle}>Pinjaman Aktif</h3><button style={S.linkBtn} onClick={() => setPage('loans')}>Lihat Semua</button></div>
          {activeLoans.length === 0 ? <p style={S.empty}>Tidak ada pinjaman aktif</p> : (
            <table style={S.table}>
              <thead><tr>{['Anggota', 'Jumlah', 'Sisa', 'Tenor'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{activeLoans.map(l => {
                const m = getMember(l.memberId)
                return (<tr key={l.id} style={S.tr}>
                  <td style={S.td}>{m?.name || '-'}</td>
                  <td style={S.td}>{formatRp(l.amount)}</td>
                  <td style={S.td}>{formatRp(l.amount - l.paid)}</td>
                  <td style={S.td}>{l.tenor} bln</td>
                </tr>)
              })}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* Grafik Detail */}
      <DashboardCharts transactions={transactions} kasData={kasData || []} savings={savings} loans={loans} products={products} />
    </div>
  )
}

// =============================================
// MEMBERS
// =============================================
function Members({ members, saveMember, deleteMember, memberSavings, memberLoans, setModal, showToast, settings, logoSrc }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = members.filter(m => {
    if (filter === 'active' && m.status !== 'active') return false
    if (filter === 'inactive' && m.status !== 'inactive') return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.no.includes(search)) return false
    return true
  })

  function openForm(member) {
    const isEdit = !!member
    const data = member ? { ...member } : { no: String(members.length + 1).padStart(3, '0'), name: '', phone: '', address: '', joinDate: today(), status: 'active' }
    setModal({
      title: isEdit ? 'Edit Anggota' : 'Tambah Anggota',
      content: <MemberForm initial={data} onSave={async d => {
        await saveMember(isEdit ? { ...member, ...d } : d, isEdit)
        setModal(null)
        showToast(isEdit ? 'Anggota diperbarui' : 'Anggota ditambahkan')
      }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Data Anggota</h2><button style={S.primaryBtn} onClick={() => openForm(null)}>{I.plus} Tambah Anggota</button></div>
      <div style={S.toolbar}>
        <div style={S.searchBox}>{I.search}<input style={S.searchInput} placeholder="Cari nama / no anggota..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div style={S.filterGroup}>
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} style={{ ...S.filterBtn, ...(filter === f ? S.filterActive : {}) }} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
            </button>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['No', 'Nama', 'Telepon', 'Simpanan', 'Pinjaman', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(m => (
            <tr key={m.id} style={S.tr}>
              <td style={S.td}>{m.no}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
              <td style={S.td}>{m.phone}</td>
              <td style={{ ...S.td, color: 'var(--g)' }}>{formatRp(memberSavings(m.id))}</td>
              <td style={{ ...S.td, color: 'var(--o)' }}>{formatRp(memberLoans(m.id))}</td>
              <td style={S.td}><span style={{ ...S.badge, background: m.status === 'active' ? 'var(--g)20' : '#eee', color: m.status === 'active' ? 'var(--g)' : '#888' }}>{m.status === 'active' ? 'Aktif' : 'Nonaktif'}</span></td>
              <td style={S.td}>
                <button style={S.smallBtn} onClick={() => openForm(m)}>{I.edit}</button>
                <button style={{ ...S.smallBtn, color: 'var(--b)' }} onClick={() => setModal({ title: 'Kartu Anggota - ' + m.name, content: <KartuAnggota member={m} settings={settings} logoSrc={logoSrc} /> })}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 10h4M7 14h2"/><circle cx="16" cy="11" r="2"/></svg>
                </button>
                <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus anggota ' + m.name + '?')) { await deleteMember(m.id); showToast('Anggota dihapus', 'error') } }}>{I.trash}</button>
              </td>
            </tr>
          ))}{filtered.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#999' }}>Tidak ada data</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function MemberForm({ initial, onSave }) {
  const [d, setD] = useState(initial)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <div style={S.form}>
      {[['No Anggota', 'no', 'text'], ['Nama Lengkap', 'name', 'text'], ['Telepon', 'phone', 'tel'], ['Alamat', 'address', 'text'], ['Tanggal Gabung', 'joinDate', 'date']].map(([l, k, t]) => (
        <label key={k} style={S.formLabel}>{l}<input style={S.input} type={t} value={d[k]} onChange={e => set(k, e.target.value)} /></label>
      ))}
      <label style={S.formLabel}>Status<select style={S.input} value={d.status} onChange={e => set('status', e.target.value)}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave(d)}>Simpan</button>
    </div>
  )
}

// =============================================
// SAVINGS
// =============================================
function Savings({ savings, saveSaving, deleteSaving, members, getMember, setModal, showToast }) {
  const [filter, setFilter] = useState('all')
  const activeMembers = members.filter(m => m.status === 'active')
  const filtered = filter === 'all' ? savings : savings.filter(s => s.type === filter)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
  const totalByType = t => savings.filter(s => s.type === t).reduce((a, b) => a + b.amount, 0)

  return (
    <div>
      <div style={S.pageHead}>
        <h2 style={S.title}>Simpanan</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.primaryBtn, background: 'var(--o)' }} onClick={() => setModal({
            title: 'Tarik Simpanan Sukarela',
            content: <WithdrawForm members={activeMembers} savings={savings} onSave={async d => { await saveSaving({ ...d, amount: -Math.abs(d.amount) }); setModal(null); showToast('Penarikan berhasil') }} />,
          })}>{I.down} Tarik</button>
          <button style={S.primaryBtn} onClick={() => setModal({
            title: 'Tambah Simpanan',
            content: <SavingsForm members={activeMembers} onSave={async d => { await saveSaving(d); setModal(null); showToast('Simpanan berhasil ditambahkan') }} />,
          })}>{I.plus} Setor</button>
        </div>
      </div>

      <div style={S.grid4}>
        {[['Pokok', 'pokok', 'var(--b)'], ['Wajib', 'wajib', 'var(--g)'], ['Sukarela', 'sukarela', 'var(--p)']].map(([l, t, c]) => (
          <div key={t} style={S.statCard}><div style={S.statLabel}>Simpanan {l}</div><div style={{ ...S.statVal, color: c }}>{formatRp(totalByType(t))}</div></div>
        ))}
      </div>

      <div style={S.toolbar}>
        <div style={S.filterGroup}>
          {[['all', 'Semua'], ['pokok', 'Pokok'], ['wajib', 'Wajib'], ['sukarela', 'Sukarela']].map(([k, l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'Anggota', 'Jenis', 'Jumlah', 'Catatan', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(s => {
            const m = getMember(s.memberId); const w = s.amount < 0
            return (<tr key={s.id} style={S.tr}>
              <td style={S.td}>{fmtDate(s.date)}</td>
              <td style={S.td}>{m?.name || '-'}</td>
              <td style={S.td}><span style={{ ...S.badge, ...badgeColor(s.type) }}>{s.type}</span></td>
              <td style={{ ...S.td, color: w ? 'var(--r)' : 'var(--g)', fontWeight: 600 }}>{w ? '- ' : '+ '}{formatRp(Math.abs(s.amount))}</td>
              <td style={S.td}>{s.note || '-'}</td>
              <td style={S.td}><button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus?')) { await deleteSaving(s.id); showToast('Dihapus', 'error') } }}>{I.trash}</button></td>
            </tr>)
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function SavingsForm({ members, onSave }) {
  const [d, setD] = useState({ memberId: members[0]?.id || '', type: 'wajib', amount: '', date: today(), note: '' })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Anggota<select style={S.input} value={d.memberId} onChange={e => set('memberId', e.target.value)}>{members.map(m => <option key={m.id} value={m.id}>{m.no} - {m.name}</option>)}</select></label>
      <label style={S.formLabel}>Jenis<select style={S.input} value={d.type} onChange={e => set('type', e.target.value)}><option value="pokok">Pokok</option><option value="wajib">Wajib</option><option value="sukarela">Sukarela</option></select></label>
      <label style={S.formLabel}>Jumlah (Rp)<input style={S.input} type="number" value={d.amount} onChange={e => set('amount', e.target.value)} /></label>
      <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      <label style={S.formLabel}>Catatan<input style={S.input} value={d.note} onChange={e => set('note', e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave({ ...d, amount: Number(d.amount) })}>Simpan</button>
    </div>
  )
}

function WithdrawForm({ members, savings, onSave }) {
  const [mid, setMid] = useState(members[0]?.id || '')
  const [amount, setAmount] = useState('')
  const bal = savings.filter(s => s.memberId === mid && s.type === 'sukarela').reduce((a, b) => a + b.amount, 0)
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Anggota<select style={S.input} value={mid} onChange={e => setMid(e.target.value)}>{members.map(m => <option key={m.id} value={m.id}>{m.no} - {m.name}</option>)}</select></label>
      <div style={{ padding: '8px 12px', background: '#f8f8f8', borderRadius: 8, fontSize: 13 }}>Saldo Sukarela: <strong style={{ color: 'var(--g)' }}>{formatRp(bal)}</strong></div>
      <label style={S.formLabel}>Jumlah Tarik (Rp)<input style={S.input} type="number" max={bal} value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} disabled={Number(amount) > bal || Number(amount) <= 0}
        onClick={() => onSave({ memberId: mid, type: 'sukarela', amount: Number(amount), date: today(), note: 'Penarikan sukarela' })}>Tarik Simpanan</button>
    </div>
  )
}

// =============================================
// LOANS
// =============================================
function Loans({ loans, saveLoan, payLoan, members, getMember, setModal, showToast, settings }) {
  const [filter, setFilter] = useState('all')
  const activeMembers = members.filter(m => m.status === 'active')
  const filtered = filter === 'all' ? loans : loans.filter(l => l.status === filter)

  function openPay(loan) {
    const remaining = loan.amount - loan.paid
    const mp = Math.min(Math.ceil(loan.amount / loan.tenor), remaining)
    const mi = Math.round(remaining * loan.interest / 100)
    setModal({
      title: 'Bayar Angsuran - ' + (getMember(loan.memberId)?.name || ''),
      content: <InstallmentForm remaining={remaining} sp={mp} si={mi} onSave={async (p, i) => { await payLoan(loan, p, i); setModal(null); showToast('Angsuran berhasil dicatat') }} />,
    })
  }

  return (
    <div>
      <div style={S.pageHead}><h2 style={S.title}>Pinjaman</h2>
        <button style={S.primaryBtn} onClick={() => setModal({
          title: 'Ajukan Pinjaman',
          content: <LoanForm members={activeMembers} settings={settings} onSave={async d => { await saveLoan(d); setModal(null); showToast('Pinjaman berhasil dicatat') }} />,
        })}>{I.plus} Ajukan Pinjaman</button>
      </div>
      <div style={S.toolbar}>
        <div style={S.filterGroup}>
          {[['all', 'Semua'], ['active', 'Aktif'], ['lunas', 'Lunas']].map(([k, l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Tanggal', 'Anggota', 'Pinjaman', 'Dibayar', 'Sisa', 'Bunga', 'Status', 'Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(l => {
            const m = getMember(l.memberId); const rem = l.amount - l.paid; const pct = Math.round((l.paid / l.amount) * 100)
            return (<tr key={l.id} style={S.tr}>
              <td style={S.td}>{fmtDate(l.date)}</td>
              <td style={S.td}>{m?.name || '-'}</td>
              <td style={S.td}>{formatRp(l.amount)}</td>
              <td style={{ ...S.td, color: 'var(--g)' }}>{formatRp(l.paid)}</td>
              <td style={{ ...S.td, color: 'var(--o)' }}>{formatRp(rem)}</td>
              <td style={S.td}>{l.interest}%</td>
              <td style={S.td}><span style={{ ...S.badge, background: l.status === 'active' ? 'var(--o)20' : 'var(--g)20', color: l.status === 'active' ? 'var(--o)' : 'var(--g)' }}>{l.status === 'active' ? `${pct}%` : 'Lunas'}</span></td>
              <td style={S.td}>{l.status === 'active' && <button style={{ ...S.smallBtn, color: 'var(--g)', fontSize: 12, fontWeight: 600 }} onClick={() => openPay(l)}>Bayar</button>}</td>
            </tr>)
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function LoanForm({ members, settings, onSave }) {
  const [d, setD] = useState({ memberId: members[0]?.id || '', amount: '', interest: settings.bungaPinjaman, tenor: 12, date: today() })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const monthly = d.amount && d.tenor ? Math.ceil(Number(d.amount) / Number(d.tenor)) : 0
  return (
    <div style={S.form}>
      <label style={S.formLabel}>Anggota<select style={S.input} value={d.memberId} onChange={e => set('memberId', e.target.value)}>{members.map(m => <option key={m.id} value={m.id}>{m.no} - {m.name}</option>)}</select></label>
      <label style={S.formLabel}>Jumlah Pinjaman (Rp)<input style={S.input} type="number" max={settings.maxPinjaman} value={d.amount} onChange={e => set('amount', e.target.value)} /></label>
      <label style={S.formLabel}>Bunga (% / bulan)<input style={S.input} type="number" step="0.1" value={d.interest} onChange={e => set('interest', e.target.value)} /></label>
      <label style={S.formLabel}>Tenor (bulan)<select style={S.input} value={d.tenor} onChange={e => set('tenor', e.target.value)}>{[3, 6, 12, 18, 24].map(t => <option key={t} value={t}>{t} bulan</option>)}</select></label>
      <label style={S.formLabel}>Tanggal<input style={S.input} type="date" value={d.date} onChange={e => set('date', e.target.value)} /></label>
      {monthly > 0 && <div style={{ padding: '8px 12px', background: '#f0f7ff', borderRadius: 8, fontSize: 13 }}>Estimasi: <strong>{formatRp(monthly)}</strong>/bln + bunga</div>}
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={() => onSave({ ...d, amount: Number(d.amount), interest: Number(d.interest), tenor: Number(d.tenor) })}>Ajukan Pinjaman</button>
    </div>
  )
}

function InstallmentForm({ remaining, sp, si, onSave }) {
  const [p, setP] = useState(sp)
  const [i, setI] = useState(si)
  return (
    <div style={S.form}>
      <div style={{ padding: '8px 12px', background: '#fff3e0', borderRadius: 8, fontSize: 13 }}>Sisa pinjaman: <strong style={{ color: 'var(--o)' }}>{formatRp(remaining)}</strong></div>
      <label style={S.formLabel}>Angsuran Pokok (Rp)<input style={S.input} type="number" max={remaining} value={p} onChange={e => setP(Number(e.target.value))} /></label>
      <label style={S.formLabel}>Bunga (Rp)<input style={S.input} type="number" value={i} onChange={e => setI(Number(e.target.value))} /></label>
      <div style={{ padding: '8px 12px', background: '#f8f8f8', borderRadius: 8, fontSize: 13 }}>Total bayar: <strong>{formatRp(p + i)}</strong></div>
      <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} disabled={p <= 0 || p > remaining} onClick={() => onSave(p, i)}>Konfirmasi Pembayaran</button>
    </div>
  )
}

// =============================================
// REPORTS
// =============================================
function Reports({ members, savings, loans, getMember }) {
  const totalSimpanan = savings.reduce((a, b) => a + b.amount, 0)
  const totalPinjaman = loans.reduce((a, b) => a + b.amount, 0)
  const totalDibayar = loans.reduce((a, b) => a + b.paid, 0)
  const totalBunga = loans.reduce((a, b) => a + b.installments.reduce((x, y) => x + y.interest, 0), 0)
  const sisaPinjaman = loans.filter(l => l.status === 'active').reduce((a, b) => a + (b.amount - b.paid), 0)

  const memberSummary = members.map(m => {
    const sv = savings.filter(s => s.memberId === m.id).reduce((a, b) => a + b.amount, 0)
    const ln = loans.filter(l => l.memberId === m.id && l.status === 'active').reduce((a, b) => a + (b.amount - b.paid), 0)
    return { ...m, totalSimpanan: sv, sisaPinjaman: ln }
  }).sort((a, b) => b.totalSimpanan - a.totalSimpanan)
  const maxSv = Math.max(...memberSummary.map(m => m.totalSimpanan), 1)

  return (
    <div>
      <h2 style={S.title}>Laporan Keuangan</h2>
      <div style={S.grid4}>
        {[['Total Simpanan', formatRp(totalSimpanan), 'var(--g)'], ['Pinjaman Disalurkan', formatRp(totalPinjaman), 'var(--b)'], ['Angsuran Diterima', formatRp(totalDibayar), 'var(--p)'], ['Pendapatan Bunga', formatRp(totalBunga), 'var(--o)']].map(([l, v, c], i) => (
          <div key={i} style={S.statCard}><div style={S.statLabel}>{l}</div><div style={{ ...S.statVal, color: c }}>{v}</div></div>
        ))}
      </div>
      <div style={S.row2}>
        <div style={S.card}>
          <h3 style={S.cardTitle}>Neraca Sederhana</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Keterangan</th><th style={{ ...S.th, textAlign: 'right' }}>Jumlah</th></tr></thead>
            <tbody>
              <tr style={S.tr}><td style={{ ...S.td, fontWeight: 700, color: 'var(--b)' }} colSpan={2}>ASET</td></tr>
              <tr style={S.tr}><td style={S.td}>Kas</td><td style={{ ...S.td, textAlign: 'right' }}>{formatRp(totalSimpanan - sisaPinjaman)}</td></tr>
              <tr style={S.tr}><td style={S.td}>Piutang Pinjaman</td><td style={{ ...S.td, textAlign: 'right' }}>{formatRp(sisaPinjaman)}</td></tr>
              <tr style={{ ...S.tr, background: '#f0f7ff' }}><td style={{ ...S.td, fontWeight: 700 }}>Total Aset</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(totalSimpanan)}</td></tr>
              <tr style={S.tr}><td style={{ ...S.td, fontWeight: 700, color: 'var(--o)' }} colSpan={2}>KEWAJIBAN</td></tr>
              <tr style={S.tr}><td style={S.td}>Simpanan Anggota</td><td style={{ ...S.td, textAlign: 'right' }}>{formatRp(totalSimpanan - totalBunga)}</td></tr>
              <tr style={S.tr}><td style={S.td}>SHU (Pendapatan Bunga)</td><td style={{ ...S.td, textAlign: 'right' }}>{formatRp(totalBunga)}</td></tr>
              <tr style={{ ...S.tr, background: '#fff7e6' }}><td style={{ ...S.td, fontWeight: 700 }}>Total</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{formatRp(totalSimpanan)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>Simpanan per Anggota</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {memberSummary.filter(m => m.totalSimpanan > 0).map(m => (
              <div key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{m.name}</span><span style={{ fontWeight: 600 }}>{formatRp(m.totalSimpanan)}</span></div>
                <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(m.totalSimpanan / maxSv) * 100}%`, background: 'var(--g)', borderRadius: 4 }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================
// SETTINGS
// =============================================
function SettingsPage({ settings, saveSettings, showToast, users, saveUser, deleteUser, user }) {
  const [d, setD] = useState({ ...settings })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const [nu, setNu] = useState({ username: '', password: '', name: '', role: 'bendahara' })
  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <h2 style={S.title}>Pengaturan</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Pengaturan Koperasi</h3>
          <div style={S.form}>
            <label style={S.formLabel}>Nama Koperasi<input style={S.input} value={d.name} onChange={e => set('name', e.target.value)} /></label>
            <label style={S.formLabel}>Simpanan Pokok (Rp)<input style={S.input} type="number" value={d.simpPokok} onChange={e => set('simpPokok', Number(e.target.value))} /></label>
            <label style={S.formLabel}>Simpanan Wajib (Rp)<input style={S.input} type="number" value={d.simpWajib} onChange={e => set('simpWajib', Number(e.target.value))} /></label>
            <label style={S.formLabel}>Bunga Pinjaman (% / bulan)<input style={S.input} type="number" step="0.1" value={d.bungaPinjaman} onChange={e => set('bungaPinjaman', Number(e.target.value))} /></label>
            <label style={S.formLabel}>Maks. Pinjaman (Rp)<input style={S.input} type="number" value={d.maxPinjaman} onChange={e => set('maxPinjaman', Number(e.target.value))} /></label>
            <button style={{ ...S.primaryBtn, width: '100%', marginTop: 8 }} onClick={async () => { await saveSettings(d); showToast('Pengaturan disimpan') }}>Simpan Pengaturan</button>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.cardTitle, marginBottom: 16 }}>Manajemen User</h3>
          <table style={S.table}>
            <thead><tr>{['Username', 'Nama', 'Role', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id} style={S.tr}>
                <td style={{ ...S.td, fontWeight: 600 }}>{u.username}</td>
                <td style={S.td}>{u.name}</td>
                <td style={S.td}><span style={{ ...S.badge, background: u.role === 'admin' ? 'var(--r)20' : 'var(--b)20', color: u.role === 'admin' ? 'var(--r)' : 'var(--b)', textTransform: 'capitalize' }}>{u.role}</span></td>
                <td style={S.td}>{isAdmin && u.id !== user.id && <button style={{ ...S.smallBtn, color: 'var(--r)' }} onClick={async () => { if (confirm('Hapus user?')) { await deleteUser(u.id); showToast('User dihapus', 'error') } }}>{I.trash}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {isAdmin && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--muted)' }}>Tambah User Baru</div>
              <div style={S.form}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={S.formLabel}>Username<input style={S.input} value={nu.username} onChange={e => setNu(p => ({ ...p, username: e.target.value }))} /></label>
                  <label style={S.formLabel}>Password<input style={S.input} value={nu.password} onChange={e => setNu(p => ({ ...p, password: e.target.value }))} /></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={S.formLabel}>Nama<input style={S.input} value={nu.name} onChange={e => setNu(p => ({ ...p, name: e.target.value }))} /></label>
                  <label style={S.formLabel}>Role<select style={S.input} value={nu.role} onChange={e => setNu(p => ({ ...p, role: e.target.value }))}><option value="admin">Admin</option><option value="bendahara">Bendahara</option><option value="ketua">Ketua</option><option value="staff">Staff</option></select></label>
                </div>
                <button style={{ ...S.primaryBtn, width: '100%' }} onClick={async () => {
                  if (!nu.username || !nu.password || !nu.name) { showToast('Lengkapi semua field', 'error'); return }
                  if (users.some(u => u.username === nu.username)) { showToast('Username sudah ada', 'error'); return }
                  await saveUser(nu)
                  setNu({ username: '', password: '', name: '', role: 'bendahara' })
                  showToast('User berhasil ditambahkan')
                }}>{I.plus} Tambah User</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// HELPERS & STYLES
// =============================================
// =============================================
// NOTIFIKASI JATUH TEMPO
// =============================================
function NotifikasiPage({ loans, members, getMember }) {
  const today = new Date()

  const loanStatus = loans.filter(l => l.status === 'active').map(l => {
    const m = getMember(l.memberId)
    const lastPay = l.installments.length > 0 ? l.installments[l.installments.length - 1].date : l.date
    const nextDue = new Date(lastPay)
    nextDue.setMonth(nextDue.getMonth() + 1)
    const daysLeft = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24))
    const remaining = l.amount - l.paid
    const monthlyPrincipal = Math.ceil(l.amount / l.tenor)
    const monthlyInterest = Math.round(remaining * l.interest / 100)
    return { ...l, member: m, nextDue, daysLeft, remaining, monthlyPrincipal, monthlyInterest, monthlyTotal: monthlyPrincipal + monthlyInterest }
  }).sort((a, b) => a.daysLeft - b.daysLeft)

  const overdue = loanStatus.filter(l => l.daysLeft < 0)
  const dueSoon = loanStatus.filter(l => l.daysLeft >= 0 && l.daysLeft <= 7)
  const upcoming = loanStatus.filter(l => l.daysLeft > 7)

  function formatRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
  function fmtDate(d) { return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }

  function NotifCard({ loan, type }) {
    const colors = {
      overdue: { bg: '#ffebee', border: '#ef9a9a', text: '#c62828', label: 'TERLAMBAT' },
      soon: { bg: '#fff3e0', border: '#ffcc80', text: '#e65100', label: 'SEGERA' },
      ok: { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', label: 'AMAN' },
    }
    const c = colors[type]
    return (
      <div style={{ background: c.bg, border: '1px solid ' + c.border, borderRadius: 12, padding: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{loan.member?.name || '-'}</div>
          <span style={{ background: c.text, color: '#fff', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{c.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: '#6b7280' }}>Jatuh tempo:</span> <strong>{fmtDate(loan.nextDue)}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Hari:</span> <strong style={{ color: c.text }}>{loan.daysLeft < 0 ? Math.abs(loan.daysLeft) + ' hari lalu' : loan.daysLeft + ' hari lagi'}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Sisa pinjaman:</span> <strong>{formatRp(loan.remaining)}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Angsuran/bln:</span> <strong>{formatRp(loan.monthlyTotal)}</strong></div>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          No. {loan.member?.no} | Telp: {loan.member?.phone || '-'} | Tenor: {loan.tenor} bln | Bunga: {loan.interest}%
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Notifikasi Jatuh Tempo</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Terlambat</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: overdue.length > 0 ? '#c62828' : '#2e7d32' }}>{overdue.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Jatuh Tempo 7 Hari</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: dueSoon.length > 0 ? '#e65100' : '#2e7d32' }}>{dueSoon.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Total Pinjaman Aktif</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1565c0' }}>{loanStatus.length}</div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#c62828', marginBottom: 12 }}>Terlambat Bayar</h3>
          {overdue.map(l => <NotifCard key={l.id} loan={l} type="overdue" />)}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e65100', marginBottom: 12 }}>Jatuh Tempo Segera (7 hari)</h3>
          {dueSoon.map(l => <NotifCard key={l.id} loan={l} type="soon" />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2e7d32', marginBottom: 12 }}>Belum Jatuh Tempo</h3>
          {upcoming.map(l => <NotifCard key={l.id} loan={l} type="ok" />)}
        </div>
      )}

      {loanStatus.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Tidak ada pinjaman aktif</div>
      )}
    </div>
  )
}

function badgeColor(type) {
  if (type === 'pokok') return { background: '#e3f2fd', color: '#1565c0' }
  if (type === 'wajib') return { background: '#e8f5e9', color: '#2e7d32' }
  if (type === 'sukarela') return { background: '#f3e5f5', color: '#7b1fa2' }
  return {}
}

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');
  :root { --b:#1565c0; --g:#2e7d32; --o:#e65100; --r:#c62828; --p:#6a1b9a; --bg:#f5f6fa; --card:#fff; --text:#1a1a2e; --muted:#6b7280; --border:#e5e7eb; --sidebar:#0f172a; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); -webkit-tap-highlight-color: transparent; }
  table { border-collapse: collapse; }
  input, select, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

  /* MOBILE RESPONSIVE */
  @media (max-width: 768px) {
    .app-sidebar { position: fixed !important; left: -250px; transition: left 0.3s ease; z-index: 100 !important; }
    .app-sidebar.open { left: 0; }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
    .sidebar-overlay.open { display: block; }
    .app-main { padding: 16px !important; padding-top: 72px !important; }
    .mobile-header { display: flex !important; }
  }
  @media (max-width: 640px) {
    .app-main { padding: 12px !important; padding-top: 68px !important; }
    table { display: block; overflow-x: auto; white-space: nowrap; }
  }
`

const LS = {
  root: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "'DM Sans', sans-serif" },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif" },
  spinner: { width: 40, height: 40, border: '3px solid #1e293b', borderTopColor: '#1565c0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 },
  error: { background: 'rgba(198,40,40,0.15)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef5350', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: 600 },
  input: { width: '100%', padding: '12px 14px', marginTop: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: 13, background: 'linear-gradient(135deg, #1565c0, #6a1b9a)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  hint: { marginTop: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' },
}

const S = {
  root: { display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'DM Sans', sans-serif" },
  sidebar: { width: 240, background: 'var(--sidebar)', color: '#fff', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', zIndex: 10 },
  brand: { display: 'flex', alignItems: 'center', gap: 12, padding: '24px 20px 20px' },
  brandName: { fontWeight: 700, fontSize: 16 },
  brandSub: { fontSize: 11, color: '#94a3b8' },
  navList: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', overflowY: 'auto' },
  navBtn: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', background: 'transparent', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14, textAlign: 'left', transition: 'all 0.15s' },
  navActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600 },
  sideFooter: { padding: '16px 20px' },
  avatar: { width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  logoutBtn: { width: '100%', padding: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  main: { flex: 1, padding: '28px 32px', maxWidth: 1100, minWidth: 0 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 20 },
  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: 'var(--card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statLabel: { fontSize: 13, color: 'var(--muted)', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: 700 },
  card: { background: 'var(--card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  table: { width: '100%', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)' },
  tr: { transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--b)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  smallBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--muted)', display: 'inline-flex', borderRadius: 4 },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--b)', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  iconBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--muted)', display: 'flex' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', flex: 1, maxWidth: 320 },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: { padding: '6px 14px', border: '1px solid var(--border)', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  filterActive: { background: 'var(--b)', color: '#fff', borderColor: 'var(--b)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--muted)' },
  input: { padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(2px)' },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 440, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
  empty: { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },
}
