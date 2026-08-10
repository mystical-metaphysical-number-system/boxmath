import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site (not a <user>.github.io repo) at
  // /<repo-name>/, so asset URLs need that prefix in production. Only set
  // it for the CI build (see .github/workflows/deploy-pages.yml) — local
  // dev stays at plain "/" so `npm run dev:studio` and GETTING_STARTED.md
  // aren't affected.
  base: process.env.GITHUB_PAGES ? '/boxmath/' : '/',
})
