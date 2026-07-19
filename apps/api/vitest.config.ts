import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'test/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@historial/constants': path.resolve(__dirname, '../../packages/constants/src/index.ts'),
      '@historial/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@historial/validators': path.resolve(__dirname, '../../packages/validators/src/index.ts'),
    },
  },
});
