import { useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { UpdateBanner } from './components/UpdateBanner'
import { ConfirmHost, toast, ToastHost } from './components/ui'
import { addDays, todayKey } from './lib/date'
import { useNav } from './lib/nav'
import { useStore } from './lib/store'
import Dashboard from './pages/Dashboard'
import Study from './pages/Study'
import Exams from './pages/Exams'
import Topics from './pages/Topics'
import Analysis from './pages/Analysis'
import Mistakes from './pages/Mistakes'
import AiCoach from './pages/AiCoach'
import SettingsPage from './pages/Settings'
import Focus from './pages/Focus'
import Room from './pages/Room'
import Practice from './pages/Practice'
import Brain from './pages/Brain'

const PAGES = {
  dashboard: Dashboard,
  study: Study,
  exams: Exams,
  topics: Topics,
  analysis: Analysis,
  mistakes: Mistakes,
  ai: AiCoach,
  settings: SettingsPage,
  focus: Focus,
  room: Room,
  practice: Practice,
  brain: Brain
}

function useTheme(): void {
  const theme = useStore((s) => s.data.settings.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      window.electronTheme?.changed(dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  const page = useNav((s) => s.page)
  const mainRef = useRef<HTMLElement>(null)
  useTheme()

  // Sayfa değişince en üste kaydır
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [page])

  useEffect(() => {
    void init()
  }, [init])

  // Telefondan gelen soru fotoğraflarını Hata Defteri'ne ekle (uygulama açıkken her sayfada)
  useEffect(() => {
    if (!window.api) return
    return window.api.phone.onUpload((u) => {
      const st = useStore.getState()
      st.addMistakeNote({
        subjectId: u.subjectId,
        topicId: u.topicId,
        text: u.note,
        kind: u.usedSolution ? 'cozum' : u.myAnswer === 'Boş' ? 'bos' : 'bilgi',
        resolved: false,
        date: todayKey(),
        source: u.source,
        correctAnswer: u.correctAnswer,
        myAnswer: u.myAnswer,
        usedSolution: u.usedSolution,
        usedHint: u.usedHint,
        hintSeen: u.hintSeen,
        questionImages: u.questionImages,
        attemptImages: u.attemptImages.length ? u.attemptImages : undefined,
        inbox: true,
        nextReview: addDays(todayKey(), 1)
      })
      toast('📱 Telefondan yeni soru geldi — Hata Defteri', 'info')
    })
  }, [])

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  const Page = PAGES[page]
  // Sayaç sayfası tüm pencereyi kaplar (kenar çubuğu yok)
  if (page === 'focus' || page === 'room') {
    return (
      <div className="h-full overflow-hidden">
        <Page />
        <ConfirmHost />
        <ToastHost />
      </div>
    )
  }
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main ref={mainRef} className="relative flex-1 overflow-y-auto">
        {/* Pencere sürükleme alanı (başlık çubuğu gizli) */}
        <div className="drag sticky top-0 z-30 h-10 w-full bg-bg/80 backdrop-blur" />
        <div key={page} className="mx-auto max-w-[1400px] animate-fade-in px-8 pb-10">
          <Page />
        </div>
      </main>
      <UpdateBanner />
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}
