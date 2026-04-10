// =============================================
// BARCODE SCANNER COMPONENT
// Scan barcode/QR code pakai kamera HP
// =============================================
import { useState, useEffect, useRef } from 'react'

// Load html5-qrcode dari CDN
async function loadScanner() {
  if (window.Html5Qrcode) return window.Html5Qrcode
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
    s.onload = () => resolve(window.Html5Qrcode)
    s.onerror = () => reject(new Error('Gagal memuat scanner'))
    document.head.appendChild(s)
  })
}

export function BarcodeScanner({ onScan, onClose }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const containerRef = useRef('barcode-reader-' + Date.now())

  useEffect(() => {
    let scanner = null

    async function startScanner() {
      try {
        const Html5Qrcode = await loadScanner()
        scanner = new Html5Qrcode(containerRef.current)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' }, // Kamera belakang
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Berhasil scan
            onScan(decodedText.trim())
            // Vibrate HP sebagai feedback
            if (navigator.vibrate) navigator.vibrate(100)
          },
          () => {} // Ignore scan errors
        )
        setStatus('scanning')
      } catch (err) {
        console.error('Scanner error:', err)
        setError(err.message || 'Gagal mengakses kamera')
        setStatus('error')
      }
    }

    startScanner()

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [onScan])

  function handleClose() {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {})
    }
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 7h2v2H7zM15 7h2v2h-2zM7 15h2v2H7zM11 7h2v10M7 11h10"/>
            </svg>
            Scan Barcode
          </h3>
          <button onClick={handleClose} style={styles.closeBtn}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {status === 'loading' && (
          <div style={styles.statusBox}>
            <div style={styles.spinner} />
            <p>Memuat kamera...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.errorBox}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Gagal mengakses kamera</p>
            <p style={{ fontSize: 12, color: '#666' }}>{error}</p>
            <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Pastikan:</p>
            <ul style={{ fontSize: 12, color: '#666', marginLeft: 16, marginTop: 4 }}>
              <li>Browser punya izin akses kamera</li>
              <li>Menggunakan HTTPS (bukan HTTP)</li>
              <li>Kamera tidak digunakan aplikasi lain</li>
            </ul>
            <button onClick={handleClose} style={{ ...styles.btn, marginTop: 12, width: '100%' }}>Tutup</button>
          </div>
        )}

        <div id={containerRef.current} style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }} />

        {status === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Arahkan kamera ke barcode produk</p>
            <div style={styles.scanLine} />
          </div>
        )}

        {/* Manual Input */}
        <div style={styles.manualBox}>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Atau masukkan kode manual:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="manual-barcode"
              style={styles.input}
              placeholder="Ketik SKU / barcode..."
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = e.target.value.trim()
                  if (val) { onScan(val); e.target.value = '' }
                }
              }}
            />
            <button style={styles.btn} onClick={() => {
              const inp = document.getElementById('manual-barcode')
              if (inp?.value.trim()) { onScan(inp.value.trim()); inp.value = '' }
            }}>Cari</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini barcode icon button
export function ScanButton({ onClick, label }) {
  return (
    <button onClick={onClick} style={styles.scanBtn}>
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
        <path d="M7 8v8M12 8v8M17 8v8M8 12h8"/>
      </svg>
      {label || 'Scan'}
    </button>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 20,
    width: '90%', maxWidth: 400, maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  closeBtn: {
    border: 'none', background: '#f5f5f5', borderRadius: 8, padding: 6,
    cursor: 'pointer', display: 'flex', color: '#666',
  },
  statusBox: {
    textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14,
  },
  errorBox: {
    background: '#ffebee', borderRadius: 10, padding: 16, marginBottom: 12,
    color: '#c62828',
  },
  spinner: {
    width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#1565c0',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    margin: '0 auto 12px',
  },
  manualBox: {
    borderTop: '1px solid #eee', paddingTop: 12, marginTop: 8,
  },
  input: {
    flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, outline: 'none',
  },
  btn: {
    padding: '10px 18px', background: '#1565c0', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  scanBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', background: '#7b1fa2', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  scanLine: {
    width: 200, height: 2, background: 'linear-gradient(90deg, transparent, #1565c0, transparent)',
    margin: '8px auto 0', animation: 'pulse 1.5s ease-in-out infinite',
  },
}
