import { create } from 'zustand'
import type {
  AppData,
  Countdown,
  Skill,
  SkillEvidence,
  PracticeSet,
  DailyPlan,
  PlanTask,
  TaskResult,
  TopicStatus,
  ChatThread,
  ExamResult,
  Goal,
  MistakeNote,
  Settings,
  StudySession,
  TopicProgress
} from '../../../shared/types'
import { addDays, todayKey } from './date'
import { uid } from './id'

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  field: 'SAY',
  // YKS 2027 tarihi ÖSYM tarafından henüz kesinleşmediyse tahmini tarih (Haziran'ın 3. hafta sonu)
  examDate: '2027-06-19',
  dailyGoalMinutes: 360,
  targetTytNet: 90,
  targetAytNet: 60,
  targetProgram: '',
  obp: 400,
  theme: 'dark',
  aiProvider: 'cli',
  aiModel: 'claude-opus-5-5',
  aiEffort: 'medium',
  pomodoroMinutes: 50,
  breakMinutes: 10
}

export const emptyData = (): AppData => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  sessions: [],
  exams: [],
  topicProgress: {},
  mistakeNotes: [],
  goals: [],
  chats: [],
  countdowns: [],
  plans: {},
  practiceSets: [],
  skills: []
})

/** Eski/eksik veriyi güncel şemaya tamamla */
export function normalize(raw: Partial<AppData> | null | undefined): AppData {
  const base = emptyData()
  if (!raw || typeof raw !== 'object') return base
  return {
    version: 1,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    exams: Array.isArray(raw.exams) ? raw.exams.map((e) => ({ ...e, mistakes: e.mistakes ?? [] })) : [],
    topicProgress: raw.topicProgress && typeof raw.topicProgress === 'object' ? raw.topicProgress : {},
    mistakeNotes: Array.isArray(raw.mistakeNotes) ? raw.mistakeNotes : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    chats: Array.isArray(raw.chats) ? raw.chats : [],
    countdowns: Array.isArray(raw.countdowns) ? raw.countdowns : [],
    plans: raw.plans && typeof raw.plans === 'object' ? raw.plans : {},
    practiceSets: Array.isArray(raw.practiceSets) ? raw.practiceSets : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    brainMeta: raw.brainMeta && typeof raw.brainMeta === 'object' ? raw.brainMeta : undefined
  }
}

const LS_KEY = 'yks2027-data'

async function loadPersisted(): Promise<AppData> {
  if (window.api) return normalize(await window.api.loadData())
  try {
    const raw = localStorage.getItem(LS_KEY)
    return normalize(raw ? JSON.parse(raw) : null)
  } catch {
    return emptyData()
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(data: AppData): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (window.api) void window.api.saveData(data)
    else {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(data))
      } catch {
        /* depolama dolu/kapalı */
      }
    }
  }, 300)
}

type NewSession = Omit<StudySession, 'id' | 'createdAt'>
type NewExam = Omit<ExamResult, 'id' | 'createdAt'>
type NewMistake = Omit<MistakeNote, 'id' | 'createdAt'>
type NewGoal = Omit<Goal, 'id' | 'createdAt'>

interface Store {
  ready: boolean
  data: AppData
  init(): Promise<void>
  replaceAll(data: AppData): void
  resetAll(): void

  updateSettings(patch: Partial<Settings>): void

  addSession(s: NewSession): StudySession
  updateSession(id: string, patch: Partial<StudySession>): void
  deleteSession(id: string): void

  addExam(e: NewExam): ExamResult
  updateExam(id: string, patch: Partial<ExamResult>): void
  deleteExam(id: string): void

  setTopicProgress(topicId: string, patch: Partial<TopicProgress>): void
  /** Konuyu "tekrar edildi" olarak işaretler (sayaç + tarih) */
  markReviewed(topicId: string): void

  addMistakeNote(m: NewMistake): MistakeNote
  updateMistakeNote(id: string, patch: Partial<MistakeNote>): void
  deleteMistakeNote(id: string): void
  addNoteComment(noteId: string, text: string): void
  deleteNoteComment(noteId: string, commentId: string): void

  addGoal(g: NewGoal): Goal
  updateGoal(id: string, patch: Partial<Goal>): void
  deleteGoal(id: string): void

