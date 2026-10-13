import type { DesktopApi } from '../shared/types'

declare global {
  interface Window {
    /** Electron dışında (tarayıcı modu) tanımsızdır. */
    api?: DesktopApi
    electronTheme?: { changed(dark: boolean): void }
  }
}

export {}
