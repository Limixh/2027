// "Bitti" diyaloğu: çalışma kaydı + konu durumu otomatik güncellenir.
import { useState } from 'react'
import type { PlanTask, TaskResult } from '../../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { toast } from '@/components/ui'
import { swElapsed, useStopwatch } from '@/lib/clocks'
import { useStore } from '@/lib/store'
import { STATUS_LABEL } from './meta'
import { GField, GInput, GSwitch, GlassModal, Pill } from './parts'
import { useActiveTask } from './stores'

const toNum = (s: string): number | undefined => {
  if (!s.trim()) return undefined
  const n = Math.max(0, Math.round(Number(s)))
  return Number.isFinite(n) ? n : undefined
}

export default function CompleteModal({ date, task, onClose }: { date: string; task: PlanTask; onClose: () => void }): React.JSX.Element {
  const completePlanTask = useStore((s) => s.completePlanTask)
  const updatePlanTask = useStore((s) => s.updatePlanTask)
  const topicProgress = useStore((s) => s.data.topicProgress)

  const isActive = useActiveTask.getState().taskId === task.id
  const [initial] = useState(() => {
    if (isActive) {
      const el = swElapsed(useStopwatch.getState())
      if (el >= 30000) return { minutes: Math.max(1, Math.round(el / 60000)), fromSw: true }
    }
    return { minutes: task.targetMinutes ?? 30, fromSw: false }
  })

  const questionKind = task.kind === 'soru' || task.kind === 'deneme'
  const [minutes, setMinutes] = useState(String(initial.minutes))
  const [showQ, setShowQ] = useState(questionKind || !!task.targetQuestions)
  const [solved, setSolved] = useState('')
  const [correct, setCorrect] = useState('')
  const [wrong, setWrong] = useState('')
  const [note, setNote] = useState('')
  const [completes, setCompletes] = useState(task.kind === 'konu' ? task.completesTopic !== false : !!task.completesTopic)

  const subject = task.subjectId ? SUBJECT_MAP[task.subjectId] : undefined
  const topic = task.topicId ? TOPIC_MAP[task.topicId] : undefined
  const min = toNum(minutes) ?? 0
  const c = toNum(correct) ?? 0
  const w = toNum(wrong) ?? 0
  const sv = toNum(solved) ?? (c + w > 0 ? c + w : 0)
  const invalid = c + w > sv && sv > 0

  // store.completePlanTask ile aynı mantık
  const cur = topic ? (topicProgress[task.topicId!]?.status ?? 0) : 0
  const target = task.kind === 'konu' ? (completes ? 2 : 1) : task.kind === 'soru' ? (completes ? 3 : 1) : 1
  let topicText: string
  if (!topic) topicText = 'Göreve konu bağlı olmadığı için konu durumu değişmeyecek.'
  else if (task.kind === 'tekrar') topicText = `“${topic.name}” tekrar edildi olarak işaretlenecek.`
  else if (target > cur) topicText = `“${topic.name}” konusunun durumu “${STATUS_LABEL[target as 1 | 2 | 3]}” olarak güncellenecek.`
  else topicText = `“${topic.name}” zaten “${STATUS_LABEL[cur]}” durumunda, değişmeyecek.`

  const confirmDone = (): void => {
    if (invalid) return
    const result: TaskResult = {
      minutes: min,
      solved: sv || undefined,
      correct: toNum(correct),
      wrong: toNum(wrong),
      note: note.trim() || undefined
    }
    if ((task.kind === 'konu' || task.kind === 'soru') && completes !== task.completesTopic) updatePlanTask(date, task.id, { completesTopic: completes })
    completePlanTask(date, task.id, result)
    if (useActiveTask.getState().taskId === task.id) {
      useStopwatch.getState().set({ running: false, startedAt: undefined, acc: 0, laps: [] })
      useActiveTask.getState().clear()
    }
    toast(`Görev tamamlandı${min > 0 ? ` · ${min} dk kaydedildi` : ''}`)
    onClose()
  }

  return (
    <GlassModal
      open
      onClose={onClose}
      title="Görevi bitir"
      subtitle={
        <>
          {task.title}
          {subject && <span> · {subject.short}</span>}
        </>
      }
      width={540}
      footer={
        <>
          <Pill onClick={onClose}>Vazgeç</Pill>
          <Pill tone="primary" onClick={confirmDone} disabled={invalid}>
            Görevi bitir
          </Pill>
        </>
      }
    >
      <div className="space-y-3.5">
        <GField label={initial.fromSw ? 'Çalışma süresi (dk) · kronometreden alındı' : 'Çalışma süresi (dk)'}>
          <GInput type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} autoFocus />
        </GField>
        {showQ ? (
          <div className="grid grid-cols-3 gap-3">
            <GField label="Çözülen soru">
              <GInput type="number" min={0} value={solved} onChange={(e) => setSolved(e.target.value)} placeholder={task.targetQuestions ? String(task.targetQuestions) : '0'} />
            </GField>
            <GField label="Doğru">
              <GInput type="number" min={0} value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="0" />
            </GField>
            <GField label="Yanlış">
              <GInput type="number" min={0} value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder="0" />
            </GField>
            {invalid && <p className="col-span-3 -mt-1 text-xs text-danger">Doğru + yanlış, çözülen soru sayısını aşamaz.</p>}
          </div>
        ) : (
          <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => setShowQ(true)}>
            + Soru sayısı ekle (isteğe bağlı)
          </button>
        )}
        {(task.kind === 'konu' || task.kind === 'soru') && (
          <GSwitch
            checked={completes}
            onChange={setCompletes}
            label="Konu tamamen bitti"
            hint={task.kind === 'konu' ? 'Kapalıysa konu “Çalışılıyor” olarak kalır.' : 'Kapalıysa konu “Çalışılıyor” olarak kalır, açıksa “Soru çözüldü” olur.'}
          />
        )}
        <GField label="Not (isteğe bağlı)">
          <GInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Parçalı integral zorlandım" onKeyDown={(e) => e.key === 'Enter' && confirmDone()} />
        </GField>
        <div className="rounded-2xl border border-text/10 bg-text/[0.05] px-4 py-3 text-sm leading-relaxed text-text">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Otomatik olarak</div>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>{min > 0 || sv > 0 ? `Çalışma kaydı eklenecek (${min} dk${sv ? `, ${sv} soru` : ''}).` : 'Süre ve soru girilmediği için çalışma kaydı eklenmeyecek.'}</li>
            <li>{topicText}</li>
            <li>Görev “yapıldı” olarak işaretlenecek; istersen Geri al ile bozabilirsin.</li>
          </ul>
        </div>
      </div>
    </GlassModal>
  )
}
