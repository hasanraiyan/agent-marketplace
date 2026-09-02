/**
 * `app/layout.tsx` — `PersonaProvider` ships behind a `'use client'`
 * boundary, so it drops straight into a server layout with no wrapper file.
 *
 * `baseUrl` points at the catch-all route mounted in
 * `app/api/persona/[...persona]/route.ts`.
 */
import { PersonaProvider } from '@personaai/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PersonaProvider baseUrl="/api/persona">{children}</PersonaProvider>
      </body>
    </html>
  );
}
