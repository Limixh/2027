// Soru formlarında "hangi kitaptan" seçimi: kitap + sayfa + soru no (istatistikler için).
import { useMemo } from 'react'
import type { Book, MistakeNote } from '../../../../shared/types'
import { Field, Input, Select } from '@/components/ui'
import { useStore } from '@/lib/store'

type Ref = NonNullable<MistakeNote['bookRef']>

export function BookFields({
  value,
  onChange,
  subjectId,
  onPickBook
}: {
  value?: Ref
  onChange: (v: Ref | undefined) => void
  /** Bu dersin kitapları listede önce gelir */
  subjectId?: string
  /** Kitap seçilince (ör. formun dersini kitabın dersine çekmek için) */
  onPickBook?: (b: Book) => void
}): React.JSX.Element | null {
  const all = useStore((s) => s.data.books)
  const books = useMemo(
    () => [...(all ?? [])].sort((a, b) => Number(b.subjectId === subjectId) - Number(a.subjectId === subjectId) || a.title.localeCompare(b.title, 'tr')),
    [all, subjectId]
  )
  if (!books.length) return null
  const num = (s: string): number | undefined => Number(s.replace(/\D/g, '')) || undefined
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-3">
      <Field label="Kitap (isteğe bağlı)">
        <Select
          value={value?.bookId ?? ''}
          onChange={(e) => {
            const b = books.find((x) => x.id === e.target.value)
            onChange(b ? { ...value, bookId: b.id } : undefined)
            if (b) onPickBook?.(b)
          }}
        >
          <option value="">— Kitap seçme —</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
              {b.publisher ? ` (${b.publisher})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sayfa">
        <Input inputMode="numeric" disabled={!value} value={value?.page ?? ''} onChange={(e) => value && onChange({ ...value, page: num(e.target.value) })} placeholder="—" />
      </Field>
      <Field label="Soru no">
        <Input inputMode="numeric" disabled={!value} value={value?.question ?? ''} onChange={(e) => value && onChange({ ...value, question: num(e.target.value) })} placeholder="—" />
      </Field>
    </div>
  )
}
