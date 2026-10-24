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

/** 'cozum' = soruyu çözüme bakarak yaptım */
export type MistakeKind = 'bilgi' | 'dikkat' | 'sure' | 'yorum' | 'bos' | 'cozum'

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
  /** Sorunun fotoğraf(lar)ı */
  questionImages?: ChatAttachment[]
  /** Öğrencinin silinmemiş, işlemli çözüm denemesi */
  attemptImages?: ChatAttachment[]
  /** AI'nin analizi (Markdown): nerede neden takıldın, doğru çözüm */
  aiAnalysis?: string
  aiAnalyzedAt?: string
  /** AI'nin ürettiği benzer soru setleri (Markdown; cevaplar '---CEVAPLAR---' satırından sonra) */
  similar?: { id: string; markdown: string; createdAt: string }[]
  /** Tekrar çözme geçmişi (help: çözüme bakarak çözdü) */
  retries?: { date: string; solved: boolean; help?: boolean }[]
  /** Bir sonraki tekrar tarihi (YYYY-MM-DD); yoksa tekrar planlanmamış */
  nextReview?: string
  /** Telefondan yüklendiyse true (henüz incelenmedi) */
  inbox?: boolean
  /** Doğru cevap (ör. 'C' ya da sayısal cevap) */
  correctAnswer?: string
  /** Öğrencinin işaretlediği cevap */
  myAnswer?: string
  /** Soruyu çözüme bakarak yaptı */
  usedSolution?: boolean
  /** Öğrencinin tarihli yorumları: "x'i yapmıştım ama şurada takıldım" */
  comments?: { id: string; date: string; text: string }[]
}

/** Soru pratiği seti: ör. 20 paragraf 28 dk, 17D 2Y 1B */
export interface PracticeSet {
  id: string
  /** YYYY-MM-DD */
  date: string
  subjectId: string
  topicId?: string
  /** Toplam soru */
  count: number
  /** Toplam süre (saniye) */
  seconds: number
  correct: number
  wrong: number
  blank: number
  /** Çözüme bakarak yapılan soru sayısı (doğru sayılmaz) */
  helped?: number
  /** Canlı modda ölçülen soru başına süreler (saniye) */
  perQuestion?: number[]
  /** Canlı modda soru başına sonuç */
  perResult?: ('D' | 'Y' | 'B' | 'C')[]
  source?: string
  note?: string
  /** Otomatik oluşturulan çalışma kaydı */
  sessionId?: string
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
  /** 'cli' = Claude aboneliği (Claude Code CLI), 'api' = Claude API anahtarı, 'codex' = ChatGPT aboneliği (Codex CLI) */
  aiProvider: 'cli' | 'api' | 'codex'
  /** Codex için model (boşsa ChatGPT hesabının varsayılanı) */
  codexModel?: string
  aiModel: string
  aiEffort: 'low' | 'medium' | 'high'
  pomodoroMinutes: number
  breakMinutes: number
}

export interface Countdown {
  id: string
  title: string
  /** 'YYYY-MM-DDTHH:mm' yerel saat */
  at: string
  color?: string
}

export type PlanTaskKind = 'konu' | 'soru' | 'tekrar' | 'deneme' | 'diger'

/** Günlük plandaki tek görev (AI veya kullanıcı tarafından oluşturulur) */
export interface PlanTask {
  id: string
  /** ör. 'Türev: tanım ve kurallar' */
  title: string
  subjectId?: string
  topicId?: string
  kind: PlanTaskKind
  /** Konunun hangi kısmı (ör. 'ilk 3 alt başlık'); boşsa konunun tamamı */
  scope?: string
  /** Bitince konu tamamen bitmiş sayılsın mı (konu/soru görevleri) */
  completesTopic?: boolean
  targetMinutes?: number
  targetQuestions?: number
  /** Önerilen başlangıç saati 'HH:mm' */
  time?: string
  note?: string
  done: boolean
  doneAt?: string
  /** Bitirilince oluşturulan çalışma kaydı */
  sessionId?: string
  source: 'ai' | 'manual'
}

export interface DailyPlan {
  /** YYYY-MM-DD */
  date: string
  tasks: PlanTask[]
  /** AI'nin planla ilgili kısa notu */
  summary?: string
  createdAt: string
  updatedAt: string
}

export interface TaskResult {
  minutes: number
  solved?: number
  correct?: number
  wrong?: number
  note?: string
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
  countdowns: Countdown[]
  /** tarih -> günlük plan */
  plans: Record<string, DailyPlan>
  practiceSets: PracticeSet[]
}

/** Sohbete eklenen dosya (userData/attachments altında saklanır) */
export interface ChatAttachment {
  name: string
  /** userData'ya göre göreli yol, ör. 'attachments/ab12-sonuc.png' */
  rel: string
  mime: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  error?: boolean
  attachments?: ChatAttachment[]
  /** Mesajdaki AI eylemleri uygulandı mı / reddedildi mi */
  actionsState?: 'applied' | 'rejected'
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
  messages: { role: 'user' | 'assistant'; content: string; attachments?: ChatAttachment[] }[]
}

export interface CliChatRequest {
  requestId: string
  model: string
  /** Talimatlar + veriler + sohbet geçmişi + yeni soru (stdin ile gönderilir) */
  prompt: string
  /** Bu istekte okunacak ekler */
  attachments?: ChatAttachment[]
}

export interface CliStatus {
  installed: boolean
  version?: string
  /** Hesapla giriş yapılmış mı (bilinmiyorsa undefined) */
  loggedIn?: boolean
}

export type AiStreamEvent =
  | { requestId: string; type: 'text'; text: string }
  /** fullText: modelin tam cevabı (varsa akışla biriken metin yerine bu kullanılır) */
  | { requestId: string; type: 'done'; stopReason: string | null; model: string; fullText?: string }
  | { requestId: string; type: 'error'; message: string }

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'uptodate' | 'downloading' | 'ready' | 'needs-reinstall' | 'error'
  /** Çalışan sürüm */
  current: string
  /** Sunucudaki en yeni sürüm */
  latest?: string
  notes?: string
  error?: string
}

/** Telefondan gelen soru yüklemesi */
export interface PhoneUpload {
  subjectId: string
  correctAnswer?: string
  myAnswer?: string
  usedSolution?: boolean
  topicId?: string
  note: string
  source?: string
  questionImages: ChatAttachment[]
  attemptImages: ChatAttachment[]
}

export interface PhoneServerInfo {
  running: boolean
  urls: string[]
  received: number
}

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
    cliStatus(): Promise<CliStatus>
    cliChat(req: CliChatRequest): Promise<void>
    cliAbort(requestId: string): Promise<void>
    codexStatus(): Promise<CliStatus>
    codexChat(req: CliChatRequest): Promise<void>
    codexAbort(requestId: string): Promise<void>
    codexModels(): Promise<{ slug: string; name: string }[]>
    codexLogin(): Promise<{ ok: boolean; message: string }>
    saveAttachment(name: string, base64: string): Promise<ChatAttachment>
    onEvent(cb: (ev: AiStreamEvent) => void): () => void
  }
  openExternal(url: string): Promise<void>
  phone: {
    start(catalogJson: string): Promise<PhoneServerInfo>
    stop(): Promise<PhoneServerInfo>
    info(): Promise<PhoneServerInfo>
    onUpload(cb: (u: PhoneUpload) => void): () => void
  }
  update: {
    status(): Promise<UpdateStatus>
    check(): Promise<UpdateStatus>
    install(): Promise<void>
    onEvent(cb: (s: UpdateStatus) => void): () => void
  }
}