  /** Günün planını yazar. mode 'append' mevcut görevlerin sonuna ekler */
  setPlan(date: string, tasks: Omit<PlanTask, 'id' | 'done'>[], opts?: { summary?: string; mode?: 'replace' | 'append' }): void
  addPlanTask(date: string, task: Omit<PlanTask, 'id' | 'done'>): void
  updatePlanTask(date: string, id: string, patch: Partial<PlanTask>): void
  deletePlanTask(date: string, id: string): void
  movePlanTask(date: string, id: string, dir: -1 | 1): void
  /** Görevi bitirir: çalışma kaydı oluşturur ve konu ilerlemesini günceller */
  completePlanTask(date: string, id: string, result: TaskResult): void
  /** Bitirmeyi geri alır (oluşan çalışma kaydı silinir) */
  reopenPlanTask(date: string, id: string): void

  /** Pratik seti ekler; süre > 0 ise çalışma kaydı da oluşturur */
  addPracticeSet(p: Omit<PracticeSet, 'id' | 'createdAt' | 'sessionId'>): PracticeSet
  updatePracticeSet(id: string, patch: Partial<PracticeSet>): void
  deletePracticeSet(id: string): void
  /** Hata defterindeki soruyu tekrar çözme sonucu (aralıklı tekrar) */
  /** help: çözüme bakarak çözdü (çözüldü sayılmaz, 2 gün sonra tekrar) */
  recordRetry(noteId: string, solved: boolean, help?: boolean): void

  /**
   * AI analizinden gelen becerileri hafızaya işler: mevcut beceriyle (id veya ad) eşleşirse ona kanıt ekler,
   * yoksa yeni beceri açar; notu becerilere bağlar. Farklı konulardaki sorular böylece aynı beceride buluşur.
   */
  applySkillAnalysis(noteId: string, items: { id?: string; name: string; role?: string; detail?: string; description?: string; area?: string }[]): string[]
  setBrainMeta(patch: NonNullable<AppData['brainMeta']>): void
  updateSkill(id: string, patch: Partial<Skill>): void
  deleteSkill(id: string): void
  /** source becerisini target'a katar (kanıtlar, konular ve bağlı notlar taşınır) */
  mergeSkills(targetId: string, sourceId: string): void
  addSkillEvidence(skillId: string, ev: Omit<SkillEvidence, 'id'>): void

  addCountdown(c: Omit<Countdown, 'id'>): void
  deleteCountdown(id: string): void

  upsertChat(thread: ChatThread): void
  deleteChat(id: string): void
}

const now = (): string => new Date().toISOString()

