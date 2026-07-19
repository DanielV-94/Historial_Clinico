import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@historial/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@historial/validators': path.resolve(__dirname, '../../packages/validators/src'),
      '@historial/constants': path.resolve(__dirname, '../../packages/constants/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
