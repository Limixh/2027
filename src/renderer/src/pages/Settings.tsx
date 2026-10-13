import {
  Bot,
  Database,
  Download,
  FlaskConical,
  Info,
  KeyRound,
  Palette,
  Target,
  Trash2,
  Upload,
  UserRound
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Field as ExamField, Settings, UpdateStatus } from '../../../shared/types'
import { Button, Card, CardHeader, confirm, Field, Input, NumberInput, PageHeader, Segmented, Select, toast } from '@/components/ui'
import { CURRICULUM_NOTE, TOTAL_TOPICS } from '@/data/curriculum'
import { AI_MODELS } from '@/lib/aiContext'
import { FIELD_LABEL } from '@/lib/exam'
import { generateSampleData } from '@/lib/sampleData'
import { normalize, useStore } from '@/lib/store'

function Section({
  icon,
  title,
  subtitle,
  children
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="px-5 pb-5 pt-4">{children}</div>
    </Card>
  )
}

function AiSettings(): React.JSX.Element {
  const settings = useStore((s) => s.data.settings)
  const update = useStore((s) => s.updateSettings)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const desktop = !!window.api

  useEffect(() => {
    if (window.api) void window.api.ai.hasKey().then(setHasKey)
  }, [])

  const save = async (): Promise<void> => {
    if (!window.api || !key) return
    setBusy(true)
    await window.api.ai.setKey(key)
    const res = await window.api.ai.testKey(settings.aiModel)
    setBusy(false)
    if (res.ok) {
      setHasKey(true)
      setKey('')
      toast('Bağlantı başarılı — AI Koç hazır')
    } else {
      await window.api.ai.clearKey()
      setHasKey(false)
      toast(res.message, 'error')
    }
  }

  const test = async (): Promise<void> => {
    if (!window.api) return
    setBusy(true)
    const res = await window.api.ai.testKey(settings.aiModel)
    setBusy(false)
    toast(res.ok ? `Bağlantı başarılı (${settings.aiModel})` : res.message, res.ok ? 'success' : 'error')
  }

  return (
    <Section icon={<Bot size={16} />} title="Yapay Zeka (Claude)" subtitle="AI Koç bağlantısı">
      {!desktop && <p className="mb-4 rounded-lg bg-warning/10 p-3 text-xs text-warning">Tarayıcı modunda AI devre dışıdır.</p>}
      <Field label="Bağlantı türü" className="mb-4">
        <Segmented
          value={settings.aiProvider}
          onChange={(v) => update({ aiProvider: v })}
          options={[
            { value: 'cli', label: 'Claude aboneliği' },
            { value: 'codex', label: 'ChatGPT aboneliği' },
            { value: 'api', label: 'Claude API anahtarı' }
          ]}
        />
        <span className="mt-1.5 block text-[11px] leading-relaxed text-subtle">
          {settings.aiProvider === 'cli'
            ? 'Bilgisayarına kurulu Claude Code üzerinden Pro/Max aboneliğini kullanır, ek ücret yok. Kurulum adımları AI Koç sayfasında.'
            : settings.aiProvider === 'codex'
              ? "Bilgisayarına kurulu OpenAI Codex CLI üzerinden ChatGPT Plus/Pro aboneliğini kullanır. Kurulum adımları AI Koç sayfasında."
              : 'console.anthropic.com hesabından kullandıkça ödenir; abonelikten ayrıdır.'}
        </span>
      </Field>
      {settings.aiProvider === 'codex' && (
        <Field label="ChatGPT modeli (isteğe bağlı)" hint="Boş bırakırsan ChatGPT hesabının varsayılan modeli kullanılır." className="mb-4">
          <Input value={settings.codexModel ?? ''} placeholder="varsayılan" onChange={(e) => update({ codexModel: e.target.value.trim() })} />
        </Field>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Model">
          <Select value={settings.aiModel} onChange={(e) => update({ aiModel: e.target.value })}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Düşünme derinliği (API)" hint="Yüksek = daha detaylı ama daha yavaş ve maliyetli">
          <Segmented
            value={settings.aiEffort}
            onChange={(v) => update({ aiEffort: v })}
            options={[
              { value: 'low', label: 'Hızlı' },
              { value: 'medium', label: 'Dengeli' },
              { value: 'high', label: 'Derin' }
            ]}
          />
        </Field>
      </div>
      {settings.aiProvider === 'api' && (
      <div className="mt-5 rounded-xl border border-border bg-surface-2/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <KeyRound size={15} className="text-accent" /> API anahtarı
          {hasKey !== null && (
            <span className={hasKey ? 'text-xs text-success' : 'text-xs text-subtle'}>{hasKey ? '● Kayıtlı' : '○ Yok'}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={hasKey ? 'Yeni anahtar ile değiştir…' : 'sk-ant-api03-…'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!desktop}
          />
          <Button variant="primary" disabled={!key || busy} onClick={() => void save()}>
            {busy ? 'Kontrol…' : 'Kaydet'}
          </Button>
          {hasKey && (
            <>
              <Button disabled={busy} onClick={() => void test()}>
                Test et
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (await confirm({ title: 'API anahtarı silinsin mi?', confirmText: 'Sil' })) {
                    await window.api?.ai.clearKey()
                    setHasKey(false)
                  }
                }}
              >
                Sil
              </Button>
            </>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-subtle">
          Anahtarını{' '}
          <button className="text-accent hover:underline" onClick={() => window.api?.openExternal('https://console.anthropic.com/settings/keys')}>
            console.anthropic.com
          </button>{' '}
          üzerinden alabilirsin. Anahtar bilgisayarında Windows (DPAPI) şifrelemesiyle saklanır ve yalnızca Anthropic API'sine gönderilir.
          Kullanım ücreti Anthropic hesabından düşülür.
        </p>
      </div>
      )}
    </Section>
  )
}

function UpdateRow(): React.JSX.Element {
  const [st, setSt] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    if (!window.api) return
    void window.api.update.status().then(setSt)
    return window.api.update.onEvent(setSt)
  }, [])
  const label: Record<UpdateStatus['state'], string> = {
    idle: '',
    checking: 'Denetleniyor…',
    uptodate: 'Güncelsin ✓',
    downloading: 'Yeni sürüm indiriliyor…',
    ready: `Sürüm ${st?.latest ?? ''} hazır — yeniden başlat`,
    'needs-reinstall': 'Yeni kurulum dosyası gerekiyor',
    error: st?.error ?? 'Hata'
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="text-sm">
        Sürüm <b className="tabular">{st?.current ?? __APP_VERSION__}</b>
        {st && st.state !== 'idle' && (
          <span className={st.state === 'error' ? 'ml-2 text-xs text-danger' : 'ml-2 text-xs text-muted'}>{label[st.state]}</span>
        )}
      </div>
      <div className="ml-auto flex gap-2">
        {st?.state === 'ready' ? (
          <Button size="sm" variant="primary" onClick={() => window.api?.update.install()}>
            Yeniden başlat
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!window.api || st?.state === 'checking' || st?.state === 'downloading'}
            onClick={async () => setSt((await window.api?.update.check()) ?? null)}
          >
            Güncellemeleri denetle
          </Button>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const s = data.settings
  const update = useStore((st) => st.updateSettings)
  const replaceAll = useStore((st) => st.replaceAll)
  const resetAll = useStore((st) => st.resetAll)
  const [dataPath, setDataPath] = useState('')

  useEffect(() => {
    if (window.api) void window.api.getDataPath().then(setDataPath)
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]): void => update({ [k]: v } as Partial<Settings>)

  const exportData = async (): Promise<void> => {
    const json = JSON.stringify(data, null, 2)
    if (window.api) {
      if (await window.api.exportData(json)) toast('Yedek kaydedildi')
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      a.download = `yks-yedek-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
    }
  }

  const importData = async (): Promise<void> => {
    let text: string | null = null
    if (window.api) text = await window.api.importData()
    else {
      text = await new Promise<string | null>((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = () => (input.files?.[0] ? void input.files[0].text().then(resolve) : resolve(null))
        input.click()
      })
    }
    if (!text) return
    try {
      const parsed = normalize(JSON.parse(text))
      if (!(await confirm({ title: 'Yedek yüklensin mi?', message: 'Mevcut tüm verilerin bu yedekle değiştirilecek.', confirmText: 'Yükle', danger: false })))
        return
      replaceAll(parsed)
      toast('Yedek yüklendi')
    } catch {
      toast('Dosya okunamadı — geçerli bir yedek değil', 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Ayarlar" description="Profil, hedefler, görünüm, yapay zeka ve veri yönetimi" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section icon={<UserRound size={16} />} title="Profil" subtitle="Sana özel analizler için">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Adın">
              <Input value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Adın" />
            </Field>
            <Field label="Alanın">
              <Select value={s.field} onChange={(e) => set('field', e.target.value as ExamField)}>
                {(Object.keys(FIELD_LABEL) as ExamField[]).map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABEL[f]} ({f === 'SOZ' ? 'SÖZ' : f === 'DIL' ? 'DİL' : f})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hedef bölüm / üniversite" className="md:col-span-2">
              <Input value={s.targetProgram} onChange={(e) => set('targetProgram', e.target.value)} placeholder="ör. Boğaziçi Bilgisayar Mühendisliği" />
            </Field>
            <Field label="OBP (diploma notu × 5)" hint="ör. diploma notu 85 → 425. Yerleştirme puanına ×0,12 eklenir.">
              <NumberInput value={s.obp} min={250} max={500} onChange={(v) => set('obp', v)} />
            </Field>
            <Field label="Sınav tarihi" hint="YKS 2027 tarihi açıklanınca güncelle (varsayılan tahmini).">
              <Input type="date" value={s.examDate} onChange={(e) => e.target.value && set('examDate', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section icon={<Target size={16} />} title="Hedefler" subtitle="Grafiklerde ve heatmap'te kullanılır">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Günlük çalışma hedefi (dk)" hint={`${(s.dailyGoalMinutes / 60).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} saat`}>
              <NumberInput value={s.dailyGoalMinutes} min={0} max={1000} onChange={(v) => set('dailyGoalMinutes', v)} />
            </Field>
            <Field label="Hedef TYT net" hint="120 üzerinden">
              <NumberInput value={s.targetTytNet} max={120} onChange={(v) => set('targetTytNet', v)} />
            </Field>
            <Field label="Hedef AYT net" hint="Alanındaki 80 soru üzerinden">
              <NumberInput value={s.targetAytNet} max={160} onChange={(v) => set('targetAytNet', v)} />
            </Field>
            <Field label="Pomodoro süresi (dk)">
              <NumberInput value={s.pomodoroMinutes} min={5} max={180} onChange={(v) => set('pomodoroMinutes', v)} />
            </Field>
            <Field label="Mola süresi (dk)">
              <NumberInput value={s.breakMinutes} min={1} max={60} onChange={(v) => set('breakMinutes', v)} />
            </Field>
          </div>
        </Section>

        <Section icon={<Palette size={16} />} title="Görünüm">
          <Segmented
            value={s.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { value: 'dark', label: 'Koyu' },
              { value: 'light', label: 'Açık' },
              { value: 'system', label: 'Sistem' }
            ]}
          />
        </Section>

        <AiSettings />

        <Section icon={<Database size={16} />} title="Veriler" subtitle="Tüm veriler bilgisayarında yerel olarak saklanır">
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download size={15} />} onClick={() => void exportData()}>
              Yedek al (JSON)
            </Button>
            <Button icon={<Upload size={15} />} onClick={() => void importData()}>
              Yedekten yükle
            </Button>
            <Button
              icon={<FlaskConical size={15} />}
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Örnek veri yüklensin mi?',
                    message: 'Uygulamayı tanımak için 4 aylık örnek çalışma, deneme ve konu verisi oluşturulur. Mevcut verilerin SİLİNİR (önce yedek al).',
                    confirmText: 'Örnek veriyi yükle'
                  })
                ) {
                  replaceAll(generateSampleData(data))
                  toast('Örnek veri yüklendi')
                }
              }}
            >
              Örnek veri yükle
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={async () => {
                if (await confirm({ title: 'Tüm veriler silinsin mi?', message: 'Çalışmalar, denemeler, konu ilerlemesi, hata defteri ve sohbetler silinir. Ayarların korunur.' })) {
                  resetAll()
                  toast('Veriler sıfırlandı', 'info')
                }
              }}
            >
              Tümünü sıfırla
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Çalışma', data.sessions.length],
              ['Deneme', data.exams.length],
              ['Hata notu', data.mistakeNotes.length]
            ].map(([l, n]) => (
              <div key={l} className="rounded-lg bg-surface-2 py-2">
                <div className="tabular text-base font-semibold">{n}</div>
                <div className="text-subtle">{l}</div>
              </div>
            ))}
          </div>
          {dataPath && <p className="mt-3 break-all text-[11px] text-subtle">Veri dosyası: {dataPath} (günlük otomatik yedek: backups klasörü)</p>}
        </Section>

        <Section icon={<Info size={16} />} title="Hakkında">
          <UpdateRow />
          <p className="text-sm text-muted">
            YKS 2027 Takip — çalışma süresi, denemeler, {TOTAL_TOPICS} konuluk müfredat takibi, hata analizi ve Claude destekli AI koç.
          </p>
          <p className="mt-3 rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-info">{CURRICULUM_NOTE}</p>
        </Section>
      </div>
    </div>
  )
}
