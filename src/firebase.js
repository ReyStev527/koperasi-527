import { initializeApp } from 'firebase/app'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Debug: cek apakah config terbaca
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'undefined') {
  console.error('FIREBASE CONFIG ERROR: .env file belum terbaca! Pastikan file bernama .env (bukan .env.txt) dan restart npm run dev')
}
console.log('Firebase project:', firebaseConfig.projectId)

const app = initializeApp(firebaseConfig)

// HEMAT KUOTA: cache permanen di browser (IndexedDB).
// Tanpa cache ini, SETIAP kali aplikasi dibuka Firestore membaca ulang SEMUA
// dokumen di 16 koleksi → kuota gratis 50rb baca/hari cepat habis
// ("You have gone over your daily usage limits").
// Dengan cache: buka ulang aplikasi hanya mengambil dokumen yang BERUBAH.
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch (err) {
  console.warn('Cache permanen tidak didukung browser ini, pakai mode biasa:', err)
  db = getFirestore(app)
}

export { db }
export default app
