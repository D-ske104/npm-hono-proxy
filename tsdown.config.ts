import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/audit.ts'],
  platform: 'node',
  outDir: 'dist',
  format: 'esm',
})
