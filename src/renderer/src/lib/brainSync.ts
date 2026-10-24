// İkinci Beyin'i geriye dönük doldurma: daha önce AI ile analiz edilmiş ama becerisi
// çıkarılmamış soruların analiz metinlerinden becerileri çıkarır (görsel göndermeden, hızlı).
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { repairJson } from './aiActions'
import { askAi, TUTOR_SYSTEM } from './aiRunner'
import { memoryForPrompt } from './brain'
import { useStore } from './store'

export const notesNeedingSkills = (): string[] =>
  useStore
    .getState()
    .data.mistakeNotes.filter((m) => m.aiAnalysis && !(m.skillIds?.length))
    .map((m) => m.id)

function prompt(noteId: string): string {
  const d = useStore.getState().data
  const n = d.mistakeNotes.find((m) => m.id === noteId)!
  const memory = memoryForPrompt(d, { subjectId: n.subjectId, topicId: n.topicId })
  return `Aşağıda öğrencinin yanlış yaptığı bir ${SUBJECT_MAP[n.subjectId]?.name ?? ''}${n.topicId ? ` (${TOPIC_MAP[n.topicId]?.name})` : ''} sorusunun daha önce yapılmış analizi var. Bu analize göre sorunun gerektirdiği 1-4 temel beceriyi çıkar.
${n.usedSolution || n.kind === 'cozum' ? 'Öğrenci bu soruyu çözüme bakarak yaptı: hiçbir adım onun başarısı sayılmaz (basari yazma).\n' : n.usedHint ? `Öğrenci yalnızca bir ipucuna bakıp gerisini kendisi yaptı${n.hintSeen ? ` (gördüğü: "${n.hintSeen}")` : ''}: ipucundaki fikir eksik, sonrasında kendi doğru yaptıkları basari olabilir.\n` : ''}${n.comments?.length ? `Öğrencinin yorumları:\n${n.comments.map((c) => `- ${c.text}`).join('\n')}\n` : ''}
<analiz>
${(n.aiAnalysis ?? '').slice(0, 6000)}
</analiz>
${memory ? `\n<ogrencinin_beceri_hafizasi>\n${memory}\n</ogrencinin_beceri_hafizasi>\n` : ''}
Kurallar: Beceri adı KONUDAN BAĞIMSIZ ve yeniden kullanılabilir olsun (ör. "Denklem sisteminde yok etme yöntemi"). Hafızada aynı ya da çok yakın beceri varsa yeni ad uydurma; onun id'sini ve adını aynen kullan. Bu sorular öğrencinin kendi başına ÇÖZEMEDİĞİ sorulardır. role: yapamadığı adım = eksik, zorlandığı/çözüme bakarak geçtiği = zayif; basari yalnızca öğrencinin kendi denemesinde açıkça kendi başına doğru yaptığı adım için.
Yalnızca şu JSON'u yaz, başka hiçbir şey yazma:
{"skills":[{"id":"hafızadaki id ya da boş","name":"...","role":"eksik|zayif|basari","detail":"bu soruda rolü","description":"yeni beceriyse kısa tanım","area":"genel alan, ör. Cebir / Olasılık / Paragraf"}]}`
}

/** Sırayla işler; ilerlemeyi bildirir. Hata olursa o notu atlar. */
export async function backfillSkills(onProgress?: (done: number, total: number) => void, signal?: { stop: boolean }): Promise<number> {
  const ids = notesNeedingSkills()
  let done = 0
  for (const id of ids) {
    if (signal?.stop) break
    try {
      const text = await askAi({ system: TUTOR_SYSTEM, prompt: prompt(id) })
      const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      const parsed = JSON.parse(repairJson(raw)) as { skills?: { id?: string; name: string; role?: string; detail?: string; description?: string; area?: string }[] }
      if (parsed.skills?.length) useStore.getState().applySkillAnalysis(id, parsed.skills.filter((s) => s && typeof s.name === 'string'))
    } catch {
      /* bu notu atla */
    }
    done++
    onProgress?.(done, ids.length)
  }
  void maybeConsolidate()
  return done
}

// ---------------------------------------------------------------------------
// Hafıza bakımı: zamanla aynı beceri farklı adlarla birikebilir. AI tüm beceri listesine bakıp
// kopyaları birleştirir, adları netleştirir, alan (Cebir, Olasılık...) ve tanım ekler.

interface ConsolidationPlan {
  merge?: { into: string; from: string[]; reason?: string }[]
  rename?: { id: string; name: string }[]
  area?: { id: string; area: string }[]
  describe?: { id: string; description: string }[]
}

