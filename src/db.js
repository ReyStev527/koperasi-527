import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'

// =============================================
// GENERIC CRUD
// =============================================
export async function getAll(col) {
  const snap = await getDocs(collection(db, col))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getOne(col, id) {
  const snap = await getDoc(doc(db, col, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function setOne(col, id, data) {
  await setDoc(doc(db, col, id), data, { merge: true })
}

export async function addOne(col, data) {
  const id = genId()
  await setDoc(doc(db, col, id), { ...data, id })
  return id
}

export async function removeOne(col, id) {
  await deleteDoc(doc(db, col, id))
}

// =============================================
// BATCH WRITE (untuk import massal - max 500/batch)
// =============================================
export async function batchSet(col, items, onProgress) {
  const BATCH_SIZE = 450 // Firestore max 500, pakai 450 untuk aman
  let done = 0
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = items.slice(i, i + BATCH_SIZE)
    for (const item of chunk) {
      const ref = doc(db, col, item.id)
      batch.set(ref, item, { merge: true })
    }
    await batch.commit()
    done += chunk.length
    if (onProgress) onProgress(done, items.length)
  }
  return done
}

// =============================================
// REALTIME LISTENER
// =============================================
export function listenCollection(col, callback) {
  return onSnapshot(collection(db, col), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// =============================================
// SEED DATA (jalankan sekali untuk setup awal)
// =============================================
export async function seedIfEmpty() {
  // Cek apakah sudah ada data
  const usersSnap = await getDocs(collection(db, 'users'))
  if (usersSnap.size > 0) return false // sudah ada data

  const batch = writeBatch(db)

  // Users
  const users = [
    { id: 'u1', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
    { id: 'u2', username: 'bendahara', password: 'bend123', name: 'Bendahara', role: 'bendahara' },
    { id: 'u3', username: 'ketua', password: 'ketua123', name: 'Ketua Koperasi', role: 'ketua' },
  ]
  users.forEach(u => batch.set(doc(db, 'users', u.id), u))

  // Members
  const members = [
    { id: 'm1', no: '001', name: 'Ahmad Fauzi', phone: '081234567890', address: 'Jl. Merdeka 10', joinDate: '2024-01-15', status: 'active' },
    { id: 'm2', no: '002', name: 'Siti Nurhaliza', phone: '082345678901', address: 'Jl. Sudirman 5', joinDate: '2024-02-01', status: 'active' },
    { id: 'm3', no: '003', name: 'Budi Santoso', phone: '083456789012', address: 'Jl. Diponegoro 8', joinDate: '2024-03-10', status: 'active' },
    { id: 'm4', no: '004', name: 'Dewi Lestari', phone: '084567890123', address: 'Jl. Kartini 3', joinDate: '2024-04-20', status: 'active' },
    { id: 'm5', no: '005', name: 'Rudi Hartono', phone: '085678901234', address: 'Jl. Gatot Subroto 12', joinDate: '2024-05-05', status: 'inactive' },
  ]
  members.forEach(m => batch.set(doc(db, 'members', m.id), m))

  // Savings
  const savings = [
    { id: 's1', memberId: 'm1', type: 'pokok', amount: 500000, date: '2024-01-15', note: 'Simpanan pokok awal' },
    { id: 's2', memberId: 'm1', type: 'wajib', amount: 100000, date: '2024-02-01', note: 'Simpanan wajib Feb' },
    { id: 's3', memberId: 'm2', type: 'pokok', amount: 500000, date: '2024-02-01', note: 'Simpanan pokok awal' },
    { id: 's4', memberId: 'm2', type: 'sukarela', amount: 250000, date: '2024-03-15', note: 'Simpanan sukarela' },
    { id: 's5', memberId: 'm3', type: 'pokok', amount: 500000, date: '2024-03-10', note: 'Simpanan pokok awal' },
    { id: 's6', memberId: 'm3', type: 'wajib', amount: 100000, date: '2024-04-01', note: 'Simpanan wajib Apr' },
    { id: 's7', memberId: 'm4', type: 'pokok', amount: 500000, date: '2024-04-20', note: 'Simpanan pokok awal' },
    { id: 's8', memberId: 'm1', type: 'wajib', amount: 100000, date: '2024-03-01', note: 'Simpanan wajib Mar' },
    { id: 's9', memberId: 'm1', type: 'sukarela', amount: 1000000, date: '2024-04-10', note: 'Deposit tambahan' },
    { id: 's10', memberId: 'm2', type: 'wajib', amount: 100000, date: '2024-03-01', note: 'Simpanan wajib Mar' },
  ]
  savings.forEach(s => batch.set(doc(db, 'savings', s.id), s))

  // Loans
  const loans = [
    { id: 'l1', memberId: 'm1', amount: 5000000, interest: 1.5, tenor: 12, date: '2024-03-01', status: 'active', paid: 1250000, installments: [
      { date: '2024-04-01', amount: 491667, principal: 416667, interest: 75000 },
      { date: '2024-05-01', amount: 485417, principal: 416667, interest: 68750 },
    ]},
    { id: 'l2', memberId: 'm3', amount: 3000000, interest: 1.5, tenor: 6, date: '2024-04-15', status: 'active', paid: 500000, installments: [
      { date: '2024-05-15', amount: 545000, principal: 500000, interest: 45000 },
    ]},
    { id: 'l3', memberId: 'm2', amount: 2000000, interest: 1.5, tenor: 6, date: '2024-01-10', status: 'lunas', paid: 2000000, installments: [] },
  ]
  loans.forEach(l => batch.set(doc(db, 'loans', l.id), l))

  // Settings
  batch.set(doc(db, 'settings', 'main'), {
    name: 'KOPERASI YONIF 527/BY',
    simpPokok: 500000,
    simpWajib: 100000,
    bungaPinjaman: 1.5,
    maxPinjaman: 10000000,
  })

  // Suppliers
  const suppliers = [
    { id: 'sp1', name: 'CV Berkah Jaya', phone: '081111222333', address: 'Jl. Industri 15, Lumajang', contact: 'Pak Hadi', note: 'Sembako & kebutuhan pokok' },
    { id: 'sp2', name: 'UD Makmur Sentosa', phone: '082222333444', address: 'Jl. Pasar Baru 8, Malang', contact: 'Bu Sari', note: 'Minuman & snack' },
    { id: 'sp3', name: 'PT Sinar Abadi', phone: '083333444555', address: 'Jl. Raya Surabaya 22', contact: 'Pak Budi', note: 'ATK & perlengkapan kantor' },
  ]
  suppliers.forEach(s => batch.set(doc(db, 'suppliers', s.id), s))

  // Products
  const products = [
    { id: 'p1', sku: 'BRG-001', name: 'Beras Premium 5kg', category: 'Sembako', buyPrice: 65000, sellPrice: 72000, stock: 50, unit: 'karung', minStock: 10, supplierId: 'sp1' },
    { id: 'p2', sku: 'BRG-002', name: 'Minyak Goreng 2L', category: 'Sembako', buyPrice: 28000, sellPrice: 32000, stock: 80, unit: 'botol', minStock: 20, supplierId: 'sp1' },
    { id: 'p3', sku: 'BRG-003', name: 'Gula Pasir 1kg', category: 'Sembako', buyPrice: 14000, sellPrice: 16000, stock: 100, unit: 'pack', minStock: 25, supplierId: 'sp1' },
    { id: 'p4', sku: 'BRG-004', name: 'Kopi Kapal Api 65g', category: 'Minuman', buyPrice: 3500, sellPrice: 5000, stock: 200, unit: 'sachet', minStock: 50, supplierId: 'sp2' },
    { id: 'p5', sku: 'BRG-005', name: 'Teh Celup Sariwangi', category: 'Minuman', buyPrice: 5000, sellPrice: 7000, stock: 120, unit: 'box', minStock: 30, supplierId: 'sp2' },
    { id: 'p6', sku: 'BRG-006', name: 'Indomie Goreng', category: 'Makanan', buyPrice: 2800, sellPrice: 3500, stock: 300, unit: 'bungkus', minStock: 60, supplierId: 'sp1' },
    { id: 'p7', sku: 'BRG-007', name: 'Sabun Mandi Lifebuoy', category: 'Toiletries', buyPrice: 3000, sellPrice: 4500, stock: 60, unit: 'pcs', minStock: 15, supplierId: 'sp2' },
    { id: 'p8', sku: 'BRG-008', name: 'Buku Tulis A5', category: 'ATK', buyPrice: 3500, sellPrice: 5000, stock: 150, unit: 'pcs', minStock: 30, supplierId: 'sp3' },
    { id: 'p9', sku: 'BRG-009', name: 'Pulpen Pilot', category: 'ATK', buyPrice: 4000, sellPrice: 6000, stock: 100, unit: 'pcs', minStock: 20, supplierId: 'sp3' },
    { id: 'p10', sku: 'BRG-010', name: 'Air Mineral 600ml', category: 'Minuman', buyPrice: 2000, sellPrice: 3000, stock: 240, unit: 'botol', minStock: 48, supplierId: 'sp2' },
  ]
  products.forEach(p => batch.set(doc(db, 'products', p.id), p))

  // Stock In (Barang Masuk) — contoh data
  const stockIn = [
    { id: 'si1', date: '2024-04-01', supplierId: 'sp1', items: [{ productId: 'p1', qty: 20, buyPrice: 65000 }, { productId: 'p2', qty: 30, buyPrice: 28000 }], total: 2140000, note: 'Restock bulanan', invoice: 'INV-001' },
    { id: 'si2', date: '2024-04-15', supplierId: 'sp2', items: [{ productId: 'p4', qty: 100, buyPrice: 3500 }, { productId: 'p5', qty: 50, buyPrice: 5000 }], total: 600000, note: 'Restock mingguan', invoice: 'INV-002' },
  ]
  stockIn.forEach(s => batch.set(doc(db, 'stockIn', s.id), s))

  // Transactions (Penjualan/Kasir) — contoh data
  const transactions = [
    { id: 'tx1', date: '2024-04-20', memberId: 'm1', items: [{ productId: 'p1', name: 'Beras Premium 5kg', qty: 2, price: 72000 }, { productId: 'p6', name: 'Indomie Goreng', qty: 10, price: 3500 }], total: 179000, payment: 200000, change: 21000, cashier: 'admin' },
    { id: 'tx2', date: '2024-04-21', memberId: 'm2', items: [{ productId: 'p4', name: 'Kopi Kapal Api 65g', qty: 5, price: 5000 }, { productId: 'p7', name: 'Sabun Mandi Lifebuoy', qty: 3, price: 4500 }], total: 38500, payment: 50000, change: 11500, cashier: 'bendahara' },
  ]
  transactions.forEach(t => batch.set(doc(db, 'transactions', t.id), t))

  await batch.commit()
  return true
}

// Seed inventaris untuk user yang sudah punya data lama
export async function seedInventoryIfEmpty() {
  const prodSnap = await getDocs(collection(db, 'products'))
  if (prodSnap.size > 0) return false
  // Re-run full seed won't work, so seed inventory only
  const batch = writeBatch(db)
  const suppliers = [
    { id: 'sp1', name: 'CV Berkah Jaya', phone: '081111222333', address: 'Jl. Industri 15, Lumajang', contact: 'Pak Hadi', note: 'Sembako & kebutuhan pokok' },
    { id: 'sp2', name: 'UD Makmur Sentosa', phone: '082222333444', address: 'Jl. Pasar Baru 8, Malang', contact: 'Bu Sari', note: 'Minuman & snack' },
    { id: 'sp3', name: 'PT Sinar Abadi', phone: '083333444555', address: 'Jl. Raya Surabaya 22', contact: 'Pak Budi', note: 'ATK & perlengkapan kantor' },
  ]
  suppliers.forEach(s => batch.set(doc(db, 'suppliers', s.id), s))
  const products = [
    { id: 'p1', sku: 'BRG-001', name: 'Beras Premium 5kg', category: 'Sembako', buyPrice: 65000, sellPrice: 72000, stock: 50, unit: 'karung', minStock: 10, supplierId: 'sp1' },
    { id: 'p2', sku: 'BRG-002', name: 'Minyak Goreng 2L', category: 'Sembako', buyPrice: 28000, sellPrice: 32000, stock: 80, unit: 'botol', minStock: 20, supplierId: 'sp1' },
    { id: 'p3', sku: 'BRG-003', name: 'Gula Pasir 1kg', category: 'Sembako', buyPrice: 14000, sellPrice: 16000, stock: 100, unit: 'pack', minStock: 25, supplierId: 'sp1' },
    { id: 'p4', sku: 'BRG-004', name: 'Kopi Kapal Api 65g', category: 'Minuman', buyPrice: 3500, sellPrice: 5000, stock: 200, unit: 'sachet', minStock: 50, supplierId: 'sp2' },
    { id: 'p5', sku: 'BRG-005', name: 'Teh Celup Sariwangi', category: 'Minuman', buyPrice: 5000, sellPrice: 7000, stock: 120, unit: 'box', minStock: 30, supplierId: 'sp2' },
    { id: 'p6', sku: 'BRG-006', name: 'Indomie Goreng', category: 'Makanan', buyPrice: 2800, sellPrice: 3500, stock: 300, unit: 'bungkus', minStock: 60, supplierId: 'sp1' },
  ]
  products.forEach(p => batch.set(doc(db, 'products', p.id), p))
  await batch.commit()
  return true
}

// =============================================
// HELPERS
// =============================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
