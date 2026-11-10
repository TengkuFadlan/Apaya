const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
  } catch {
    return {}
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f7f8fa',
    title: 'Apaya — Asisten Harian',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.handle('settings:has-key', () => {
  const value = readSettings().apiKey
  if (!value || !safeStorage.isEncryptionAvailable()) return false
  try {
    safeStorage.decryptString(Buffer.from(value, 'base64'))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('settings:set-key', (_event, key) => {
  const settings = readSettings()
  if (key) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Penyimpanan terenkripsi tidak tersedia di perangkat ini.')
    }
    settings.apiKey = safeStorage.encryptString(key).toString('base64')
  } else {
    delete settings.apiKey
  }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(settings), { mode: 0o600 })
  return true
})

ipcMain.handle('ai:chat', async (_event, { baseUrl, model, provider, messages }) => {
  const settings = readSettings()
  if (!settings.apiKey || !safeStorage.isEncryptionAvailable()) {
    throw new Error('Tambahkan API key di Pengaturan terlebih dahulu.')
  }
  const apiKey = safeStorage.decryptString(Buffer.from(settings.apiKey, 'base64'))
  let endpoint
  try {
    endpoint = new URL(baseUrl)
  } catch {
    throw new Error('URL API tidak valid.')
  }
  const isLocalEndpoint = ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname)
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && isLocalEndpoint)) {
    throw new Error('URL API harus menggunakan HTTPS. HTTP hanya diizinkan untuk endpoint lokal.')
  }
  const isAnthropic = provider === 'anthropic'
  const url = `${endpoint.href.replace(/\/$/, '')}${isAnthropic ? '/messages' : '/chat/completions'}`
  const headers = { 'Content-Type': 'application/json' }
  if (isAnthropic) {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers.Authorization = `Bearer ${apiKey}`
  }
  const systemMessage = messages.find((message) => message.role === 'system')
  const conversation = messages.filter((message) => message.role !== 'system')
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(isAnthropic
      ? { model, max_tokens: 1200, system: systemMessage?.content || '', messages: conversation, temperature: 0.7 }
      : { model, messages, temperature: 0.7 }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error?.message || `Permintaan API gagal (${response.status}).`)
  const answer = isAnthropic
    ? data.content?.filter((item) => item.type === 'text').map((item) => item.text).join('\n')
    : data.choices?.[0]?.message?.content
  if (!answer) throw new Error('Respons AI kosong atau format API tidak dikenali.')
  return answer
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
