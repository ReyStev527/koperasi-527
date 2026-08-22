import { createClient } from '@supabase/supabase-js'

// Nilai ini diisi di file .env (dan di Netlify > Environment variables)
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('SUPABASE CONFIG ERROR: .env belum terbaca! Pastikan ada VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu restart npm run dev')
}
console.log('Supabase project:', url)

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },           // aplikasi pakai login sendiri
  realtime: { params: { eventsPerSecond: 5 } }, // hemat: cukup 5 pesan/detik
})

// Nama koleksi di kode aplikasi → nama tabel di Postgres (harus huruf kecil)
export const TABEL = {
  users: 'users', members: 'members', savings: 'savings', loans: 'loans',
  products: 'products', suppliers: 'suppliers', stockIn: 'stockin',
  transactions: 'transactions', kas: 'kas', jurnal: 'jurnal',
  auditLogs: 'auditlogs', returs: 'returs', piutangs: 'piutangs',
  mutasis: 'mutasis', setorans: 'setorans', hutangs: 'hutangs',
  settings: 'settings', juyarAdjust: 'juyaradjust', opnames: 'opnames',
}

export function tabel(col) {
  const t = TABEL[col]
  if (!t) throw new Error('Koleksi tidak dikenal: ' + col)
  return t
}

export default supabase
