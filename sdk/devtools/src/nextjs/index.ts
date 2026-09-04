'use client';

/**
 * Next.js entry — thin re-export of the React panel with a 'use client'
 * boundary, so a Next.js app can `import { PersonaDevtools } from '@personaai/devtools/nextjs'`
 * directly in a server `layout.tsx` without a wrapper file.
 */
export { PersonaDevtools } from '../react/DevtoolsPanel.js';
export type { PersonaDevtoolsProps } from '../react/DevtoolsPanel.js';
export { useDevtoolsSnapshot } from '../react/hooks.js';
export type { UseDevtoolsOptions } from '../react/hooks.js';
