import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { core: 'src/core/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    platform: 'neutral',
  },
  {
    entry: { react: 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'es2022',
    platform: 'neutral',
    external: ['react', 'react-dom'],
  },
  {
    entry: { nextjs: 'src/nextjs/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'es2022',
    platform: 'neutral',
    external: ['react', 'react-dom', 'next'],
  },
]);
