// İkinci Beyin'i geriye dönük doldurma: daha önce AI ile analiz edilmiş ama becerisi
// çıkarılmamış soruların analiz metinlerinden becerileri çıkarır (görsel göndermeden, hızlı).
import type { BrainPlan, Skill } from '../../../shared/types'
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
${n.usedSolution ?'Öğrenci bu soruyu çözüme bakarak yaptı: hiçbir adım onun başarısı sayılmaz (basari yazma).\n' : n.usedHint ? `Öğrenci yalnızca bir ipucuna bakıp gerisini kendisi yaptı${n.hintSeen ? ` (gördüğü: "${n.hintSeen}")` : ''}: ipucundaki fikir eksik, sonrasında kendi doğru yaptıkları basari olabilir.\n` : ''}${n.comments?.length ? `Öğrencinin yorumları:\n${n.comments.map((c) => `- ${c.text}`).join('\n')}\n` : ''}
<analiz>
${(n.aiAnalysis ?? '').slice(0, 6000)}
</analiz>
${memory ? `\n<ogrencinin_beceri_hafizasi>\n${memory}\n</ogrencinin_beceri_hafizasi>\n` : ''}
Kurallar: Beceri adı KONUDAN BAĞIMSIZ ve yeniden kullanılabilir olsun (ör. "Denklem sisteminde yok etme yöntemi"). Hafızadaki bir beceriyi yalnızca bu sorudaki adım gerçekten aynı düşünce adımıysa kullan (id'sini ve adını aynen yaz); sadece benzer / ilişkili ise yamama, isabetli adlı yeni bir beceri aç. Bu sorular öğrencinin kendi başına ÇÖZEMEDİĞİ sorulardır. role: yapamadığı adım = eksik, zorlandığı/çözüme bakarak geçtiği = zayif; basari yalnızca öğrencinin kendi denemesinde açıkça kendi başına doğru yaptığı adım için.
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
// kopyaları birleştirmeyi, adları netleştirmeyi, alan / tanım / önkoşul eklemeyi ÖNERİR.
// Alan, tanım ve önkoşul zararsızdır, kendiliğinden uygulanır; birleştirme ve yeniden adlandırma
// öğrencinin onayını bekler ve geri alınabilir.

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
    const needs = (s.prereqIds ?? []).join(',')
    return `- id=${s.id} | "${s.name}"${s.area ? ` | alan: ${s.area}` : ''}${s.description ? ` | tanım: ${s.description.slice(0, 120)}` : ''} | konular: ${topics || '-'} | kanıt: ${s.evidence.length}${needs ? ` | önkoşullar: ${needs}` : ''}${details ? ` | örnek: ${details}` : ''}`
  })
  return `Aşağıda bir YKS öğrencisinin "beceri hafızası" var: yanlış yaptığı sorulardan çıkarılmış, konudan bağımsız beceriler.
Görevin bu hafızayı düzenli tutmak:
1. merge: AYNI beceriyi anlatan kopyaları birleştir (farklı kelimelerle yazılmış ama aynı düşünce adımı / aynı yöntem). Yalnızca gerçekten aynıysa birleştir; ilişkili ama farklı becerileri (ör. "çarpanlara ayırma" ile "ortak paranteze alma") ayrı bırak. "into" en açık/genel adlı olanın id'si olsun. reason: öğrencinin anlayacağı kısa gerekçe.
2. rename: adı konuya bağlı ya da belirsiz olanlara kısa, konudan bağımsız, yeniden kullanılabilir ad ver (ör. "Parabolde tepe noktası" değil "Tam kareye tamamlama" — eğer beceri gerçekten buysa).
3. area: alanı olmayan ya da tutarsız olan her beceriye genel alan ver. Aynı türdeki becerilere AYNI alan adını kullan (ör. "Cebir", "Fonksiyonlar", "Sayılar", "Olasılık", "Geometri", "Paragraf", "Dil bilgisi", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Okuma ve dikkat", "Strateji").
4. describe: tanımı olmayanlara tek cümlelik genel tanım yaz.
5. prereq: listedeki beceriler arasındaki ÖNKOŞUL ilişkileri. "id" becerisini yapabilmek için önce "needs" becerilerinin oturmuş olması GEREKİYORSA yaz (ör. "Tam kareye tamamlama" → needs "Çarpanlara ayırma"; "Koşullu olasılık" → needs "Temel olasılık hesabı"). Yalnızca açık ve güçlü bağımlılıklar; döngü kurma; yalnızca listedeki id'leri kullan; zaten yazılı önkoşulları tekrar yazma.
Değişiklik gerekmiyorsa ilgili listeyi boş bırak. Bilinmeyen id kullanma.

<beceriler>
${rows.join('\n')}
</beceriler>

Yalnızca şu JSON'u yaz, başka hiçbir şey yazma:
{"merge":[{"into":"id","from":["id"],"reason":"kısa"}],"rename":[{"id":"id","name":"..."}],"area":[{"id":"id","area":"..."}],"describe":[{"id":"id","description":"..."}],"prereq":[{"id":"id","needs":["id"]}]}`
}

export interface ConsolidationResult {
  merged: number
  renamed: number
  areas: number
  described: number
  prereqs: number
}

const emptyResult = (): ConsolidationResult => ({ merged: 0, renamed: 0, areas: 0, described: 0, prereqs: 0 })

