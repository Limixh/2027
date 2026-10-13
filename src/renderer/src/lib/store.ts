import { create } from 'zustand'
import type {
  AppData,
  Countdown,
  ChatThread,
  ExamResult,
  Goal,
  MistakeNote,
  Settings,
  StudySession,
  TopicProgress
} from '../../../shared/types'
import { todayKey } from './date'
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
  countdowns: []
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
    countdowns: Array.isArray(raw.countdowns) ? raw.countdowns : []
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

  addGoal(g: NewGoal): Goal
  updateGoal(id: string, patch: Partial<Goal>): void
  deleteGoal(id: string): void

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
