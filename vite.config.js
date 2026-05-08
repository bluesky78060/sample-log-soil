import { defineConfig } from 'vite'
import { resolve, join } from 'path'
import { existsSync, readdirSync, mkdirSync, statSync, copyFileSync } from 'fs'

function copyDirRecursive(src, dest) {
  if (!existsSync(src)) return
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const s = join(src, entry)
    const d = join(dest, entry)
    if (statSync(s).isDirectory()) {
      copyDirRecursive(s, d)
    } else {
      copyFileSync(s, d)
    }
  }
}

function copyManualAssets() {
  return {
    name: 'copy-manual-assets',
    closeBundle() {
      const root = resolve(__dirname)
      copyDirRecursive(join(root, 'src/manual/images'), join(root, 'docs/manual/images'))
      copyDirRecursive(join(root, 'src/manual/screenshots'), join(root, 'docs/manual/screenshots'))
    }
  }
}

export default defineConfig({
  root: 'src',
  base: './',
  server: {
    port: 3000,
    open: true
  },
  plugins: [copyManualAssets()],
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        soil: resolve(__dirname, 'src/soil/index.html'),
        settings: resolve(__dirname, 'src/settings/index.html'),
        labelPrint: resolve(__dirname, 'src/label-print/index.html'),
        manual: resolve(__dirname, 'src/manual/index.html'),
        firebaseSetup: resolve(__dirname, 'src/manual/firebase-setup.html'),
        heuktoram: resolve(__dirname, 'src/heuktoram/index.html'),
        release: resolve(__dirname, 'src/release/index.html')
      }
    }
  }
})
