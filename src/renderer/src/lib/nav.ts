import { create } from 'zustand'

export type PageId = 'dashboard' | 'study' | 'exams' | 'topics' | 'analysis' | 'mistakes' | 'ai' | 'settings' | 'focus' | 'room' | 'practice'

interface NavState {
  page: PageId
  /** Sayfaya geçerken iletilen opsiyonel parametre (ör. { new: true } veya { examId }) */
  params: Record<string, string | boolean | undefined>
  go(page: PageId, params?: NavState['params']): void
}

export const useNav = create<NavState>((set) => ({
  page: 'dashboard',
  params: {},
  go: (page, params = {}) => set({ page, params })
}))