export const useStore = create<Store>((set, get) => {
  const mutate = (fn: (d: AppData) => AppData): void => {
    const next = fn(get().data)
    set({ data: next })
    persist(next)
  }

  return {
    ready: false,
    data: emptyData(),

    async init() {
      const data = await loadPersisted()
      set({ data, ready: true })
    },
    replaceAll(data) {
      const next = normalize(data)
      set({ data: next })
      persist(next)
    },
    resetAll() {
      const next = { ...emptyData(), settings: get().data.settings }
      set({ data: next })
      persist(next)
    },

    updateSettings(patch) {
      mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
    },

    addSession(s) {
      const session: StudySession = { ...s, id: uid(), createdAt: now() }
      mutate((d) => ({ ...d, sessions: [...d.sessions, session] }))
      return session
    },
    updateSession(id, patch) {
      mutate((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
    },
    deleteSession(id) {
      mutate((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }))
    },

    addExam(e) {
      const exam: ExamResult = { ...e, id: uid(), createdAt: now() }
      mutate((d) => ({ ...d, exams: [...d.exams, exam] }))
      return exam
    },
    updateExam(id, patch) {
      mutate((d) => ({ ...d, exams: d.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
    },
    deleteExam(id) {
      mutate((d) => ({ ...d, exams: d.exams.filter((e) => e.id !== id) }))
    },

    setTopicProgress(topicId, patch) {
      mutate((d) => {
        const prev = d.topicProgress[topicId] ?? { status: 0 }
        const next: TopicProgress = { ...prev, ...patch, updatedAt: now() }
        // Konu bitti olarak işaretlendiğinde aralıklı tekrar sayacı başlasın
        if (next.status >= 2 && !next.lastReview) next.lastReview = todayKey()
        return { ...d, topicProgress: { ...d.topicProgress, [topicId]: next } }
      })
    },
    markReviewed(topicId) {
      mutate((d) => {
        const prev = d.topicProgress[topicId] ?? { status: 0 }
        return {
          ...d,
          topicProgress: {
            ...d.topicProgress,
            [topicId]: {
              ...prev,
              status: prev.status < 2 ? 2 : prev.status,
              reviews: (prev.reviews ?? 0) + 1,
              lastReview: todayKey(),
              updatedAt: now()
            }
          }
        }
      })
    },

    addMistakeNote(m) {
      const note: MistakeNote = { ...m, id: uid(), createdAt: now() }
      mutate((d) => ({ ...d, mistakeNotes: [note, ...d.mistakeNotes] }))
      return note
    },
    updateMistakeNote(id, patch) {
      mutate((d) => ({
        ...d,
        mistakeNotes: d.mistakeNotes.map((m) => (m.id === id ? { ...m, ...patch } : m))
      }))
    },
    addNoteComment(noteId, text) {
      const t = text.trim()
      if (!t) return
      mutate((d) => ({
        ...d,
        mistakeNotes: d.mistakeNotes.map((m) =>
          m.id === noteId ? { ...m, comments: [...(m.comments ?? []), { id: uid(), date: todayKey(), text: t }] } : m
        )
      }))
    },
    deleteNoteComment(noteId, commentId) {
      mutate((d) => ({
        ...d,
        mistakeNotes: d.mistakeNotes.map((m) => (m.id === noteId ? { ...m, comments: (m.comments ?? []).filter((c) => c.id !== commentId) } : m))
      }))
    },
    deleteMistakeNote(id) {
      mutate((d) => ({ ...d, mistakeNotes: d.mistakeNotes.filter((m) => m.id !== id) }))
    },

    addGoal(g) {
      const goal: Goal = { ...g, id: uid(), createdAt: now() }
      mutate((d) => ({ ...d, goals: [...d.goals, goal] }))
      return goal
    },
    updateGoal(id, patch) {
      mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
    },
    deleteGoal(id) {
      mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }))
    },

    setPlan(date, tasks, opts = {}) {
      mutate((d) => {
        const prev = d.plans[date]
        const fresh = tasks.map((t) => ({ ...t, id: uid(), done: false }) as PlanTask)
        const plan: DailyPlan = {
          date,
          tasks: opts.mode === 'append' && prev ? [...prev.tasks, ...fresh] : fresh,
          summary: opts.summary ?? prev?.summary,
          createdAt: prev?.createdAt ?? now(),
          updatedAt: now()
        }
        return { ...d, plans: { ...d.plans, [date]: plan } }
      })
    },
    addPlanTask(date, task) {
      get().setPlan(date, [task], { mode: 'append' })
    },
    updatePlanTask(date, id, patch) {
      mutate((d) => {
        const plan = d.plans[date]
        if (!plan) return d
        return {
          ...d,
          plans: { ...d.plans, [date]: { ...plan, tasks: plan.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)), updatedAt: now() } }
        }
      })
    },
    deletePlanTask(date, id) {
      mutate((d) => {
        const plan = d.plans[date]
        if (!plan) return d
        return { ...d, plans: { ...d.plans, [date]: { ...plan, tasks: plan.tasks.filter((t) => t.id !== id), updatedAt: now() } } }
      })
    },
    movePlanTask(date, id, dir) {
      mutate((d) => {
        const plan = d.plans[date]
        if (!plan) return d
        const i = plan.tasks.findIndex((t) => t.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= plan.tasks.length) return d
        const tasks = plan.tasks.slice()
        ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
        return { ...d, plans: { ...d.plans, [date]: { ...plan, tasks, updatedAt: now() } } }
      })
    },
    completePlanTask(date, id, result) {
      const task = get().data.plans[date]?.tasks.find((t) => t.id === id)
      if (!task || task.done) return
      let sessionId: string | undefined
      if (result.minutes > 0 || result.solved) {
        sessionId = get().addSession({
          date: todayKey() < date ? todayKey() : date,
          minutes: Math.max(0, Math.round(result.minutes)),
          subjectId: task.subjectId,
          topicId: task.topicId,
          solved: result.solved || undefined,
          correct: result.correct || undefined,
          wrong: result.wrong || undefined,
          kind: task.kind,
          note: [task.title, task.scope, result.note].filter(Boolean).join(' · ')
        }).id
      }
      // Konu ilerlemesini görev türüne göre otomatik güncelle
      if (task.topicId) {
        const cur = get().data.topicProgress[task.topicId]?.status ?? 0
        if (task.kind === 'tekrar') get().markReviewed(task.topicId)
        else {
          const target: TopicStatus =
            task.kind === 'konu' ? (task.completesTopic === false ? 1 : 2) : task.kind === 'soru' ? (task.completesTopic ? 3 : 1) : 1
          if (target > cur) get().setTopicProgress(task.topicId, { status: target })
        }
      }
      get().updatePlanTask(date, id, { done: true, doneAt: now(), sessionId })
    },
    reopenPlanTask(date, id) {
      const task = get().data.plans[date]?.tasks.find((t) => t.id === id)
      if (!task) return
      if (task.sessionId) get().deleteSession(task.sessionId)
      get().updatePlanTask(date, id, { done: false, doneAt: undefined, sessionId: undefined })
    },

    addPracticeSet(p) {
      let sessionId: string | undefined
      if (p.seconds > 0) {
        sessionId = get().addSession({
          date: p.date,
          minutes: Math.max(1, Math.round(p.seconds / 60)),
          subjectId: p.subjectId,
          topicId: p.topicId,
          solved: p.count,
          correct: p.correct,
          wrong: p.wrong,
          kind: 'soru',
          note: p.source ? `Pratik: ${p.source}` : 'Soru pratiği'
        }).id
      }
      const set: PracticeSet = { ...p, id: uid(), sessionId, createdAt: now() }
      mutate((d) => ({ ...d, practiceSets: [...d.practiceSets, set] }))
      return set
    },
    updatePracticeSet(id, patch) {
      mutate((d) => ({ ...d, practiceSets: d.practiceSets.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      const set = get().data.practiceSets.find((x) => x.id === id)
      if (set?.sessionId)
        get().updateSession(set.sessionId, {
          date: set.date,
          minutes: Math.max(1, Math.round(set.seconds / 60)),
          subjectId: set.subjectId,
          topicId: set.topicId,
          solved: set.count,
          correct: set.correct,
          wrong: set.wrong
        })
    },
    deletePracticeSet(id) {
      const set = get().data.practiceSets.find((x) => x.id === id)
      if (set?.sessionId) get().deleteSession(set.sessionId)
      mutate((d) => ({ ...d, practiceSets: d.practiceSets.filter((x) => x.id !== id) }))
    },
    recordRetry(noteId, solvedArg, help) {
      const note = get().data.mistakeNotes.find((m) => m.id === noteId)
      if (!note) return
      const solved = solvedArg && !help
      const retries = [...(note.retries ?? []), { date: todayKey(), solved, ...(help ? { help: true } : {}) }]
      // Üst üste doğru çözüm sayısına göre aralık: 1 → 3 → 7 → 14 gün; 3 doğrudan sonra öğrenildi
      let streak = 0
      for (let i = retries.length - 1; i >= 0 && retries[i].solved; i--) streak++
      const intervals = [1, 3, 7, 14]
      const learned = streak >= 3
      const next = learned ? undefined : addDays(todayKey(), solved ? intervals[Math.min(streak, 3)] : help ? 2 : 1)
      get().updateMistakeNote(noteId, { retries, nextReview: next, resolved: learned || note.resolved, inbox: false })
      // Hafıza: bağlı becerilere tekrar sonucunu kanıt olarak işle
      for (const sid of note.skillIds ?? []) {
        get().addSkillEvidence(sid, {
          date: todayKey(),
          kind: solved ? 'basari' : help ? 'zayif' : 'eksik',
          detail: solved ? 'Tekrar çözümünde doğru yaptı' : help ? 'Tekrar çözümünde çözüme baktı' : 'Tekrar çözümünde yine yapamadı',
          noteId,
          topicId: note.topicId,
          source: 'tekrar'
        })
      }
    },

    applySkillAnalysis(noteId, items) {
      const note = get().data.mistakeNotes.find((m) => m.id === noteId)
      if (!note || !items.length) return []
      const fold = (s: string): string =>
        s
          .toLocaleLowerCase('tr')
          .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
      const ids: string[] = []
      mutate((d) => {
        const skills = d.skills.slice()
        for (const it of items) {
          const name = it.name?.trim()
          if (!name) continue
          let idx = it.id ? skills.findIndex((s) => s.id === it.id) : -1
          if (idx < 0) idx = skills.findIndex((s) => fold(s.name) === fold(name))
          // Öğrenci yalnızca çözemediği soruları ekler; çözüme bakılan soruda hiçbir beceri "başarı" sayılmaz
          const helped = note.usedSolution || note.kind === 'cozum'
          let kind: SkillEvidence['kind'] = it.role === 'basari' || it.role === 'kullandi' ? 'basari' : it.role === 'zayif' ? 'zayif' : 'eksik'
          if (kind === 'basari' && helped) kind = 'zayif'
          // Aynı not için aynı beceriye ikinci kez kanıt yazma (yeniden analizde)
          const ev: SkillEvidence = { id: uid(), date: note.date, kind, detail: it.detail, noteId, topicId: note.topicId, source: 'ai' }
          if (idx < 0) {
            skills.push({
              id: uid(),
              name,
              description: it.description,
              area: it.area?.trim() || undefined,
              topicIds: note.topicId ? [note.topicId] : [],
              evidence: [ev],
              createdAt: now(),
              updatedAt: now()
            })
            idx = skills.length - 1
          } else {
            const s = skills[idx]
            skills[idx] = {
              ...s,
              description: s.description || it.description,
              area: s.area || it.area?.trim() || undefined,
              topicIds: note.topicId && !s.topicIds.includes(note.topicId) ? [...s.topicIds, note.topicId] : s.topicIds,
              evidence: [...s.evidence.filter((e) => !(e.noteId === noteId && e.source === 'ai')), ev],
              updatedAt: now()
            }
          }
          if (!ids.includes(skills[idx].id)) ids.push(skills[idx].id)
        }
        return {
          ...d,
          skills,
          mistakeNotes: d.mistakeNotes.map((m) => (m.id === noteId ? { ...m, skillIds: ids } : m))
        }
      })
      return ids
    },
    setBrainMeta(patch) {
      mutate((d) => ({ ...d, brainMeta: { ...(d.brainMeta ?? {}), ...patch } }))
    },
    updateSkill(id, patch) {
      mutate((d) => ({ ...d, skills: d.skills.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: now() } : s)) }))
    },
    deleteSkill(id) {
      mutate((d) => ({
        ...d,
        skills: d.skills.filter((s) => s.id !== id),
        mistakeNotes: d.mistakeNotes.map((m) => (m.skillIds?.includes(id) ? { ...m, skillIds: m.skillIds.filter((x) => x !== id) } : m))
      }))
    },
    mergeSkills(targetId, sourceId) {
      if (targetId === sourceId) return
      mutate((d) => {
        const t = d.skills.find((s) => s.id === targetId)
        const src = d.skills.find((s) => s.id === sourceId)
        if (!t || !src) return d
        const merged: Skill = {
          ...t,
          topicIds: [...new Set([...t.topicIds, ...src.topicIds])],
          // Aynı sorudan gelen AI kanıtı iki kez sayılmasın
          evidence: [...t.evidence, ...src.evidence.filter((e) => !(e.source === 'ai' && e.noteId && t.evidence.some((x) => x.source === 'ai' && x.noteId === e.noteId)))].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
          note: [t.note, src.note].filter(Boolean).join('\n\n') || undefined,
          description: t.description || src.description,
          area: t.area || src.area,
          updatedAt: now()
        }
        return {
          ...d,
          skills: d.skills.filter((s) => s.id !== sourceId).map((s) => (s.id === targetId ? merged : s)),
          mistakeNotes: d.mistakeNotes.map((m) =>
            m.skillIds?.includes(sourceId) ? { ...m, skillIds: [...new Set(m.skillIds.map((x) => (x === sourceId ? targetId : x)))] } : m
          )
        }
      })
    },
    addSkillEvidence(skillId, ev) {
      mutate((d) => ({
        ...d,
        skills: d.skills.map((s) =>
          s.id === skillId
            ? {
                ...s,
                evidence: [...s.evidence, { ...ev, id: uid() }],
                topicIds: ev.topicId && !s.topicIds.includes(ev.topicId) ? [...s.topicIds, ev.topicId] : s.topicIds,
                updatedAt: now()
              }
            : s
        )
      }))
    },

    addCountdown(c) {
      mutate((d) => ({ ...d, countdowns: [...d.countdowns, { ...c, id: uid() }] }))
    },
    deleteCountdown(id) {
      mutate((d) => ({ ...d, countdowns: d.countdowns.filter((c) => c.id !== id) }))
    },

    upsertChat(thread) {
      mutate((d) => {
        const exists = d.chats.some((c) => c.id === thread.id)
        return {
          ...d,
          chats: exists ? d.chats.map((c) => (c.id === thread.id ? thread : c)) : [thread, ...d.chats]
        }
      })
    },
    deleteChat(id) {
      mutate((d) => ({ ...d, chats: d.chats.filter((c) => c.id !== id) }))
    }
  }
})

/** Kısa yol: sadece veri seçicisi */
export const useData = <T,>(sel: (d: AppData) => T): T => useStore((s) => sel(s.data))
