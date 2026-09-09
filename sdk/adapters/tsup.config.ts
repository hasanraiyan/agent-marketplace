import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'express/index': 'src/express/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'nextjs/server': 'src/nextjs/server.ts',
    'nextjs/client': 'src/nextjs/client.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  external: ['express', 'next', 'react', '@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs'],
});
