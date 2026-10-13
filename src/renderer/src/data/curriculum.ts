// YKS 2027 müfredatı: ders ve konu listeleri.
//
// ÖNEMLİ: YKS 2027, mevcut (2018 tabanlı) MEB lise müfredatıyla yapılacak SON sınavdır.
// Türkiye Yüzyılı Maarif Modeli müfredatı YKS'yi 2028'den itibaren etkiler. Bu nedenle
// konu adları güncel YKS hazırlık kitaplarındaki klasik konu listelerini izler.

import type { ExamType, Field, Subject, Topic } from '../../../shared/types'

export const CURRICULUM_NOTE =
  'YKS 2027, mevcut (2018 tabanlı) müfredatla yapılacak son sınavdır. Maarif Modeli değişiklikleri 2028 YKS\'den itibaren geçerlidir.'

const TR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  I: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
  â: 'a',
  Â: 'a',
  î: 'i',
  Î: 'i',
  û: 'u',
  Û: 'u'
}

function slugify(name: string): string {
  const mapped = name.replace(/[çÇğĞıİIöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_MAP[c] ?? c)
  const slug = mapped
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'konu'
}

/** Konu listesi üretir; slug'ları otomatik çıkarır, çakışmalarda -2, -3 ekler. */
function t(subjectId: string, items: (string | [group: string, names: string[]])[]): Topic[] {
  const used = new Set<string>()
  const out: Topic[] = []
  const push = (name: string, group?: string): void => {
    const base = slugify(name)
    let slug = base
    let n = 2
    while (used.has(slug)) slug = `${base}-${n++}`
    used.add(slug)
    const topic: Topic = { id: `${subjectId}:${slug}`, name }
    if (group) topic.group = group
    out.push(topic)
  }
  for (const item of items) {
    if (typeof item === 'string') push(item)
    else for (const name of item[1]) push(name, item[0])
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Renkler (tailwind ~500 seviyesi)                                    */
/* ------------------------------------------------------------------ */

const C = {
  turkce: '#c46e6e',
  tarih: '#bd934c',
  tarih2: '#bf894b',
  cografya: '#53b6ab',
  cografya2: '#51b8af',
  felsefe: '#876bc7',
  din: '#b96ec4',
  matematik: '#6e70c4',
  geometri: '#4baebe',
  fizik: '#6a8dc7',
  kimya: '#c07d4f',
  biyoloji: '#59b079',
  edebiyat: '#c27098'
}

/* ------------------------------------------------------------------ */
/* TYT                                                                 */
/* ------------------------------------------------------------------ */

const TYT_TURKCE = t('tyt-turkce', [
  [
    'Anlam Bilgisi',
    [
      'Sözcükte Anlam',
      'Söz Yorumu (Deyim ve Atasözü)',
      'Cümlede Anlam',
      'Cümle Yorumu',
      'Anlatım Biçimleri'
    ]
  ],
  [
    'Paragraf',
    [
      'Paragrafta Konu-Ana Düşünce',
      'Paragrafta Yardımcı Düşünce',
      'Paragrafta Anlatım Teknikleri',
      'Paragrafta Düşünceyi Geliştirme Yolları',
      'Paragrafta Yapı',
      'Paragrafta Anlam Akışını Bozan Cümle',
      'Paragraf Tamamlama ve Sıralama'
    ]
  ],
  ['Yazım ve Noktalama', ['Yazım Kuralları', 'Noktalama İşaretleri']],
  [
    'Dil Bilgisi',
    [
      'Ses Bilgisi',
      'Sözcükte Yapı (Kök-Ek)',
      'Cümlenin Ögeleri',
      'Cümle Türleri',
      'Anlatım Bozukluğu'
    ]
  ],
  ['Sözcük Türleri', ['İsimler', 'Sıfatlar', 'Zamirler', 'Zarflar', 'Edat-Bağlaç-Ünlem']],
  ['Fiiller', ['Fiilde Anlam (Kip-Kişi)', 'Ek Fiil', 'Fiilimsiler', 'Fiilde Çatı']]
])

const TYT_TARIH = t('tyt-tarih', [
  [
    'Tarih Bilimi ve İlk Çağlar',
    ['Tarih ve Zaman', 'İnsanlığın İlk Dönemleri', 'İlk Çağ Uygarlıkları']
  ],
  [
    'Türk ve İslam Tarihi',
    [
      'İlk ve Orta Çağlarda Türk Dünyası',
      'İslam Medeniyetinin Doğuşu',
      'Türk-İslam Devletleri',
      'Türkiye Selçuklu Devleti ve Anadolu Beylikleri',
      'Osmanlı Devleti Kuruluş Dönemi'
    ]
  ],
  [
    'Osmanlı Devleti',
    [
      'Osmanlı Yükselme Dönemi',
      'Osmanlı Duraklama Dönemi',
      'Osmanlı Gerileme Dönemi',
      'Osmanlı Dağılma Dönemi',
      'Osmanlı Kültür ve Medeniyeti'
    ]
  ],
  [
    'Yakın Çağ ve İnkılap Tarihi',
    [
      'Yeni ve Yakın Çağlarda Avrupa',
      'XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya',
      'Milli Mücadele Hazırlık Dönemi',
      'Kurtuluş Savaşı Muharebeler Dönemi',
      'Atatürk İlke ve İnkılapları',
      'Atatürk Dönemi İç Politika',
      'Atatürk Dönemi Dış Politika',
      'İkinci Dünya Savaşı ve Sonrası',
      'Soğuk Savaş Dönemi ve Türkiye',
      'Toplumsal Devrim Çağında Dünya ve Türkiye'
    ]
  ]
])

const TYT_COGRAFYA = t('tyt-cografya', [
  [
    'Doğa ve Harita',
    [
      'Doğa ve İnsan',
      'Dünya\'nın Şekli ve Hareketleri',
      'Coğrafi Konum',
      'Harita Bilgisi'
    ]
  ],
  [
    'İklim',
    [
      'Atmosfer ve Sıcaklık',
      'Basınç ve Rüzgârlar',
      'Nem, Yağış ve Buharlaşma',
      'İklim Tipleri'
    ]
  ],
  [
    'Yeryüzü Şekilleri',
    ['İç Kuvvetler', 'Dış Kuvvetler', 'Su, Toprak ve Bitki Varlığı']
  ],
  ['Beşeri Coğrafya', ['Nüfus', 'Göçler', 'Yerleşme', 'Ekonomik Faaliyetler']],
  [
    'Türkiye ve Dünya',
    [
      'Türkiye\'nin Yer Şekilleri',
      'Türkiye\'nin İklimi ve Bitki Örtüsü',
      'Bölgeler ve Ülkeler',
      'Çevre ve Toplum',
      'Doğal Afetler'
    ]
  ]
])

const TYT_FELSEFE = t('tyt-felsefe', [
  'Felsefeyi Tanıma',
  'Felsefe ile Düşünme',
  'Felsefenin Alanı',
  'Bilgi Felsefesi',
  'Varlık Felsefesi',
  'Ahlak Felsefesi',
  'Sanat Felsefesi',
  'Din Felsefesi',
  'Siyaset Felsefesi',
  'Bilim Felsefesi'
])

const TYT_DIN = t('tyt-din', [
  'Bilgi ve İnanç',
  'Din ve İslam',
  'İslam ve İbadet',
  'Gençlik ve Değerler',
  'Ahlaki Tutum ve Davranışlar',
  'Hz. Muhammed\'in Hayatı',
  'Kur\'an-ı Kerim ve Özellikleri',
  'Vahiy ve Akıl',
  'İslam Düşüncesinde Yorumlar',
  'Din ve Hayat',
  'Yaşayan Dinler'
])

const TYT_MATEMATIK = t('tyt-matematik', [
  [
    'Sayılar',
    [
      'Temel Kavramlar',
      'Sayı Basamakları',
      'Bölme ve Bölünebilme',
      'EBOB-EKOK',
      'Rasyonel Sayılar',
      'Ondalık Sayılar',
      'Basit Eşitsizlikler',
      'Mutlak Değer',
      'Üslü Sayılar',
      'Köklü Sayılar',
      'Ardışık Sayılar',
      'Modüler Aritmetik'
    ]
  ],
  ['Cebir', ['Çarpanlara Ayırma', 'Oran-Orantı', 'Denklem Çözme']],
  [
    'Problemler',
    [
      'Sayı Problemleri',
      'Kesir Problemleri',
      'Yaş Problemleri',
      'Hareket-Hız Problemleri',
      'İşçi-Emek Problemleri',
      'Yüzde Problemleri',
      'Kâr-Zarar Problemleri',
      'Karışım Problemleri',
      'Grafik Problemleri',
      'Rutin Olmayan Problemler (Mantıksal Muhakeme)'
    ]
  ],
  ['Kümeler ve Mantık', ['Kümeler', 'Kartezyen Çarpım', 'Mantık']],
  ['Fonksiyon ve Denklemler', ['Fonksiyonlar', 'Polinomlar', '2. Dereceden Denklemler']],
  ['Sayma ve Olasılık', ['Permütasyon', 'Kombinasyon', 'Binom', 'Olasılık']],
  ['Veri', ['Veri-İstatistik']]
])

const TYT_GEOMETRI = t('tyt-geometri', [
  [
    'Temel Geometri',
    ['Temel Kavramlar ve Doğruda Açılar', 'Üçgende Açılar', 'Açı-Kenar Bağıntıları']
  ],
  [
    'Üçgenler',
    [
      'Dik Üçgen ve Pisagor Bağıntısı',
      'İkizkenar ve Eşkenar Üçgen',
      'Açıortay Bağıntıları',
      'Kenarortay Bağıntıları',
      'Üçgende Eşlik ve Benzerlik',
      'Üçgende Alan'
    ]
  ],
  [
    'Çokgenler ve Dörtgenler',
    [
      'Çokgenler',
      'Paralelkenar ve Eşkenar Dörtgen',
      'Dikdörtgen ve Kare',
      'Yamuk',
      'Deltoid',
      'Çevre ve Alan Hesapları'
    ]
  ],
  [
    'Çember ve Daire',
    ['Çemberde Açılar', 'Çemberde Uzunluk', 'Çember ve Daire Alanı']
  ],
  [
    'Analitik Geometri',
    ['Noktanın Analitik İncelenmesi', 'Doğrunun Analitik İncelenmesi']
  ],
  [
    'Katı Cisimler',
    ['Prizmalar', 'Piramit', 'Silindir', 'Koni', 'Küre']
  ],
  ['Dönüşüm Geometrisi', ['Öteleme, Yansıma ve Simetri']]
])

const TYT_FIZIK = t('tyt-fizik', [
  ['Fizik Bilimi', ['Fizik Bilimine Giriş', 'Madde ve Özellikleri']],
  ['Akışkanlar', ['Basınç', 'Kaldırma Kuvveti']],
  ['Isı', ['Isı, Sıcaklık ve Genleşme']],
  [
    'Mekanik',
    ['Hareket (Konum, Hız, İvme)', 'Newton\'un Hareket Yasaları', 'İş, Güç ve Enerji']
  ],
  [
    'Elektrik ve Manyetizma',
    ['Elektrostatik', 'Elektrik Akımı ve Devreler', 'Manyetizma']
  ],
  ['Dalgalar', ['Dalgalar', 'Ses Dalgaları']],
  [
    'Optik',
    [
      'Aydınlanma ve Gölge',
      'Düzlem Ayna',
      'Küresel Aynalar',
      'Işığın Kırılması',
      'Mercekler',
      'Prizmalar ve Renk'
    ]
  ]
])

const TYT_KIMYA = t('tyt-kimya', [
  'Kimya Bilimi',
  'Atom ve Periyodik Sistem',
  'Kimyasal Türler Arası Etkileşimler',
  'Maddenin Halleri',
  'Kimyanın Temel Kanunları',
  'Mol Kavramı',
  'Kimyasal Hesaplamalar',
  'Karışımlar',
  'Asitler, Bazlar ve Tuzlar',
  'Kimya Her Yerde'
])

const TYT_BIYOLOJI = t('tyt-biyoloji', [
  'Canlıların Ortak Özellikleri',
  'Canlıların Temel Bileşenleri',
  'Enzimler',
  'Nükleik Asitler',
  'Hücre ve Organelleri',
  'Hücre Zarı ve Madde Geçişleri',
  'Canlıların Sınıflandırılması',
  'Mitoz ve Eşeysiz Üreme',
  'Mayoz ve Eşeyli Üreme',
  'Kalıtımın Genel İlkeleri',
  'Ekosistem Ekolojisi',
  'Güncel Çevre Sorunları',
  'Biyoçeşitlilik'
])

/* ------------------------------------------------------------------ */
/* AYT                                                                 */
/* ------------------------------------------------------------------ */

const AYT_MATEMATIK = t('ayt-matematik', [
  [
    'Fonksiyonlar ve Denklemler',
    [
      'Fonksiyonlar',
      'Fonksiyonlarda Bileşke ve Ters Fonksiyon',
      'Polinomlar',
      '2. Dereceden Denklemler',
      'Eşitsizlikler ve Mutlak Değer',
      'Parabol'
    ]
  ],
  ['Sayı Sistemleri', ['Karmaşık Sayılar']],
  ['Üstel ve Logaritmik', ['Üstel Fonksiyonlar', 'Logaritma']],
  ['Diziler', ['Diziler', 'Aritmetik Dizi', 'Geometrik Dizi']],
  [
    'Trigonometri',
    [
      'Trigonometrik Fonksiyonlar',
      'Trigonometrik Özdeşlikler (Toplam-Fark, İki Kat Açı)',
      'Trigonometrik Denklemler',
      'Ters Trigonometrik Fonksiyonlar'
    ]
  ],
  ['Limit ve Süreklilik', ['Limit', 'Süreklilik']],
  [
    'Türev',
    [
      'Türev Alma Kuralları',
      'Türevin Geometrik Yorumu',
      'Maksimum-Minimum Problemleri',
      'Grafik Çizimi'
    ]
  ],
  ['İntegral', ['Belirsiz İntegral', 'Belirli İntegral', 'Alan Hesabı']],
  [
    'Sayma ve Olasılık',
    ['Sayma', 'Permütasyon', 'Kombinasyon', 'Binom Açılımı', 'Olasılık']
  ]
])

const AYT_GEOMETRI = t('ayt-geometri', [
  [
    'Üçgenler ve Çokgenler',
    [
      'Üçgenlerde Trigonometrik Bağıntılar (Sinüs-Kosinüs Teoremi)',
      'Üçgenin Alan Formülleri',
      'Çokgenler ve Dörtgenlerde Alan'
    ]
  ],
  [
    'Çember ve Daire',
    [
      'Çemberde Açılar',
      'Çemberde Teğet ve Kuvvet Bağıntıları',
      'Çemberde Uzunluk',
      'Daire Dilimi ve Daire Parçası'
    ]
  ],
  [
    'Analitik Geometri',
    [
      'Doğrunun Analitik İncelenmesi',
      'İki Doğru Arasındaki Açı ve Uzaklıklar',
      'Çemberin Analitik İncelenmesi'
    ]
  ],
  ['Dönüşümler', ['Öteleme', 'Yansıma', 'Dönme']],
  [
    'Katı Cisimler',
    ['Prizmalar', 'Piramitler', 'Silindir', 'Koni', 'Küre']
  ]
])

const AYT_FIZIK = t('ayt-fizik', [
  [
    'Kuvvet ve Hareket',
    [
      'Vektörler',
      'Bağıl Hareket',
      'Newton\'un Hareket Yasaları',
      'Bir Boyutta Sabit İvmeli Hareket',
      'İki Boyutta Hareket (Atışlar)',
      'Enerji ve Hareket',
      'İtme ve Çizgisel Momentum'
    ]
  ],
  [
    'Denge',
    ['Tork', 'Denge ve Denge Şartları', 'Kütle ve Ağırlık Merkezi', 'Basit Makineler']
  ],
  [
    'Elektrik ve Manyetizma',
    [
      'Elektriksel Kuvvet ve Elektrik Alan',
      'Elektriksel Potansiyel',
      'Düzgün Elektrik Alan ve Sığa',
      'Manyetizma ve Elektromanyetik İndüksiyon',
      'Alternatif Akım',
      'Transformatörler'
    ]
  ],
  [
    'Çembersel Hareket ve Çekim',
    [
      'Düzgün Çembersel Hareket',
      'Dönerek Öteleme Hareketi ve Açısal Momentum',
      'Kütle Çekim ve Kepler Yasaları',
      'Basit Harmonik Hareket'
    ]
  ],
  [
    'Dalgalar',
    [
      'Dalga Mekaniği',
      'Kırınım ve Girişim',
      'Doppler Olayı',
      'Elektromanyetik Dalgalar'
    ]
  ],
  [
    'Modern Fizik',
    [
      'Atom Fiziğine Giriş ve Radyoaktivite',
      'Özel Görelilik',
      'Kuantum Fiziğine Giriş',
      'Fotoelektrik Olayı',
      'Compton Saçılması ve De Broglie Dalga Boyu',
      'Modern Fiziğin Teknolojideki Uygulamaları'
    ]
  ]
])

const AYT_KIMYA = t('ayt-kimya', [
  [
    'Genel Kimya',
    [
      'Modern Atom Teorisi',
      'Gazlar',
      'Sıvı Çözeltiler ve Çözünürlük',
      'Kimyasal Tepkimelerde Enerji',
      'Kimyasal Tepkimelerde Hız',
      'Kimyasal Tepkimelerde Denge',
      'Asit-Baz Dengesi',
      'Çözünürlük Dengesi (Kçç)',
      'Kimya ve Elektrik'
    ]
  ],
  [
    'Organik Kimya',
    [
      'Karbon Kimyasına Giriş',
      'Hidrokarbonlar',
      'Alkoller ve Eterler',
      'Aldehitler ve Ketonlar',
      'Karboksilik Asitler ve Esterler'
    ]
  ],
  ['Uygulamalı Kimya', ['Enerji Kaynakları ve Bilimsel Gelişmeler']]
])

const AYT_BIYOLOJI = t('ayt-biyoloji', [
  [
    'İnsan Fizyolojisi',
    [
      'Sinir Sistemi',
      'Endokrin Sistem ve Hormonlar',
      'Duyu Organları',
      'Destek ve Hareket Sistemi',
      'Sindirim Sistemi',
      'Dolaşım ve Bağışıklık Sistemi',
      'Solunum Sistemi',
      'Boşaltım Sistemi',
      'Üreme Sistemi ve Embriyonik Gelişim'
    ]
  ],
  ['Ekoloji', ['Komünite ve Popülasyon Ekolojisi']],
  [
    'Genetik',
    [
      'Nükleik Asitlerin Yapısı ve DNA Replikasyonu',
      'Protein Sentezi',
      'Genetik Mühendisliği ve Biyoteknoloji',
      'Mutasyon ve Modifikasyon'
    ]
  ],
  [
    'Canlılarda Enerji Dönüşümleri',
    ['Fotosentez', 'Kemosentez', 'Hücresel Solunum', 'Fermantasyon']
  ],
  [
    'Bitki Biyolojisi',
    [
      'Bitkisel Dokular ve Organlar',
      'Bitkilerde Madde Taşınması',
      'Bitkilerde Büyüme ve Hormonlar',
      'Bitkilerde Üreme'
    ]
  ]
])

const AYT_EDEBIYAT = t('ayt-edebiyat', [
  [
    'Anlam ve Anlatım',
    [
      'Sözcükte Anlam',
      'Cümlede Anlam',
      'Paragraf',
      'Anlatım Bozuklukları',
      'Noktalama ve Yazım Kuralları'
    ]
  ],
  [
    'Şiir ve Edebi Sanatlar',
    [
      'Şiir Bilgisi (Nazım Birimi, Ölçü, Uyak-Redif)',
      'Söz Sanatları',
      'Edebi Sanatlar',
      'Metinlerin Sınıflandırılması'
    ]
  ],
  [
    'Türk Edebiyatı (Eski Dönem)',
    [
      'İslamiyet Öncesi Türk Edebiyatı',
      'Geçiş Dönemi Türk Edebiyatı',
      'Halk Edebiyatı (Anonim, Âşık, Tekke-Tasavvuf)',
      'Divan Edebiyatı Nazım Şekilleri',
      'Divan Edebiyatı Şairleri',
      'Divan Edebiyatı Nesri'
    ]
  ],
  [
    'Türk Edebiyatı (Yenileşme Dönemi)',
    [
      'Tanzimat Edebiyatı (1. Dönem)',
      'Tanzimat Edebiyatı (2. Dönem)',
      'Servet-i Fünun Edebiyatı',
      'Fecr-i Âti Edebiyatı',
      'Milli Edebiyat Dönemi'
    ]
  ],
  [
    'Cumhuriyet Dönemi',
    [
      'Cumhuriyet Dönemi Şiiri (Beş Hececiler ve Bağımsızlar)',
      'Garip Hareketi (I. Yeni)',
      'İkinci Yeni',
      'Toplumcu Gerçekçi Şiir',
      'Milli-Dini Duyarlılıkla Yazılan Şiir',
      'Cumhuriyet Dönemi Romanı',
      'Cumhuriyet Dönemi Hikâyesi',
      'Cumhuriyet Dönemi Tiyatrosu'
    ]
  ],
  [
    'Edebi Akımlar ve Dünya Edebiyatı',
    [
      'Edebi Akımlar (Batı)',
      'Dünya Edebiyatı',
      'Türk Edebiyatında Akımların Etkisi'
    ]
  ],
  [
    'Edebi Türler',
    [
      'Roman ve Hikâye',
      'Tiyatro',
      'Deneme',
      'Makale',
      'Fıkra (Köşe Yazısı)',
      'Eleştiri',
      'Sohbet ve Röportaj',
      'Anı, Gezi Yazısı, Biyografi ve Mektup',
      'Günlük (Günce) ve Otobiyografi'
    ]
  ]
])

const AYT_TARIH1 = t('ayt-tarih1', [
  [
    'Tarih Bilimi ve İlk Uygarlıklar',
    ['Tarih ve Zaman', 'İnsanlığın İlk Dönemleri', 'Orta Çağ\'da Dünya']
  ],
  [
    'Türk ve İslam Tarihi',
    [
      'İlk ve Orta Çağlarda Türk Dünyası',
      'İslam Medeniyetinin Doğuşu',
      'Türk-İslam Devletleri',
      'Türkiye Tarihi (Selçuklu ve Anadolu Beylikleri)'
    ]
  ],
  [
    'Osmanlı Devleti',
    [
      'Beylikten Devlete Osmanlı (Kuruluş)',
      'Dünya Gücü Osmanlı (Yükselme)',
      'Değişim Çağında Avrupa ve Osmanlı (Duraklama)',
      'Arayış Yılları (Gerileme)',
      'Osmanlı Kültür ve Medeniyeti',
      'Yeni Çağ Avrupa Tarihi'
    ]
  ],
  [
    'Yakın Çağ',
    ['XIX. Yüzyılda Değişen Devlet-Toplum İlişkileri', 'Osmanlı Devleti\'nde Islahat Hareketleri']
  ],
  [
    'T.C. İnkılap Tarihi ve Atatürkçülük',
    [
      'XX. Yüzyıl Başlarında Osmanlı ve I. Dünya Savaşı',
      'Milli Mücadele ve Kurtuluş Savaşı',
      'Atatürk İlkeleri ve İnkılaplar',
      'Atatürk Dönemi Türk Dış Politikası'
    ]
  ]
])

const AYT_TARIH2 = t('ayt-tarih2', [
  [
    'Osmanlı Son Dönem',
    [
      'Uluslararası İlişkilerde Denge Stratejisi (1774-1914)',
      'XX. Yüzyıl Başlarında Osmanlı Devleti',
      'I. Dünya Savaşı',
      'Mondros ve İşgaller'
    ]
  ],
  [
    'Milli Mücadele',
    [
      'Milli Mücadele Hazırlık Dönemi',
      'Kurtuluş Savaşı (Cepheler)',
      'Lozan ve Sonrası'
    ]
  ],
  [
    'Cumhuriyet Dönemi',
    [
      'Atatürkçülük ve Türk İnkılabı',
      'Atatürk İlkeleri',
      'Siyasi ve Hukuki İnkılaplar',
      'Eğitim ve Kültür İnkılapları',
      'Ekonomik ve Toplumsal Gelişmeler',
      'Atatürk Dönemi Dış Politika',
      'Atatürk Sonrası Türkiye'
    ]
  ],
  [
    'Dünya Tarihi',
    [
      'İki Savaş Arası Dönemde Dünya',
      'II. Dünya Savaşı',
      'Soğuk Savaş Dönemi',
      'Yumuşama Dönemi ve Sonrası',
      'Küreselleşen Dünya',
      'XXI. Yüzyılın Eşiğinde Türkiye ve Dünya'
    ]
  ]
])

const AYT_COGRAFYA1 = t('ayt-cografya1', [
  [
    'Doğal Sistemler',
    [
      'Doğa ve İnsan',
      'Dünya\'nın Şekli ve Hareketleri',
      'Harita Bilgisi',
      'Atmosfer ve Sıcaklık',
      'Basınç ve Rüzgârlar',
      'Nem, Yağış ve İklim Tipleri',
      'İç ve Dış Kuvvetler',
      'Su, Toprak ve Bitki Varlığı',
      'Biyoçeşitlilik'
    ]
  ],
  ['Beşeri Sistemler', ['Nüfus', 'Göçler', 'Yerleşme']],
  [
    'Türkiye ve Çevre',
    [
      'Türkiye\'nin Yer Şekilleri',
      'Türkiye\'de Ekonomik Faaliyetler',
      'Çevre ve Doğal Afetler'
    ]
  ]
])

const AYT_COGRAFYA2 = t('ayt-cografya2', [
  [
    'Doğal Sistemler',
    [
      'Ekosistem ve Madde Döngüleri',
      'Enerji Akışı ve Biyoçeşitlilik',
      'Doğal Kaynaklar ve Çevre Sorunları'
    ]
  ],
  [
    'Beşeri Sistemler',
    [
      'Nüfus Politikaları',
      'Türkiye\'nin Nüfus Özellikleri',
      'Şehirlerin Fonksiyonel Sınıflandırması',
      'Göç ve Şehirleşme'
    ]
  ],
  [
    'Ekonomik Faaliyetler',
    [
      'Tarım ve Hayvancılık',
      'Madenler ve Enerji Kaynakları',
      'Sanayi',
      'Ticaret, Ulaşım ve Turizm'
    ]
  ],
  [
    'Türkiye ve Dünya',
    [
      'Türkiye\'nin Coğrafi Bölgeleri',
      'Türkiye\'nin Jeopolitik Konumu',
      'Kültür Bölgeleri ve Medeniyetler',
      'Küresel Ortam: Bölgeler ve Ülkeler',
      'Uluslararası Örgütler ve Ulaşım Hatları',
      'Çevre ve Toplum',
      'Doğal Afetler ve Afet Yönetimi'
    ]
  ]
])

const AYT_FELSEFE = t('ayt-felsefe', [
  [
    'Felsefe',
    [
      'Felsefeyi Tanıma ve Felsefenin Alanı',
      'MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi',
      'MS 2. Yüzyıl - MS 15. Yüzyıl Felsefesi',
      '15. Yüzyıl - 17. Yüzyıl Felsefesi',
      '18. Yüzyıl - 19. Yüzyıl Felsefesi',
      '20. Yüzyıl Felsefesi',
      'Bilgi Felsefesi',
      'Varlık Felsefesi',
      'Ahlak Felsefesi',
      'Sanat Felsefesi',
      'Din Felsefesi',
      'Siyaset Felsefesi',
      'Bilim Felsefesi'
    ]
  ],
  [
    'Mantık',
    ['Mantığa Giriş', 'Klasik Mantık', 'Mantık ve Dil', 'Sembolik Mantık']
  ],
  [
    'Psikoloji',
    [
      'Psikoloji Bilimini Tanıma',
      'Psikolojinin Temel Süreçleri',
      'Öğrenme, Bellek ve Düşünme',
      'Ruh Sağlığının Temelleri'
    ]
  ],
  [
    'Sosyoloji',
    [
      'Sosyolojiye Giriş',
      'Birey ve Toplum',
      'Toplumsal Yapı',
      'Toplumsal Değişme ve Gelişme',
      'Toplum ve Kültür',
      'Toplumsal Kurumlar'
    ]
  ]
])

const AYT_DIN = t('ayt-din', [
  'Dünya ve Ahiret',
  'Kur\'an\'a Göre Hz. Muhammed',
  'Kur\'an\'da Bazı Kavramlar',
  'İnançla İlgili Meseleler',
  'Yahudilik ve Hristiyanlık',
  'Hint ve Çin Dinleri',
  'İslam ve Bilim',
  'Anadolu\'da İslam',
  'İslam Düşüncesinde Tasavvufi Yorumlar',
  'Güncel Dini Meseleler'
])

/* ------------------------------------------------------------------ */
/* Dersler                                                             */
/* ------------------------------------------------------------------ */

export const SUBJECTS: Subject[] = [
  // TYT
  {
    id: 'tyt-turkce',
    exam: 'TYT',
    name: 'Türkçe',
    short: 'Türkçe',
    color: C.turkce,
    questionCount: 40,
    section: 'Türkçe',
    fields: [],
    topics: TYT_TURKCE
  },
  {
    id: 'tyt-tarih',
    exam: 'TYT',
    name: 'Tarih',
    short: 'Tarih',
    color: C.tarih,
    questionCount: 5,
    section: 'Sosyal Bilimler',
    fields: [],
    topics: TYT_TARIH
  },
  {
    id: 'tyt-cografya',
    exam: 'TYT',
    name: 'Coğrafya',
    short: 'Coğ',
    color: C.cografya,
    questionCount: 5,
    section: 'Sosyal Bilimler',
    fields: [],
    topics: TYT_COGRAFYA
  },
  {
    id: 'tyt-felsefe',
    exam: 'TYT',
    name: 'Felsefe',
    short: 'Fels',
    color: C.felsefe,
    questionCount: 5,
    section: 'Sosyal Bilimler',
    fields: [],
    topics: TYT_FELSEFE
  },
  {
    id: 'tyt-din',
    exam: 'TYT',
    name: 'Din Kültürü ve Ahlak Bilgisi',
    short: 'Din',
    color: C.din,
    questionCount: 5,
    section: 'Sosyal Bilimler',
    fields: [],
    topics: TYT_DIN
  },
  {
    id: 'tyt-matematik',
    exam: 'TYT',
    name: 'Temel Matematik',
    short: 'Mat',
    color: C.matematik,
    questionCount: 30,
    section: 'Temel Matematik',
    fields: [],
    topics: TYT_MATEMATIK
  },
  {
    id: 'tyt-geometri',
    exam: 'TYT',
    name: 'Geometri',
    short: 'Geo',
    color: C.geometri,
    questionCount: 10,
    section: 'Temel Matematik',
    fields: [],
    topics: TYT_GEOMETRI
  },
  {
    id: 'tyt-fizik',
    exam: 'TYT',
    name: 'Fizik',
    short: 'Fiz',
    color: C.fizik,
    questionCount: 7,
    section: 'Fen Bilimleri',
    fields: [],
    topics: TYT_FIZIK
  },
  {
    id: 'tyt-kimya',
    exam: 'TYT',
    name: 'Kimya',
    short: 'Kim',
    color: C.kimya,
    questionCount: 7,
    section: 'Fen Bilimleri',
    fields: [],
    topics: TYT_KIMYA
  },
  {
    id: 'tyt-biyoloji',
    exam: 'TYT',
    name: 'Biyoloji',
    short: 'Bio',
    color: C.biyoloji,
    questionCount: 6,
    section: 'Fen Bilimleri',
    fields: [],
    topics: TYT_BIYOLOJI
  },
  // AYT
  {
    id: 'ayt-matematik',
    exam: 'AYT',
    name: 'Matematik',
    short: 'Mat',
    color: C.matematik,
    questionCount: 30,
    section: 'Matematik',
    fields: ['SAY', 'EA'],
    topics: AYT_MATEMATIK
  },
  {
    id: 'ayt-geometri',
    exam: 'AYT',
    name: 'Geometri',
    short: 'Geo',
    color: C.geometri,
    questionCount: 10,
    section: 'Matematik',
    fields: ['SAY', 'EA'],
    topics: AYT_GEOMETRI
  },
  {
    id: 'ayt-fizik',
    exam: 'AYT',
    name: 'Fizik',
    short: 'Fiz',
    color: C.fizik,
    questionCount: 14,
    section: 'Fen Bilimleri',
    fields: ['SAY'],
    topics: AYT_FIZIK
  },
  {
    id: 'ayt-kimya',
    exam: 'AYT',
    name: 'Kimya',
    short: 'Kim',
    color: C.kimya,
    questionCount: 13,
    section: 'Fen Bilimleri',
    fields: ['SAY'],
    topics: AYT_KIMYA
  },
  {
    id: 'ayt-biyoloji',
    exam: 'AYT',
    name: 'Biyoloji',
    short: 'Bio',
    color: C.biyoloji,
    questionCount: 13,
    section: 'Fen Bilimleri',
    fields: ['SAY'],
    topics: AYT_BIYOLOJI
  },
  {
    id: 'ayt-edebiyat',
    exam: 'AYT',
    name: 'Türk Dili ve Edebiyatı',
    short: 'Edb',
    color: C.edebiyat,
    questionCount: 24,
    section: 'Türk Dili ve Edebiyatı-Sosyal Bilimler 1',
    fields: ['EA', 'SOZ'],
    topics: AYT_EDEBIYAT
  },
  {
    id: 'ayt-tarih1',
    exam: 'AYT',
    name: 'Tarih-1',
    short: 'Tar-1',
    color: C.tarih,
    questionCount: 10,
    section: 'Türk Dili ve Edebiyatı-Sosyal Bilimler 1',
    fields: ['EA', 'SOZ'],
    topics: AYT_TARIH1
  },
  {
    id: 'ayt-cografya1',
    exam: 'AYT',
    name: 'Coğrafya-1',
    short: 'Coğ-1',
    color: C.cografya,
    questionCount: 6,
    section: 'Türk Dili ve Edebiyatı-Sosyal Bilimler 1',
    fields: ['EA', 'SOZ'],
    topics: AYT_COGRAFYA1
  },
  {
    id: 'ayt-tarih2',
    exam: 'AYT',
    name: 'Tarih-2',
    short: 'Tar-2',
    color: C.tarih2,
    questionCount: 11,
    section: 'Sosyal Bilimler 2',
    fields: ['SOZ'],
    topics: AYT_TARIH2
  },
  {
    id: 'ayt-cografya2',
    exam: 'AYT',
    name: 'Coğrafya-2',
    short: 'Coğ-2',
    color: C.cografya2,
    questionCount: 11,
    section: 'Sosyal Bilimler 2',
    fields: ['SOZ'],
    topics: AYT_COGRAFYA2
  },
  {
    id: 'ayt-felsefe',
    exam: 'AYT',
    name: 'Felsefe Grubu',
    short: 'Fels',
    color: C.felsefe,
    questionCount: 12,
    section: 'Sosyal Bilimler 2',
    fields: ['SOZ'],
    topics: AYT_FELSEFE
  },
  {
    id: 'ayt-din',
    exam: 'AYT',
    name: 'Din Kültürü ve Ahlak Bilgisi',
    short: 'Din',
    color: C.din,
    questionCount: 6,
    section: 'Sosyal Bilimler 2',
    fields: ['SOZ'],
    topics: AYT_DIN
  }
]

export const SUBJECT_MAP: Record<string, Subject> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s])
)

