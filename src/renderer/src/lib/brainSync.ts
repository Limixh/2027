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
  const memory = memoryForPrompt(d, { subjectId: n.subjectId })
  return `Aşağıda öğrencinin yanlış yaptığı bir ${SUBJECT_MAP[n.subjectId]?.name ?? ''}${n.topicId ? ` (${TOPIC_MAP[n.topicId]?.name})` : ''} sorusunun daha önce yapılmış analizi var. Bu analize göre sorunun gerektirdiği 1-4 temel beceriyi çıkar.
${n.comments?.length ? `Öğrencinin yorumları:\n${n.comments.map((c) => `- ${c.text}`).join('\n')}\n` : ''}
<analiz>
${(n.aiAnalysis ?? '').slice(0, 6000)}
</analiz>
${memory ? `\n<ogrencinin_beceri_hafizasi>\n${memory}\n</ogrencinin_beceri_hafizasi>\n` : ''}
Kurallar: Beceri adı KONUDAN BAĞIMSIZ ve yeniden kullanılabilir olsun (ör. "Denklem sisteminde yok etme yöntemi"). Hafızada aynı ya da çok yakın beceri varsa yeni ad uydurma; onun id'sini ve adını aynen kullan. role: yapamadığı adım = eksik, zorlandığı/çözüme baktığı = zayif, doğru kullandığı = basari.
Yalnızca şu JSON'u yaz, başka hiçbir şey yazma:
{"skills":[{"id":"hafızadaki id ya da boş","name":"...","role":"eksik|zayif|basari","detail":"bu soruda rolü","description":"yeni beceriyse kısa tanım"}]}`
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
      const parsed = JSON.parse(repairJson(raw)) as { skills?: { id?: string; name: string; role?: string; detail?: string; description?: string }[] }
      if (parsed.skills?.length) useStore.getState().applySkillAnalysis(id, parsed.skills.filter((s) => s && typeof s.name === 'string'))
    } catch {
      /* bu notu atla */
    }
    done++
    onProgress?.(done, ids.length)
  }
  return done
}
