import { Download, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/types'
import { Button } from './ui'

/** Arka planda indirilen güncelleme hazır olunca sağ altta beliren bildirim */
export function UpdateBanner(): React.JSX.Element | null {
  const [st, setSt] = useState<UpdateStatus | null>(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!window.api) return
    void window.api.update.status().then(setSt)
    return window.api.update.onEvent(setSt)
  }, [])
  if (!st || hidden || (st.state !== 'ready' && st.state !== 'needs-reinstall')) return null
  return (
    <div className="card fixed bottom-5 left-[260px] z-[55] w-[340px] animate-fade-in p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <Download size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {st.state === 'ready' ? `Yeni sürüm hazır (${st.latest})` : `Yeni sürüm var (${st.latest})`}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {st.state === 'ready'
              ? st.notes || 'Güncelleme indirildi. Yeniden başlatınca uygulanır; verilerin korunur.'
              : 'Bu sürüm yeni bir kurulum dosyası gerektiriyor. GitHub sayfasından indirebilirsin.'}
          </p>
          {st.state === 'ready' && (
            <Button size="sm" variant="primary" className="mt-3" icon={<RefreshCw size={13} />} onClick={() => window.api?.update.install()}>
              Şimdi yeniden başlat
            </Button>
          )}
        </div>
        <button className="text-subtle hover:text-text" onClick={() => setHidden(true)} aria-label="Kapat">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
