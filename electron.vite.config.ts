import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const define = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
  main: {
    // Ana süreç kendi kendine yetsin: güncelleme paketleri userData'dan yüklendiğinde
    // node_modules'a erişemez, bu yüzden Anthropic SDK pakete gömülür.
    plugins: [externalizeDepsPlugin({ exclude: ['@anthropic-ai/sdk'] })],
    define,
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          bootstrap: resolve('src/main/bootstrap.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    define,
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
