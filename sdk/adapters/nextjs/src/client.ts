'use client';

/**
 * Client half of `@personaai/nextjs` — the root entry.
 *
 * It is a re-export of `@personaai/react` (`PersonaProvider` and every hook)
 * behind a `'use client'` boundary, so a Next.js app installs one package,
 * imports hooks straight from `@personaai/nextjs`, and can drop
 * `<PersonaProvider>` into a server `layout.tsx` with no wrapper file.
 *
 * Nothing server-side is re-exported here on purpose: your Project credential
 * lives behind `@personaai/nextjs/server` and can never be pulled into a
 * client bundle through this entry.
 */
export * from '@personaai/react';

/**
 * Version of this package. An explicit export shadows the same name coming
 * from the `export *` above, so this reports `@personaai/nextjs`'s version
 * rather than `@personaai/react`'s.
 */
export const VERSION = '0.1.10';
