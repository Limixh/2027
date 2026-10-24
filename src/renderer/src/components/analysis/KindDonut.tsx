import { PieChart as PieIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader, Dot } from '@/components/ui'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import type { MistakeKind } from '../../../../shared/types'
import { dominantKind, KINDS } from './derive'
import { TipBox } from './parts'

export const KIND_ADVICE: Record<MistakeKind, { title: string; tips: string[] }> = {
  bilgi: {
    title: 'Bilgi eksiği ağırlıkta',
    tips: [
      'Öncelikli listedeki konuya dön: önce kısa konu özeti, ardından o konudan 20-30 soru çöz.',
      'Yanlışlarını hata defterine yaz, 3 ve 7 gün sonra aynı soruları tekrar çöz.',
      'Formül ve kuralları tek sayfalık bir özet kartına dök.'
    ]
  },
  dikkat: {
    title: 'Dikkat hataları çok',
    tips: [
      'Soru kökünü işaretle: “değildir”, “yalnızca”, “en az” gibi ifadelerin altını çiz.',
      'Cevabı işaretlemeden önce şıkkı soruyla eşleştirerek son bir kontrol yap.',
      'Hesap hatalarında işlemi satır satır yaz; kafadan yapılan işlemleri azalt.'
    ]
  },
  sure: {
    title: 'Süre sorunu yaşıyorsun',
    tips: [
      'Turlama tekniği: ilk turda kolay ve orta soruları çöz, uzun soruları işaretleyip geç.',
      'Ders başına süre bütçesi belirle ve denemelerde kronometreyle uy.',
      'Haftada 1-2 kez süreli mini testler (20-30 soru) çözerek hız kazan.'
    ]
  },
  yorum: {
    title: 'Soru kökü / yorum hataları öne çıkıyor',
    tips: [
      'Soruyu kendi cümlenle yeniden ifade et; verilenleri ve istenenleri yan yana yaz.',
      'Grafik ve tablo sorularında önce eksenlere, birimlere ve başlıklara bak.',
      'Yeni nesil sorulardan daha fazla örnek çözüp çözümlerini incele.'
    ]
  },
  bos: {
    title: 'Çok soru boş kalıyor',
    tips: [
      'Boş bıraktığın soruların nedenini ayır: konu eksiği mi, süre mi, özgüven mi?',
      '1-2 şıkkı eleyebiliyorsan işaretlemek çoğu zaman net kazandırır (4 yanlış 1 doğruyu götürür).',
      'Bilmediğin konuları öncelik listesine ekleyip kısa tekrar yap.'
    ]
  },
  cozum: {
    title: 'Sorular çözüme bakarak yapılıyor',
    tips: [
      'Çözüme baktığın soruyu 1-2 gün sonra çözüme bakmadan yeniden çöz; Hata Defteri bunu otomatik planlar.',
      'Çözümü okuduktan sonra kapatıp kendi cümlelerinle adımları yaz; sadece okumak kalıcı olmaz.',
      'Aynı konudan 5-10 benzer soru çöz (AI ile benzer soru üretebilirsin).'
    ]
  }
}

export function KindDonut({ kinds }: { kinds: Record<MistakeKind, number> }): React.JSX.Element {
  const total = KINDS.reduce((a, k) => a + kinds[k], 0)
  const data = KINDS.filter((k) => kinds[k] > 0).map((k) => ({ kind: k, value: kinds[k] }))
  const dom = dominantKind(kinds)
  const second = KINDS.filter((k) => k !== dom && total > 0 && kinds[k] / total >= 0.25).sort((a, b) => kinds[b] - kinds[a])[0]

  return (
    <Card>
      <CardHeader icon={<PieIcon size={16} />} title="Hata türü dağılımı" subtitle="Neden yanlış yapıyorsun?" />
      {total === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-muted">Bu filtrede hata türü kaydı yok.</p>
      ) : (
        <div className="px-5 pb-5 pt-3">
          <div className="flex items-center gap-4">
            <div className="relative h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="kind"
                    innerRadius={46}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                    animationDuration={500}
                  >
                    {data.map((d) => (
                      <Cell key={d.kind} fill={MISTAKE_KIND_COLOR[d.kind]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as { kind: MistakeKind; value: number }
                      return (
                        <TipBox title={MISTAKE_KIND_LABEL[p.kind]}>
                          <div className="tabular">
                            {p.value} soru · %{Math.round((p.value / total) * 100)}
                          </div>
                        </TipBox>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="tabular text-xl font-semibold leading-none text-text">{total}</div>
                  <div className="mt-1 text-[10px] text-subtle">hatalı soru</div>
                </div>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {KINDS.map((k) => (
                <li key={k} className="flex items-center gap-2 text-xs">
                  <Dot color={MISTAKE_KIND_COLOR[k]} />
                  <span className="min-w-0 flex-1 truncate text-muted">{MISTAKE_KIND_LABEL[k]}</span>
                  <span className="tabular font-semibold text-text">{kinds[k]}</span>
                  <span className="tabular w-9 text-right text-subtle">%{total ? Math.round((kinds[k] / total) * 100) : 0}</span>
                </li>
              ))}
            </ul>
          </div>
          {dom && (
            <div
              className="mt-4 rounded-xl border p-3"
              style={{ borderColor: MISTAKE_KIND_COLOR[dom] + '40', background: MISTAKE_KIND_COLOR[dom] + '0f' }}
            >
              <div className="text-xs font-semibold" style={{ color: MISTAKE_KIND_COLOR[dom] }}>
                {KIND_ADVICE[dom].title}
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                {KIND_ADVICE[dom].tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {second && (
                <p className="mt-2 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-subtle">
                  <span className="font-semibold text-muted">{MISTAKE_KIND_LABEL[second]}</span> da dikkat çekiyor:{' '}
                  {KIND_ADVICE[second].tips[0]}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
