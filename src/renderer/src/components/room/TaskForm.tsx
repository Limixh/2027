// Plana görev ekleme / düzenleme formu (cam diyalog).
import { useState } from 'react'
import type { PlanTask, PlanTaskKind } from '../../../../shared/types'
import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { toast } from '@/components/ui'
import { useStore } from '@/lib/store'
import { KINDS, KIND_LABEL } from './meta'
import { GField, GInput, GSegmented, GSelect, GSwitch, GlassModal, Pill } from './parts'

const num = (s: string): number | undefined => {
  const n = Math.round(Number(s))
  return s.trim() && n > 0 ? n : undefined
}

export default function TaskForm({ date, task, onClose }: { date: string; task?: PlanTask; onClose: () => void }): React.JSX.Element {
  const addPlanTask = useStore((s) => s.addPlanTask)
  const updatePlanTask = useStore((s) => s.updatePlanTask)

  const [title, setTitle] = useState(task?.title ?? '')
  const [titleAuto, setTitleAuto] = useState(!task)
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? '')
  const [topicId, setTopicId] = useState(task?.topicId ?? '')
  const [kind, setKind] = useState<PlanTaskKind>(task?.kind ?? 'konu')
  const [scope, setScope] = useState(task?.scope ?? '')
  const [completes, setCompletes] = useState(task?.completesTopic ?? task?.kind !== 'soru')
  const [minutes, setMinutes] = useState(task?.targetMinutes ? String(task.targetMinutes) : '')
  const [questions, setQuestions] = useState(task?.targetQuestions ? String(task.targetQuestions) : '')
  const [time, setTime] = useState(task?.time ?? '')

  const subject = subjectId ? SUBJECT_MAP[subjectId] : undefined

  const pickKind = (k: PlanTaskKind): void => {
    setKind(k)
    if (!task) setCompletes(k === 'konu')
  }

  const pickTopic = (id: string): void => {
    setTopicId(id)
    const name = subject?.topics.find((t) => t.id === id)?.name
    if (name && (!title.trim() || titleAuto)) {
      setTitle(name)
      setTitleAuto(true)
    }
  }

  const submit = (): void => {
    if (!title.trim()) return
    const base = {
      title: title.trim(),
      subjectId: subjectId || undefined,
      topicId: topicId || undefined,
      kind,
      scope: scope.trim() || undefined,
      completesTopic: kind === 'konu' || kind === 'soru' ? completes : undefined,
      targetMinutes: num(minutes),
      targetQuestions: num(questions),
      time: time || undefined
    }
    if (task) {
      updatePlanTask(date, task.id, base)
      toast('Görev güncellendi')
    } else {
      addPlanTask(date, { ...base, source: 'manual' })
      toast('Görev eklendi')
    }
    onClose()
  }

  return (
    <GlassModal
      open
      onClose={onClose}
      title={task ? 'Görevi düzenle' : 'Görev ekle'}
      subtitle="Planına konu çalışması, soru çözümü, tekrar ya da deneme ekle."
      width={560}
      footer={
        <>
          <Pill onClick={onClose}>Vazgeç</Pill>
          <Pill tone="primary" onClick={submit} disabled={!title.trim()}>
            {task ? 'Kaydet' : 'Ekle'}
          </Pill>
        </>
      }
    >
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <GField label="Başlık">
          <GInput
            value={title}
            autoFocus
            placeholder="ör. Türev: tanım ve kurallar"
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleAuto(false)
            }}
          />
        </GField>
        <div className="grid grid-cols-2 gap-3">
          <GField label="Ders">
            <GSelect
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                setTopicId('')
              }}
            >
              <option value="">Seçilmedi</option>
              {(['TYT', 'AYT'] as const).map((ex) => (
                <optgroup key={ex} label={ex}>
                  {SUBJECTS.filter((s) => s.exam === ex).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </GSelect>
          </GField>
          <GField label="Konu">
            <GSelect value={topicId} onChange={(e) => pickTopic(e.target.value)} disabled={!subject}>
              <option value="">{subject ? 'Seçilmedi' : 'Önce ders seç'}</option>
              {subject?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </GSelect>
          </GField>
        </div>
        <GField label="Tür">
          <GSegmented value={kind} onChange={pickKind} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        </GField>
        <GField label="Kapsam (isteğe bağlı)">
          <GInput value={scope} onChange={(e) => setScope(e.target.value)} placeholder="ör. konunun ilk yarısı" />
        </GField>
        <div className="grid grid-cols-3 gap-3">
          <GField label="Hedef süre (dk)">
            <GInput type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="45" />
          </GField>
          <GField label="Hedef soru">
            <GInput type="number" min={0} value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder="40" />
          </GField>
          <GField label="Saat">
            <GInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </GField>
        </div>
        {(kind === 'konu' || kind === 'soru') && (
          <GSwitch
            checked={completes}
            onChange={setCompletes}
            label={kind === 'konu' ? 'Bu görev konuyu bitirir' : 'Bu görev konunun soru çözümünü bitirir'}
            hint="Görev bitince konu durumu buna göre güncellenir."
          />
        )}
        <button type="submit" className="hidden" />
      </form>
    </GlassModal>
  )
}
