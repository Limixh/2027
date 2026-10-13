import { contextBridge, ipcRenderer } from 'electron'
import type { AiChatRequest, CliChatRequest, AiStreamEvent, AppData, DesktopApi, UpdateStatus } from '../shared/types'

const api: DesktopApi = {
  isDesktop: true,
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data: AppData) => ipcRenderer.invoke('data:save', data),
  exportData: (json: string) => ipcRenderer.invoke('data:export', json),
  importData: () => ipcRenderer.invoke('data:import'),
  getDataPath: () => ipcRenderer.invoke('data:path'),
  ai: {
    hasKey: () => ipcRenderer.invoke('ai:hasKey'),
    setKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
    clearKey: () => ipcRenderer.invoke('ai:clearKey'),
    testKey: (model: string) => ipcRenderer.invoke('ai:test', model),
    chat: (req: AiChatRequest) => ipcRenderer.invoke('ai:chat', req),
    abort: (id: string) => ipcRenderer.invoke('ai:abort', id),
    cliStatus: () => ipcRenderer.invoke('cli:status'),
    cliChat: (req: CliChatRequest) => ipcRenderer.invoke('cli:chat', req),
    cliAbort: (id: string) => ipcRenderer.invoke('cli:abort', id),
    onEvent: (cb: (ev: AiStreamEvent) => void) => {
      const listener = (_e: unknown, ev: AiStreamEvent): void => cb(ev)
      ipcRenderer.on('ai:event', listener)
      return () => ipcRenderer.removeListener('ai:event', listener)
    }
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onEvent: (cb: (s: UpdateStatus) => void) => {
      const listener = (_e: unknown, s: UpdateStatus): void => cb(s)
      ipcRenderer.on('update:event', listener)
      return () => ipcRenderer.removeListener('update:event', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electronTheme', {
  changed: (dark: boolean) => ipcRenderer.send('theme:changed', dark)
})