function consolidationPrompt(): string {
  const d = useStore.getState().data
  const rows = d.skills.map((s) => {
    const topics = s.topicIds.map((t) => TOPIC_MAP[t]?.name ?? t).join(', ')
    const details = s.evidence
      .slice(-2)
      .map((e) => e.detail)
      .filter(Boolean)
      .map((x) => x!.slice(0, 90))
      .join(' / ')
    return `- id=${s.id} | "${s.name}"${s.area ? ` | alan: ${s.area}` : ''}${s.description ? ` | tanım: ${s.description.slice(0, 120)}` : ''} | konular: ${topics || '-'} | kanıt: ${s.evidence.length}${details ? ` | örnek: ${details}` : ''}`
  })
  return `Aşağıda bir YKS öğrencisinin "beceri hafızası" var: yanlış yaptığı sorulardan çıkarılmış, konudan bağımsız beceriler.
Görevin bu hafızayı düzenli tutmak:
1. merge: AYNI beceriyi anlatan kopyaları birleştir (farklı kelimelerle yazılmış ama aynı düşünce adımı / aynı yöntem). Yalnızca gerçekten aynıysa birleştir; ilişkili ama farklı becerileri (ör. "çarpanlara ayırma" ile "ortak paranteze alma") ayrı bırak. "into" en açık/genel adlı olanın id'si olsun.
2. rename: adı konuya bağlı ya da belirsiz olanlara kısa, konudan bağımsız, yeniden kullanılabilir ad ver (ör. "Parabolde tepe noktası" değil "Tam kareye tamamlama" — eğer beceri gerçekten buysa).
3. area: alanı olmayan ya da tutarsız olan her beceriye genel alan ver. Aynı türdeki becerilere AYNI alan adını kullan (ör. "Cebir", "Fonksiyonlar", "Sayılar", "Olasılık", "Geometri", "Paragraf", "Dil bilgisi", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Okuma ve dikkat", "Strateji").
4. describe: tanımı olmayanlara tek cümlelik genel tanım yaz.
Değişiklik gerekmiyorsa ilgili listeyi boş bırak. Bilinmeyen id kullanma.

<beceriler>
${rows.join('\n')}
</beceriler>

Yalnızca şu JSON'u yaz, başka hiçbir şey yazma:
{"merge":[{"into":"id","from":["id"],"reason":"kısa"}],"rename":[{"id":"id","name":"..."}],"area":[{"id":"id","area":"..."}],"describe":[{"id":"id","description":"..."}]}`
}

export interface ConsolidationResult {
  merged: number
  renamed: number
  areas: number
  described: number
}

export function applyConsolidation(plan: ConsolidationPlan): ConsolidationResult {
  const st = useStore.getState()
  const exists = (id: string): boolean => useStore.getState().data.skills.some((s) => s.id === id)
  const res: ConsolidationResult = { merged: 0, renamed: 0, areas: 0, described: 0 }
  // Önce ad/alan/tanım (birleşince kaybolan id'ler için de geçerli olsun diye önce), sonra birleştir
  for (const r of plan.rename ?? []) {
    const name = r?.name?.trim()
    if (r?.id && name && exists(r.id)) {
      st.updateSkill(r.id, { name })
      res.renamed++
    }
  }
  for (const a of plan.area ?? []) {
    const area = a?.area?.trim()
    if (a?.id && area && exists(a.id)) {
      st.updateSkill(a.id, { area })
      res.areas++
    }
  }
  for (const x of plan.describe ?? []) {
    const description = x?.description?.trim()
    const s = useStore.getState().data.skills.find((k) => k.id === x?.id)
    if (s && description && !s.description) {
      st.updateSkill(s.id, { description })
      res.described++
    }
  }
  for (const m of plan.merge ?? []) {
    if (!m?.into || !exists(m.into) || !Array.isArray(m.from)) continue
    for (const f of m.from) {
      if (typeof f === 'string' && f !== m.into && exists(f)) {
        st.mergeSkills(m.into, f)
        res.merged++
      }
    }
  }
  return res
}

let consolidating = false

/** Tüm hafızayı AI ile düzenler. */
export async function consolidateBrain(): Promise<ConsolidationResult | null> {
  if (consolidating) return null
  const d = useStore.getState().data
  if (d.skills.length < 2) return null
  consolidating = true
  try {
    const text = await askAi({ system: TUTOR_SYSTEM, prompt: consolidationPrompt() })
    const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const plan = JSON.parse(repairJson(raw)) as ConsolidationPlan
    const res = applyConsolidation(plan)
    useStore.getState().setBrainMeta({ lastConsolidatedAt: new Date().toISOString(), lastConsolidatedCount: useStore.getState().data.skills.length })
    return res
  } finally {
    consolidating = false
  }
}

/** Son düzenlemeden bu yana hafıza belirgin büyüdüyse arka planda düzenle (sessizce). */
export async function maybeConsolidate(): Promise<void> {
  const d = useStore.getState().data
  const last = d.brainMeta?.lastConsolidatedCount ?? 0
  if (d.skills.length < 4 || d.skills.length - last < 6) return
  try {
    await consolidateBrain()
  } catch {
    /* sonra tekrar denenir */
  }
}
