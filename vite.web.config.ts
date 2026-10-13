// Tarayıcıda (Electron olmadan) arayüzü geliştirmek/test etmek için.
// Veriler localStorage'a yazılır, AI özelliği devre dışı kalır.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react()],
  server: { port: 5173 }
})
