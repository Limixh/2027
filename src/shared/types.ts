// Uygulama genelinde paylaşılan veri modelleri.

export type ExamType = 'TYT' | 'AYT'
export type Field = 'SAY' | 'EA' | 'SOZ' | 'DIL'

/** Bir müfredat dersi (konu takibinde ve deneme girişinde kullanılır). */
export interface Subject {
  /** ör. 'tyt-turkce', 'ayt-fizik' */
  id: string
  exam: ExamType
  name: string
  /** Kısa ad, grafikler için (ör. 'Türkçe', 'Mat', 'Fiz') */
  short: string
  /** Hex renk */
  color: string
  /** Denemede bu derse ait soru sayısı */
  questionCount: number
  /** Deneme girişinde hangi bölüm başlığı altında gösterileceği */
  section: string
  /** AYT dersleri için hangi alanlara dahil olduğu (TYT için boş) */
  fields: Field[]
  topics: Topic[]
}

export interface Topic {
  /** Ders içinde benzersiz, global olarak `${subjectId}:${slug}` */
  id: string
  name: string
  /** Opsiyonel üst grup (ör. 'Problemler', 'Sözcük Türleri') */
  group?: string
}

/** 0 Başlanmadı · 1 Çalışılıyor · 2 Konu bitti · 3 Soru çözüldü · 4 Pekişti/Tekrar edildi */
export type TopicStatus = 0 | 1 | 2 | 3 | 4

export interface TopicProgress {
  status: TopicStatus
  /** 1-5 arası öz güven */
  confidence?: number
  /** Son tekrar tarihi (YYYY-MM-DD) */
  lastReview?: string
  /** Kaç kez tekrar edildi */
  reviews?: number
  note?: string
  updatedAt?: string
}

export interface StudySession {
  id: string
  /** YYYY-MM-DD */
  date: string
  minutes: number
  subjectId?: string
  topicId?: string
  /** Çözülen soru sayısı */
  solved?: number
  correct?: number
  wrong?: number
  kind?: 'konu' | 'soru' | 'tekrar' | 'deneme' | 'diger'
  note?: string
  createdAt: string
}

export interface SubjectScore {
  correct: number
  wrong: number
  blank: number
}

export type MistakeKind = 'bilgi' | 'dikkat' | 'sure' | 'yorum' | 'bos'

export interface ExamMistake {
  id: string
  subjectId: string
  topicId: string
  /** O konudan yanlış/boş soru sayısı */
  count: number
  kind: MistakeKind
  note?: string
}

export interface ExamResult {
  id: string
  type: ExamType
  /** Yayın / deneme adı */
  name: string
  /** YYYY-MM-DD */
  date: string
  durationMin?: number
  /** subjectId -> D/Y/B */
  scores: Record<string, SubjectScore>
  mistakes: ExamMistake[]
  note?: string
  createdAt: string
}

/** Hata defteri — tek tek not alınmış sorular */
export interface MistakeNote {
  id: string
  subjectId: string
  topicId?: string
  source?: string
  /** Sorunun / hatanın açıklaması */
  text: string
  /** Doğru çözüm / çıkarılan ders */
  lesson?: string
  kind: MistakeKind
  resolved: boolean
  date: string
  createdAt: string
}

export interface Goal {
  id: string
  title: string
  /** 'daily-minutes' | 'weekly-minutes' | 'tyt-net' | 'ayt-net' | 'custom' */
  kind: 'tyt-net' | 'ayt-net' | 'custom'
  target: number
  deadline?: string
  done?: boolean
  createdAt: string
}

export interface Settings {
  name: string
  field: Field
  /** Hedef sınav tarihi (YYYY-MM-DD) */
  examDate: string
  dailyGoalMinutes: number
  targetTytNet: number
  targetAytNet: number
  /** Hedef bölüm / üniversite */
  targetProgram: string
  /** Ortaöğretim başarı puanı (diploma notu x 5) */
  obp: number
  theme: 'dark' | 'light' | 'system'
  aiModel: string
  aiEffort: 'low' | 'medium' | 'high'
  pomodoroMinutes: number
  breakMinutes: number
}

export interface AppData {
  version: 1
  settings: Settings
  sessions: StudySession[]
  exams: ExamResult[]
  topicProgress: Record<string, TopicProgress>
  mistakeNotes: MistakeNote[]
  goals: Goal[]
  chats: ChatThread[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  error?: boolean
}

export interface ChatThread {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

/* ---------- IPC (preload köprüsü) ---------- */

export interface AiChatRequest {
  requestId: string
  model: string
  effort: 'low' | 'medium' | 'high'
  /** Sabit sistem istemi (önbelleğe alınır) */
  system: string
  /** Kullanıcının güncel verilerinin özeti (her istekte yenilenir) */
  context?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export type AiStreamEvent =
  | { requestId: string; type: 'text'; text: string }
  | { requestId: string; type: 'done'; stopReason: string | null; model: string }
  | { requestId: string; type: 'error'; message: string }

export interface DesktopApi {
  isDesktop: true
  loadData(): Promise<AppData | null>
  saveData(data: AppData): Promise<void>
  exportData(json: string): Promise<boolean>
  importData(): Promise<string | null>
  getDataPath(): Promise<string>
  ai: {
    hasKey(): Promise<boolean>
    setKey(key: string): Promise<void>
    clearKey(): Promise<void>
    testKey(model: string): Promise<{ ok: boolean; message: string }>
    chat(req: AiChatRequest): Promise<void>
    abort(requestId: string): Promise<void>
    onEvent(cb: (ev: AiStreamEvent) => void): () => void
  }
  openExternal(url: string): Promise<void>
}
