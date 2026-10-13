import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ConfirmHost, ToastHost } from './components/ui'
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

const PAGES = {
  dashboard: Dashboard,
  study: Study,
  exams: Exams,
  topics: Topics,
  analysis: Analysis,
  mistakes: Mistakes,
  ai: AiCoach,
  settings: SettingsPage
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
  useTheme()

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  const Page = PAGES[page]
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto">
        {/* Pencere sürükleme alanı (başlık çubuğu gizli) */}
        <div className="drag sticky top-0 z-30 h-10 w-full bg-bg/80 backdrop-blur" />
        <div key={page} className="mx-auto max-w-[1400px] animate-fade-in px-8 pb-10">
          <Page />
        </div>
      </main>
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}
