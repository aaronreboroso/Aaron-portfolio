import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '**/.git/**',
        '**/.data/**',
        '**/server/**',
        '**/*.sqlite*',
        '**/vault.key',
      ],
    },
  },
  build: { chunkSizeWarningLimit: 850 },
});
