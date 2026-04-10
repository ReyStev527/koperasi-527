# PANDUAN LENGKAP IMPLEMENTASI
# KOPERASI YONIF 527/BY — Sistem Manajemen Koperasi

---

## DAFTAR ISI

1. Persyaratan Sistem
2. Setup Firebase (Database)
3. Instalasi Lokal (Development)
4. Deploy ke Netlify (Online)
5. Login & User Default
6. Daftar Lengkap 33 Fitur
7. Struktur File Project
8. Troubleshooting
9. Cara Update / Maintenance

---

## 1. PERSYARATAN SISTEM

**Komputer untuk development:**
- Windows 10/11 (atau Mac/Linux)
- Node.js versi 18 atau lebih baru
- Git
- Browser modern (Chrome/Edge/Firefox)

**Untuk install Node.js:**
1. Buka https://nodejs.org
2. Download versi LTS (Long Term Support)
3. Install, centang semua opsi default
4. Restart komputer
5. Buka Command Prompt, ketik: `node --version`
   Harus muncul versi seperti `v20.x.x`

**Untuk install Git:**
1. Buka https://git-scm.com/download/win
2. Download dan install (semua opsi default)
3. Buka Command Prompt, ketik: `git --version`

---

## 2. SETUP FIREBASE (DATABASE)

Firebase adalah database cloud gratis dari Google.

### Langkah 1: Buat Project Firebase

1. Buka https://console.firebase.google.com
2. Login pakai akun Google
3. Klik **"Add project"** / **"Tambah project"**
4. Nama project: `koperasi-527`
5. Matikan Google Analytics (tidak perlu)
6. Klik **"Create Project"**

### Langkah 2: Aktifkan Firestore Database

1. Di sidebar kiri, klik **"Build"** → **"Firestore Database"**
2. Klik **"Create database"**
3. Pilih lokasi: **asia-southeast2 (Jakarta)**
4. Pilih **"Start in test mode"** (untuk development)
5. Klik **"Create"**

### Langkah 3: Buat Web App

1. Di halaman utama project, klik ikon **"</>"** (Web)
2. Nama app: `koperasi-web`
3. **JANGAN** centang Firebase Hosting
4. Klik **"Register app"**
5. Akan muncul konfigurasi seperti ini — **CATAT SEMUA NILAI INI:**

```
apiKey: "AIzaSy..."
authDomain: "koperasi-527.firebaseapp.com"
projectId: "koperasi-527"
storageBucket: "koperasi-527.firebasestorage.app"
messagingSenderId: "1093..."
appId: "1:1093...:web:f335..."
```

### Langkah 4: Atur Security Rules

1. Di Firestore, klik tab **"Rules"**
2. Ganti isinya dengan:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Klik **"Publish"**

> ⚠️ Rules ini untuk development. Untuk produksi, ganti dengan rules yang lebih ketat.

---

## 3. INSTALASI LOKAL (DEVELOPMENT)

### Langkah 1: Download Source Code

Download file ZIP dari Claude, extract ke folder misalnya:
```
C:\Projects\koperasi-527\
```

Atau clone dari GitHub jika sudah di-push:
```
git clone https://github.com/ReyStev527/koperasi-527.git
cd koperasi-527
```

### Langkah 2: Buat File .env

Buka folder project, buat file baru bernama `.env` (BUKAN `.env.txt`).

**PENTING untuk Windows:**
- Buka Notepad
- Paste isi di bawah (ganti dengan nilai Firebase kamu)
- Save As → Pilih "All Files" → Ketik nama file: `.env`
- Pastikan bukan `.env.txt`

Isi file `.env`:
```
VITE_FIREBASE_API_KEY=AIzaSyAynHd9yZqF05v61gBWOPIDYXtLhjNLGZU
VITE_FIREBASE_AUTH_DOMAIN=koperasi-527.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=koperasi-527
VITE_FIREBASE_STORAGE_BUCKET=koperasi-527.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1093561954234
VITE_FIREBASE_APP_ID=1:1093561954234:web:f335662fd7dd22f8a7b783
```

### Langkah 3: Install Dependencies

Buka **Command Prompt** (bukan PowerShell), navigasi ke folder project:

```
cd C:\Projects\koperasi-527
npm install
```

Tunggu sampai selesai (~1-2 menit).

### Langkah 4: Jalankan Development Server

```
npm run dev
```

