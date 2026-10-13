import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { Select } from '@/components/ui'

/** TYT / AYT optgroup'lu ders listesi */
export function SubjectOptions(): React.JSX.Element {
  return (
    <>
      <optgroup label="TYT">
        {SUBJECTS.filter((s) => s.exam === 'TYT').map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="AYT">
        {SUBJECTS.filter((s) => s.exam === 'AYT').map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </optgroup>
    </>
  )
}

/** Seçili derse ait konular (varsa gruplarıyla) */
export function TopicOptions({ subjectId }: { subjectId?: string }): React.JSX.Element | null {
  const subject = subjectId ? SUBJECT_MAP[subjectId] : undefined
  if (!subject) return null
  const grouped = subject.topics.some((t) => t.group)
  if (!grouped) {
    return (
      <>
        {subject.topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </>
    )
  }
  const groups: { name: string; topics: typeof subject.topics }[] = []
  for (const t of subject.topics) {
    const name = t.group ?? 'Diğer'
    let g = groups.find((x) => x.name === name)
    if (!g) {
      g = { name, topics: [] }
      groups.push(g)
    }
    g.topics.push(t)
  }
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g.name} label={g.name}>
          {g.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

/** Ders + konu seçicisi çifti için yardımcı: sadece Select'ler, etiketleri çağıran koyar */
export function SubjectSelect({
  value,
  onChange,
  placeholder = 'Ders seç (isteğe bağlı)'
}: {
  value?: string
  onChange: (v?: string) => void
  placeholder?: string
}): React.JSX.Element {
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{placeholder}</option>
      <SubjectOptions />
    </Select>
  )
}

export function TopicSelect({
  subjectId,
  value,
  onChange
}: {
  subjectId?: string
  value?: string
  onChange: (v?: string) => void
}): React.JSX.Element {
  return (
    <Select
      value={value ?? ''}
      disabled={!subjectId}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{subjectId ? 'Konu seç (isteğe bağlı)' : 'Önce ders seçin'}</option>
      <TopicOptions subjectId={subjectId} />
    </Select>
  )
}
