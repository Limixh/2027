import type { ChatAttachment } from '../../../shared/types'

/** Kayıtlı ekin arayüzde gösterilebilir adresi (yalnızca masaüstü uygulamada) */
export const fileUrl = (a: ChatAttachment | string): string =>
  window.api ? `yks-file://local/${encodeURI(typeof a === 'string' ? a : a.rel)}` : ''

/** Tarayıcıdaki File nesnesini uygulama klasörüne kaydeder */
export async function saveFile(f: File): Promise<ChatAttachment> {
  if (!window.api) throw new Error('Dosya ekleme yalnızca masaüstü uygulamasında çalışır')
  const b64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })
  return window.api.ai.saveAttachment(f.name || `foto-${Date.now()}.jpg`, b64)
}