Akan muncul seperti:
```
VITE v6.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

Buka browser, ketik: **http://localhost:5173**

### Langkah 5: Login

Gunakan akun default:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin (akses penuh) |
| bendahara | bend123 | Bendahara |
| ketua | ketua123 | Ketua |

---

## 4. DEPLOY KE NETLIFY (ONLINE)

Agar bisa diakses dari HP/komputer manapun lewat internet.

### Langkah 1: Push ke GitHub

```
cd C:\Projects\koperasi-527
git init
git add .
git commit -m "Initial: Koperasi YONIF 527"
git branch -M main
git remote add origin https://github.com/USERNAME/koperasi-527.git
git push -u origin main
```

> Ganti USERNAME dengan username GitHub kamu.

### Langkah 2: Hubungkan ke Netlify

1. Buka https://app.netlify.com
2. Login pakai akun GitHub
3. Klik **"Add new site"** → **"Import an existing project"**
4. Pilih **GitHub** → Pilih repo **koperasi-527**
5. Settings build:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Klik **"Deploy site"**

### Langkah 3: Tambah Environment Variables

1. Di Netlify, buka **Site configuration** → **Environment variables**
2. Klik **"Add a variable"** untuk setiap baris berikut:

| Key | Value |
|-----|-------|
| VITE_FIREBASE_API_KEY | AIzaSyAynHd9yZqF05v61gBWOPIDYXtLhjNLGZU |
| VITE_FIREBASE_AUTH_DOMAIN | koperasi-527.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | koperasi-527 |
| VITE_FIREBASE_STORAGE_BUCKET | koperasi-527.firebasestorage.app |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 1093561954234 |
| VITE_FIREBASE_APP_ID | 1:1093561954234:web:f335662fd7dd22f8a7b783 |

3. Setelah semua di-input, klik **"Deploys"** → **"Trigger deploy"** → **"Deploy site"**

### Langkah 4: Akses Aplikasi

Setelah deploy selesai (~1-2 menit), aplikasi bisa diakses di:
```
https://koperasi-527.netlify.app
```

> URL ini bisa diubah di Site settings → Domain management → Custom domain

### Install di HP (PWA)

1. Buka URL Netlify di browser HP (Chrome)
2. Akan muncul popup "Add to Home Screen" / "Install App"
3. Klik Install
4. Aplikasi muncul di home screen seperti app biasa

---

## 5. USER DEFAULT & HAK AKSES (RBAC)

| Role | Menu yang Bisa Diakses |
|------|----------------------|
| **Admin** | SEMUA fitur (33 menu) |
| **Bendahara** | Koperasi + Toko + Keuangan + Laporan |
| **Ketua** | Koperasi + Keuangan (view) + Laporan |
| **Staff** | Dashboard + Stok Barang + Kasir + Kwitansi |

Tambah/edit user di menu **Pengaturan** (hanya admin).

---

## 6. DAFTAR LENGKAP 33 FITUR

### KOPERASI (4 fitur)
1. Login + Multi User (4 role)
2. Dashboard (6 kartu statistik)
3. Manajemen Anggota (CRUD + status)
4. Simpanan (Pokok/Wajib/Sukarela)

### PINJAMAN (2 fitur)
5. Pinjaman + Angsuran (bunga, tenor)
6. Notifikasi Jatuh Tempo (badge merah)

### TOKO (10 fitur)
7. Stok Barang + Alert Menipis
8. Barang Masuk Multi Item
9. Kasir/POS Visual (barcode, diskon, kredit)
10. Data Supplier
11. Scan Barcode (kamera HP)
12. Retur Barang ke Supplier ★ BARU
13. Harga Bertingkat (Eceran + Grosir) ★ BARU
14. Mutasi Stok (koreksi/hilang/rusak) ★ BARU
15. Diskon per Item di Kasir ★ BARU
16. Penjualan Kredit + DP ★ BARU

### KEUANGAN (7 fitur)
17. Kas Masuk / Keluar
18. Jurnal Umum (Double Entry)
19. Laporan Laba Rugi
20. Perhitungan SHU + Per Anggota
21. Cetak Kwitansi
22. Piutang Pelanggan + Cicilan ★ BARU
23. Setoran Harian + Rekonsiliasi ★ BARU

### LAPORAN (5 fitur)
24. Neraca Sederhana
25. Rekap Bulanan
26. Grafik Trend (SVG Chart)
27. Import Excel (.xlsx/.csv)
28. Export Data (CSV)

### SISTEM (5 fitur)
29. Audit Trail (Log Aktivitas)
30. RBAC (Hak Akses per Role)
31. PWA (Install di HP)
32. Mobile Responsive + Hamburger Menu
33. Firebase Realtime Sync

---

## 7. STRUKTUR FILE PROJECT

```
koperasi-527/
├── index.html              ← Entry HTML + PWA meta tags
├── package.json            ← Dependencies (React, Firebase, Vite)
├── vite.config.js          ← Build configuration
├── netlify.toml            ← Netlify deploy settings
├── .env                    ← Firebase config (JANGAN di-push ke GitHub!)
├── .env.example            ← Template .env
├── .gitignore              ← Exclude node_modules & .env
├── firestore.rules         ← Firebase security rules
├── public/
│   ├── logo.png            ← Logo YONIF 527/BY
│   └── manifest.json       ← PWA manifest
└── src/
    ├── main.jsx            ← React entry point
    ├── firebase.js         ← Firebase config + init
    ├── db.js               ← Firestore CRUD + seed data
    ├── App.jsx             ← Core app (71KB): Login, Dashboard,
    │                          Anggota, Simpanan, Pinjaman, RBAC,
    │                          Notifikasi, Mobile, Settings
    ├── Inventory.jsx       ← Toko (37KB): Stok, Supplier,
    │                          Barang Masuk, POS/Kasir
    ├── Finance.jsx         ← Keuangan (36KB): Kas, Jurnal,
    │                          Laba Rugi, SHU, Kwitansi
    ├── Reporting.jsx       ← Laporan (29KB): Export/Import,
    │                          Rekap, Grafik, Audit Trail
    ├── Legacy.jsx          ← Fitur Legacy (28KB): Retur,
    │                          Piutang, Harga Bertingkat,
    │                          Mutasi Stok, Setoran Harian
    └── BarcodeScanner.jsx  ← Scan Barcode kamera (7.5KB)
