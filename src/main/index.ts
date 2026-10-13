import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import * as ai from './ai'
import * as cli from './claudeCli'
import * as codex from './codexCli'
import { saveAttachment } from './attachments'
import * as updater from './updater'
import type { AiChatRequest, AppData, CliChatRequest } from '../shared/types'

const dataDir = (): string => app.getPath('userData')
const dataFile = (): string => join(dataDir(), 'yks-data.json')

function loadData(): AppData | null {
  const file = dataFile()
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as AppData
  } catch {
    // Bozuk dosyayı yedekleyip boş başla
    copyFileSync(file, `${file}.corrupt-${Date.now()}`)
    return null
  }
}

let lastBackupDay = ''
function saveData(data: AppData): void {
  mkdirSync(dataDir(), { recursive: true })
  const file = dataFile()
  // Günlük otomatik yedek
  const today = new Date().toISOString().slice(0, 10)
  if (existsSync(file) && lastBackupDay !== today) {
    const backupDir = join(dataDir(), 'backups')
    mkdirSync(backupDir, { recursive: true })
    copyFileSync(file, join(backupDir, `yks-data-${today}.json`))
    lastBackupDay = today
  }
  // Atomik yazma
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data))
  renameSync(tmp, file)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0c12' : '#f6f7fb',
    title: 'YKS 2027 Takip',
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.png') }),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#c9cbd6' : '#3b3f52',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.once('did-finish-load', () => {
    // Arayüz yüklendi: bu sürüm sağlıklı, ardından arka planda güncelleme ara
    updater.markHealthy()
    if (app.isPackaged) setTimeout(() => void updater.check(win.webContents), 4000)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  ipcMain.on('theme:changed', (_e, dark: boolean) => {
    if (win.isDestroyed()) return
    try {
      win.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#c9cbd6' : '#3b3f52', height: 40 })
      win.setBackgroundColor(dark ? '#0b0c12' : '#f6f7fb')
    } catch {
      /* macOS/Linux'ta overlay olmayabilir */
    }
  })
}

function registerIpc(): void {
  ipcMain.handle('data:load', () => loadData())
  ipcMain.handle('data:save', (_e, data: AppData) => saveData(data))
  ipcMain.handle('data:path', () => dataFile())
  ipcMain.handle('data:export', async (_e, json: string) => {
    const date = new Date().toISOString().slice(0, 10)
    const res = await dialog.showSaveDialog({
      title: 'Verileri dışa aktar',
      defaultPath: `yks-yedek-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return false
    writeFileSync(res.filePath, json)
    return true
  })
  ipcMain.handle('data:import', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Yedekten içe aktar',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    return readFileSync(res.filePaths[0], 'utf8')
  })
  ipcMain.handle('shell:open', (_e, url: string) => {
    if (url.startsWith('https://')) return shell.openExternal(url)
    return undefined
  })

  ipcMain.handle('ai:hasKey', () => ai.hasKey())
  ipcMain.handle('ai:setKey', (_e, key: string) => ai.setKey(key))
  ipcMain.handle('ai:clearKey', () => ai.clearKey())
  ipcMain.handle('ai:test', (_e, model: string) => ai.testKey(model))
  ipcMain.handle('ai:chat', (e, req: AiChatRequest) => {
    // Akış olaylarla gönderilir; burada beklemeden dön.
    void ai.chat(e.sender, req)
  })
  ipcMain.handle('ai:abort', (_e, id: string) => ai.abort(id))
  ipcMain.handle('update:status', () => updater.getStatus())
  ipcMain.handle('update:check', (e) => updater.check(e.sender))
  ipcMain.handle('update:install', () => updater.install())
  ipcMain.handle('codex:status', () => codex.status())
  ipcMain.handle('codex:chat', (e, req: CliChatRequest) => codex.chat(e.sender, req))
  ipcMain.handle('codex:abort', (_e, id: string) => codex.abort(id))
  ipcMain.handle('codex:models', () => codex.models())
  ipcMain.handle('codex:login', () => codex.login())
  ipcMain.handle('ai:saveAttachment', (_e, name: string, b64: string) => saveAttachment(name, b64))
  ipcMain.handle('cli:status', () => cli.status())
  ipcMain.handle('cli:chat', (e, req: CliChatRequest) => cli.chat(e.sender, req))
  ipcMain.handle('cli:abort', (_e, id: string) => cli.abort(id))
}

// Tarih seçiciler ve sayı biçimleri Türkçe olsun
app.commandLine.appendSwitch('lang', 'tr')

app.whenReady().then(() => {
  app.setAppUserModelId('com.yks2027.takip')
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
