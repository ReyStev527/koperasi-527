import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

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
export const db = getFirestore(app)
export default app
