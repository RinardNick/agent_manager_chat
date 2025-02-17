/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: react(),
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/**/*.test.{ts,tsx}'],
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './app'),
      },
      {
        find: '@rinardnick/ts-mcp-client',
        replacement: path.resolve(
          __dirname,
          './app/lib/__mocks__/@rinardnick/ts-mcp-client.ts'
        ),
      },
    ],
  },
});
