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
  const [zoomLevel, setZoomLevel] = useState(1)
  const [maxZoom, setMaxZoom] = useState(1)
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  const containerId = useRef('barcode-reader-' + Math.random().toString(36).slice(2, 8))
  const mountedRef = useRef(true)
  const trackRef = useRef(null)

  // Update ref setiap render agar callback selalu terbaru
  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    mountedRef.current = true
    let scanner = null

    async function startScanner() {
      try {
        // Minta izin kamera dengan resolusi tinggi untuk barcode kecil
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          })
          // Cek kemampuan zoom kamera
          const track = stream.getVideoTracks()[0]
          if (track) {
            try {
              const caps = track.getCapabilities?.()
              if (caps?.zoom) {
                setMaxZoom(Math.min(caps.zoom.max, 5))
              }
            } catch {}
          }
          // Stop stream setelah dapat izin, biar html5-qrcode yang kelola
          stream.getTracks().forEach(t => t.stop())
        } catch (permErr) {
          if (!mountedRef.current) return
          console.error('Camera permission error:', permErr)
          setError('Izin kamera ditolak. Buka Settings browser → izinkan kamera untuk situs ini.')
          setStatus('error')
          return
        }

        const Html5Qrcode = await loadScanner()
        if (!mountedRef.current) return

        // Tunggu DOM container siap
        await new Promise(r => setTimeout(r, 300))
        if (!mountedRef.current) return

        const el = document.getElementById(containerId.current)
        if (!el) {
          setError('Container scanner tidak ditemukan')
          setStatus('error')
          return
        }

        scanner = new Html5Qrcode(containerId.current)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 25,                         // 25 FPS untuk scan cepat (was 10)
            qrbox: { width: 300, height: 100 }, // Area kecil memaksa fokus ke barcode
            aspectRatio: 1.5,
            disableFlip: false,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },        // Resolusi tinggi
              height: { ideal: 1080 },
              focusMode: 'continuous',        // Auto-focus terus-menerus
            },
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true  // Pakai native BarcodeDetector API jika ada
            },
            formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] // Semua format barcode
          },
          (decodedText) => {
            if (onScanRef.current) onScanRef.current(decodedText.trim())
            if (navigator.vibrate) navigator.vibrate(100)
          },
          () => {} // Ignore scan errors
        )

        if (mountedRef.current) {
          setStatus('scanning')
          // Ambil track kamera untuk kontrol zoom
          try {
            const videoEl = el.querySelector('video')
            if (videoEl?.srcObject) {
              const track = videoEl.srcObject.getVideoTracks()[0]
              trackRef.current = track
              // Set auto-focus continuous
              if (track.getCapabilities?.()?.focusMode?.includes('continuous')) {
                await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
              }
              // Cek zoom
              const caps = track.getCapabilities?.()
              if (caps?.zoom) {
                setMaxZoom(Math.min(caps.zoom.max, 5))
                // Set zoom awal 1.5x untuk barcode kecil
                const initZoom = Math.min(1.5, caps.zoom.max)
                setZoomLevel(initZoom)
                await track.applyConstraints({ advanced: [{ zoom: initZoom }] })
              }
              // Set torch/flash jika ada
              if (caps?.torch) {
                // Torch tersedia, bisa digunakan nanti
              }
            }
          } catch (e) { console.log('Zoom/focus setup:', e) }
        }
      } catch (err) {
        console.error('Scanner error:', err)
        if (!mountedRef.current) return
        const msg = typeof err === 'string' ? err : err?.message || 'Gagal mengakses kamera'
        setError(msg)
        setStatus('error')
      }
    }

    startScanner()

    return () => {
      mountedRef.current = false
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  // Fungsi zoom
  async function changeZoom(val) {
    const z = Number(val)
    setZoomLevel(z)
    if (trackRef.current) {
      try {
        await trackRef.current.applyConstraints({ advanced: [{ zoom: z }] })
      } catch {}
    }
  }

  // Toggle flash/torch
  async function toggleTorch() {
    if (!trackRef.current) return
    try {
      const caps = trackRef.current.getCapabilities?.()
      if (!caps?.torch) return
      const settings = trackRef.current.getSettings?.()
      await trackRef.current.applyConstraints({ advanced: [{ torch: !settings?.torch }] })
    } catch {}
  }

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

        <div id={containerId.current} style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }} />

        {status === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Dekatkan kamera ke barcode — zoom otomatis 1.5×</p>
            <div style={styles.scanLine} />
            {/* Zoom & Flash Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>🔍 Zoom</span>
              <input type="range" min="1" max={maxZoom} step="0.1" value={zoomLevel}
                onChange={e => changeZoom(e.target.value)}
                style={{ flex: 1, accentColor: '#1565c0' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', minWidth: 32 }}>{zoomLevel.toFixed(1)}×</span>
              <button onClick={toggleTorch} style={{ border: 'none', background: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 16 }} title="Flash">💡</button>
            </div>
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
