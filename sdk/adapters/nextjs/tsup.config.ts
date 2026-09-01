import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // `dist` is wiped by the build script instead of `clean: true`, which would
  // let the second config in this array delete the first one's output.
  clean: false,
  target: 'es2022',
  external: ['react', 'react-dom', 'next'],
} as const;

export default defineConfig([
  {
    ...shared,
    entry: ['src/server.ts'],
    // 'neutral' — the server entry is Web-standard only (Request/Response/
    // ReadableStream), so it runs unchanged on the Edge runtime.
    platform: 'neutral',
  },
  {
    ...shared,
    entry: ['src/client.ts'],
    platform: 'browser',
    // The `'use client'` directive at the top of src/client.ts is preserved
    // into the bundle by esbuild — that boundary is what makes
    // `<PersonaProvider>` usable straight from a server `layout.tsx`.
    // `test/build.test.ts` guards it.
  },
]);
