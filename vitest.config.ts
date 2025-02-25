/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()] as any,
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/**/*.test.{ts,tsx}'],
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    alias: [
      {
        find: '@rinardnick/client_mcp',
        replacement: path.resolve(
          __dirname,
          './app/lib/__mocks__/@rinardnick/client_mcp.ts'
        ),
      },
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
      '@/app': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
