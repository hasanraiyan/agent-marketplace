import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'express/test/**/*.test.ts',
      'express/examples/**/*.test.ts',
      'nextjs/test/**/*.test.ts',
      'nestjs/test/**/*.spec.ts',
      'nestjs/test/**/*.test.ts',
      'test/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/compat/**'],
  },
});
