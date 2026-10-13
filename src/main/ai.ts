import Anthropic from '@anthropic-ai/sdk'
import { app, safeStorage, type WebContents } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AiChatRequest, AiStreamEvent } from '../shared/types'

// API anahtarı, Windows'ta DPAPI ile (safeStorage) şifrelenerek kullanıcı klasöründe saklanır.
const keyFile = (): string => join(app.getPath('userData'), 'anthropic.key')

function readKey(): string | null {
  const file = keyFile()
  if (!existsSync(file)) return null
  try {
    const buf = readFileSync(file)
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
    return buf.toString('utf8')
  } catch {
    return null
  }
}

export function hasKey(): boolean {
  return !!readKey()
}

export function setKey(key: string): void {
  const trimmed = key.trim()
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.from(trimmed, 'utf8')
  writeFileSync(keyFile(), data)
}

export function clearKey(): void {
  if (existsSync(keyFile())) unlinkSync(keyFile())
}

function client(): Anthropic {
  const apiKey = readKey()
  if (!apiKey) throw new Error('API anahtarı ayarlı değil. Ayarlar > Yapay Zeka bölümünden ekleyin.')
  return new Anthropic({ apiKey })
}

// Haiku dışındaki güncel modellerde, güvenlik sınıflandırıcısı isteği reddederse
// sunucu tarafında otomatik olarak uygun bir modele düşülür.
const supportsFallback = (model: string): boolean => /opus|sonnet|fable/.test(model)

function errorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'API anahtarı geçersiz (401). Anahtarı kontrol edin.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'Bu anahtarın bu modele erişim izni yok (403).'
  if (err instanceof Anthropic.NotFoundError) return 'Model bulunamadı (404). Ayarlardan başka bir model seçin.'
  if (err instanceof Anthropic.RateLimitError) return 'İstek limiti aşıldı (429). Biraz bekleyip tekrar deneyin.'
  if (err instanceof Anthropic.APIConnectionError) return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
  if (err instanceof Anthropic.APIError) return `API hatası (${err.status ?? '?'}): ${err.message}`
  if (err instanceof Error) return err.message
  return String(err)
}

const controllers = new Map<string, AbortController>()

export async function testKey(model: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await client().messages.create({
      model,
      max_tokens: 512,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Sadece "Bağlantı başarılı" yaz.' }]
    })
    const text = res.content.find((b) => b.type === 'text')
    return { ok: true, message: text && text.type === 'text' ? text.text : 'Bağlantı başarılı' }
  } catch (err) {
    return { ok: false, message: errorMessage(err) }
  }
}

export async function chat(sender: WebContents, req: AiChatRequest): Promise<void> {
  const send = (ev: AiStreamEvent): void => {
    if (!sender.isDestroyed()) sender.send('ai:event', ev)
  }
  const controller = new AbortController()
  controllers.set(req.requestId, controller)
  try {
    const params = {
      model: req.model,
      max_tokens: 32000,
      output_config: { effort: req.effort },
      // Sistem istemi her mesajda aynı kaldığı için önbelleğe alınır.
      system: [
        { type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } },
        ...(req.context ? [{ type: 'text' as const, text: req.context }] : [])
      ],
      messages: req.messages
    }
    const fallback = supportsFallback(req.model)
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
      : {}
    const stream = client().beta.messages.stream(
      { ...params, ...fallback } as Parameters<Anthropic['beta']['messages']['stream']>[0],
      { signal: controller.signal }
    )

    stream.on('text', (text: string) => send({ requestId: req.requestId, type: 'text', text }))
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      send({ requestId: req.requestId, type: 'error', message: 'Model bu isteği yanıtlamayı reddetti. Soruyu farklı ifade etmeyi deneyin.' })
      return
    }
    send({ requestId: req.requestId, type: 'done', stopReason: final.stop_reason, model: final.model })
  } catch (err) {
    if (controller.signal.aborted) {
      send({ requestId: req.requestId, type: 'done', stopReason: 'aborted', model: req.model })
    } else {
      send({ requestId: req.requestId, type: 'error', message: errorMessage(err) })
    }
  } finally {
    controllers.delete(req.requestId)
  }
}

export function abort(requestId: string): void {
  controllers.get(requestId)?.abort()
}
