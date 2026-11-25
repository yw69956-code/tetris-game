import { defineConfig } from 'vite'

// GitHub Pages serves the site at /tetris-game/. Relative URLs keep `npm run dev` at the site root.
const base = process.env.GITHUB_PAGES === 'true' ? '/tetris-game/' : './'

export default defineConfig({
  base,
  server: {
    host: '0.0.0.0',
    port: 43173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43173,
    strictPort: true,
  },
})
