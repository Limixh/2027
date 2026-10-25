// Telefondan fotoğraf yükleme penceresi: yerel ağ sunucusunu başlatır ve QR kod gösterir.
import { Smartphone, Wifi, WifiOff } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import type { PhoneServerInfo } from '../../../../shared/types'
import { SUBJECTS } from '@/data/curriculum'
import { useStore } from '@/lib/store'
import { Button, Modal } from '../ui'

/** Telefona gönderilen liste: dersler + konular ve kitaplar */
const catalogJson = (): string =>
  JSON.stringify({
    subjects: SUBJECTS.map((s) => ({ id: s.id, name: s.name, exam: s.exam, topics: s.topics.map((t) => ({ id: t.id, name: t.name, group: t.group })) })),
    books: (useStore.getState().data.books ?? []).map((b) => ({ id: b.id, title: b.title, subjectId: b.subjectId }))
  })

export function PhoneUploadModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  const [info, setInfo] = useState<PhoneServerInfo | null>(null)
  const [qr, setQr] = useState('')
  const [urlIndex, setUrlIndex] = useState(0)
  const desktop = !!window.api

  useEffect(() => {
    if (!open || !window.api) return
    let alive = true
    void window.api.phone.start(catalogJson()).then((i) => alive && setInfo(i))
    // Gelen yükleme sayısını güncel tut
    const off = window.api.phone.onUpload(() => void window.api!.phone.info().then((i) => alive && setInfo(i)))
    return () => {
      alive = false
      off()
    }
  }, [open])

  const url = info?.urls[urlIndex] ?? ''
  useEffect(() => {
    if (!url) return setQr('')
    void QRCode.toDataURL(url, { margin: 1, width: 560, errorCorrectionLevel: 'M' }).then(setQr)
  }, [url])

  return (
    <Modal open={open} onClose={onClose} title="Telefondan yükle" subtitle="Soru fotoğraflarını telefonla çekip doğrudan buraya gönder" width={620}>
      {!desktop ? (
        <p className="text-sm text-muted">Bu özellik yalnızca masaüstü uygulamasında çalışır.</p>
      ) : !info ? (
        <p className="text-sm text-muted">Bağlantı hazırlanıyor…</p>
      ) : !info.running || !info.urls.length ? (
        <div className="flex items-start gap-3 text-sm text-muted">
          <WifiOff size={18} className="mt-0.5 shrink-0 text-danger" />
          Bilgisayar bir ağa bağlı görünmüyor. Telefonla aynı Wi-Fi'a bağlanıp tekrar dene.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
          <div>
            {qr ? (
              <img src={qr} alt="QR kod" className="w-full rounded-xl bg-white p-2" />
            ) : (
              <div className="aspect-square w-full rounded-xl bg-surface-2" />
            )}
            <div className="mt-2 break-all text-center text-[11px] text-muted">{url.replace(/\?t=.*/, '')}</div>
          </div>
          <div className="text-sm">
            <ol className="space-y-3 text-muted">
              <li>
                <b className="text-text">1.</b> Telefon ve bilgisayar <b className="text-text">aynı Wi-Fi</b>'da olsun.
              </li>
              <li>
                <b className="text-text">2.</b> Telefonun kamerasıyla QR kodu okut, açılan bağlantıya dokun.
              </li>
              <li>
                <b className="text-text">3.</b> Sorunun fotoğrafını çek, istersen kendi çözümünü de ekle, dersi seç ve <b className="text-text">Gönder</b>.
              </li>
              <li>
                <b className="text-text">4.</b> Soru anında burada, Hata Defteri'nde "Telefondan geldi" olarak görünür. Sayfa açık kaldıkça arka arkaya gönderebilirsin.
              </li>
              <li>
                <b className="text-text">Çok soru mu var?</b> Telefonda <b className="text-text">Toplu</b> sekmesiyle hepsini fotoğraflayıp tek seferde gönder; bilgilerini
                burada <b className="text-text">Toplu giriş</b> ile tek tek gir.
              </li>
            </ol>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              <Wifi size={14} className="text-success" /> Bağlantı açık · bu oturumda {info.received} yükleme
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-subtle">
              Windows ilk seferde "Güvenlik duvarı" izni sorabilir: <b>Özel ağlar</b> kutusu işaretliyken <b>İzin ver</b> de. Bağlantı yalnızca
              evindeki ağda çalışır ve gizli bir anahtarla korunur.
            </p>
            {info.urls.length > 1 && (
              <button className="mt-2 text-xs text-accent hover:underline" onClick={() => setUrlIndex((i) => (i + 1) % info.urls.length)}>
                QR çalışmadıysa diğer ağ adresini dene ({urlIndex + 1}/{info.urls.length})
              </button>
            )}
          </div>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        {info?.running && (
          <Button
            variant="ghost"
            onClick={async () => {
              setInfo((await window.api?.phone.stop()) ?? null)
              onClose()
            }}
          >
            Bağlantıyı kapat
          </Button>
        )}
        <Button variant="primary" icon={<Smartphone size={15} />} onClick={onClose}>
          Tamam
        </Button>
      </div>
    </Modal>
  )
}