```

**Total: 9 file source code, ~220KB**

---

## 8. TROUBLESHOOTING

### "Menghubungkan ke server..." loading terus

**Penyebab:** Firebase config salah atau .env tidak terbaca.

**Solusi:**
1. Pastikan file `.env` (bukan `.env.txt`) ada di root folder
2. Cek isi .env, semua value harus terisi
3. Restart dev server: Ctrl+C → `npm run dev`
4. Buka browser console (F12) → cek error

### Login gagal

**Penyebab:** Firestore belum ada data user.

**Solusi:** Aplikasi otomatis seed user default saat pertama kali jalan. Jika tetap gagal, gunakan akun fallback yang hardcoded: admin/admin123

### Blank putih setelah deploy Netlify

**Penyebab:** Environment variables belum ditambah di Netlify.

**Solusi:**
1. Buka Netlify → Site configuration → Environment variables
2. Tambah 6 variable Firebase
3. Trigger redeploy: Deploys → Trigger deploy

### Kamera barcode tidak bisa dibuka

**Penyebab:** Harus HTTPS atau localhost.

**Solusi:**
- Di Netlify sudah otomatis HTTPS ✓
- Di localhost juga otomatis bisa ✓
- Di HTTP biasa, kamera diblokir browser

### npm install error

**Penyebab:** Node.js belum terinstall atau versi lama.

**Solusi:**
1. Buka Command Prompt (bukan Node.js REPL!)
2. Ketik `node --version` → harus v18+
3. Jika belum, install dari https://nodejs.org

---

## 9. CARA UPDATE / MAINTENANCE

### Update Kode (setelah dapat ZIP baru dari Claude)

```bash
# 1. Extract ZIP baru
# 2. Copy-paste timpa folder src/ dan public/
# 3. Di Command Prompt:
cd C:\Projects\koperasi-527
git add .
git commit -m "Update: deskripsi perubahan"
git push
# 4. Netlify otomatis deploy ulang (1-2 menit)
```

### Backup Data

Data tersimpan di Firebase Firestore (cloud). Untuk backup manual:
1. Buka https://console.firebase.google.com
2. Pilih project → Firestore
3. Klik titik tiga → Export
4. Atau gunakan fitur Export CSV di aplikasi

### Tambah User Baru

1. Login sebagai admin
2. Buka menu **Pengaturan**
3. Scroll ke bagian **Manajemen User**
4. Klik **Tambah User** → Isi username, password, role

### Custom Domain (opsional)

1. Di Netlify → Domain management
2. Add custom domain: `koperasi.yonif527.id`
3. Ikuti instruksi DNS

---

## KONTAK DEVELOPER

- Telegram: @Ladangpertanian
- GitHub: ReyStev527