export const TOPIC_MAP: Record<string, Topic & { subjectId: string }> = Object.fromEntries(
  SUBJECTS.flatMap((s) => s.topics.map((tp) => [tp.id, { ...tp, subjectId: s.id }] as const))
)

export const TOTAL_TOPICS: number = SUBJECTS.reduce((sum, s) => sum + s.topics.length, 0)

/** TYT -> tüm TYT dersleri; AYT -> alana göre süzülmüş (DIL -> boş; ALL/undefined -> tümü). */
export function subjectsFor(exam: ExamType, field?: Field | 'ALL'): Subject[] {
  const ofExam = SUBJECTS.filter((s) => s.exam === exam)
  if (exam === 'TYT') return ofExam
  if (!field || field === 'ALL') return ofExam
  if (field === 'DIL') return []
  return ofExam.filter((s) => s.fields.includes(field))
}

/** Dersleri `section` değerine göre, ilk görülme sırasıyla gruplar. */
export function sectionsFor(
  exam: ExamType,
  field?: Field | 'ALL'
): { name: string; subjects: Subject[]; questionCount: number }[] {
  const result: { name: string; subjects: Subject[]; questionCount: number }[] = []
  for (const s of subjectsFor(exam, field)) {
    let sec = result.find((r) => r.name === s.section)
    if (!sec) {
      sec = { name: s.section, subjects: [], questionCount: 0 }
      result.push(sec)
    }
    sec.subjects.push(s)
    sec.questionCount += s.questionCount
  }
  return result
}