/** AI'nin önerisini mevcut hafızaya göre temizler (bilinmeyen id, boş değer, kendine bağlama) */
export function sanitizePlan(plan: BrainPlan): BrainPlan {
  const skills = useStore.getState().data.skills
  const has = (id: unknown): id is string => typeof id === 'string' && skills.some((s) => s.id === id)
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  return {
    merge: (plan.merge ?? [])
      .filter((m) => has(m?.into) && Array.isArray(m.from))
      .map((m) => ({ into: m.into, from: [...new Set(m.from.filter((f) => has(f) && f !== m.into))], reason: str(m.reason) || undefined }))
      .filter((m) => m.from.length),
    rename: (plan.rename ?? [])
      .filter((r) => has(r?.id) && str(r.name) && str(r.name) !== skills.find((s) => s.id === r.id)?.name)
      .map((r) => ({ id: r.id, name: str(r.name) })),
    area: (plan.area ?? []).filter((a) => has(a?.id) && str(a.area)).map((a) => ({ id: a.id, area: str(a.area) })),
    describe: (plan.describe ?? []).filter((x) => has(x?.id) && str(x.description)).map((x) => ({ id: x.id, description: str(x.description) })),
    prereq: (plan.prereq ?? [])
      .filter((p) => has(p?.id) && Array.isArray(p.needs))
      .map((p) => ({ id: p.id, needs: [...new Set(p.needs.filter((n) => has(n) && n !== p.id))] }))
      .filter((p) => p.needs.length)
  }
}

/** Zararsız kısımlar: alan, tanım (yalnızca boşsa), önkoşul (döngü kurmadan eklenir) */
function applySafe(plan: BrainPlan, res: ConsolidationResult): void {
  const st = useStore.getState()
  const find = (id: string): Skill | undefined => useStore.getState().data.skills.find((k) => k.id === id)
  for (const a of plan.area ?? []) {
    if (find(a.id)) {
      st.updateSkill(a.id, { area: a.area })
      res.areas++
    }
  }
  for (const x of plan.describe ?? []) {
    const s = find(x.id)
    if (s && !s.description) {
      st.updateSkill(s.id, { description: x.description })
      res.described++
    }
  }
  for (const p of plan.prereq ?? []) {
    const s = find(p.id)
    if (!s) continue
    // n zaten s'ye dayanıyorsa (n → s) ters bağ döngü kurar
    const add = p.needs.filter((n) => {
      const ns = find(n)
      return ns && !ns.prereqIds?.includes(s.id) && !s.prereqIds?.includes(n)
    })
    if (add.length) {
      st.updateSkill(s.id, { prereqIds: [...(s.prereqIds ?? []), ...add] })
      res.prereqs += add.length
    }
  }
}

/** Seçilen önerileri uygular; birleştirme / ad değişikliği varsa önce geri alma noktası alır */
export function applyConsolidation(plan: BrainPlan): ConsolidationResult {
  const st = useStore.getState()
  const res = emptyResult()
  const exists = (id: string): boolean => useStore.getState().data.skills.some((s) => s.id === id)
  if (plan.merge?.length || plan.rename?.length) st.snapshotBrain('Hafıza düzenlemesi')
  // Önce ad/alan/tanım/önkoşul (birleşince kaybolan id'ler için de geçerli olsun diye önce), sonra birleştir
  for (const r of plan.rename ?? []) {
    if (exists(r.id)) {
      st.updateSkill(r.id, { name: r.name })
      res.renamed++
    }
  }
  applySafe(plan, res)
  for (const m of plan.merge ?? []) {
    if (!exists(m.into)) continue
    for (const f of m.from) {
      if (f !== m.into && exists(f)) {
        st.mergeSkills(m.into, f)
        res.merged++
      }
    }
  }
  return res
}

let consolidating = false

/** AI'den hafıza düzenleme önerisi alır (uygulamaz). */
export async function proposeConsolidation(): Promise<BrainPlan | null> {
  if (consolidating) return null
  if (useStore.getState().data.skills.length < 2) return null
  consolidating = true
  try {
    const text = await askAi({ system: TUTOR_SYSTEM, prompt: consolidationPrompt() })
    const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const plan = sanitizePlan(JSON.parse(repairJson(raw)) as BrainPlan)
    useStore.getState().setBrainMeta({ lastConsolidatedAt: new Date().toISOString(), lastConsolidatedCount: useStore.getState().data.skills.length })
    return plan
  } finally {
    consolidating = false
  }
}

/** Önerinin onay gerektiren kısmı var mı */
export const needsApproval = (p?: BrainPlan): boolean => !!(p?.merge?.length || p?.rename?.length)

/**
 * Elle "Hafızayı düzenle": zararsız kısımları hemen uygular, onay gerektirenleri döndürür.
 */
export async function consolidateBrain(): Promise<{ applied: ConsolidationResult; pending: BrainPlan } | null> {
  const plan = await proposeConsolidation()
  if (!plan) return null
  const applied = emptyResult()
  applySafe(plan, applied)
  return { applied, pending: { merge: plan.merge, rename: plan.rename } }
}

/**
 * Son düzenlemeden bu yana hafıza belirgin büyüdüyse arka planda öneri al: zararsız kısımları uygula,
 * birleştirme / ad önerilerini onay için sakla (İkinci Beyin sayfasında görünür).
 */
export async function maybeConsolidate(): Promise<void> {
  const d = useStore.getState().data
  const last = d.brainMeta?.lastConsolidatedCount ?? 0
  if (d.skills.length < 4 || d.skills.length - last < 6) return
  try {
    const r = await consolidateBrain()
    if (r && needsApproval(r.pending)) useStore.getState().setBrainMeta({ pending: r.pending })
  } catch {
    /* sonra tekrar denenir */
  }
}
