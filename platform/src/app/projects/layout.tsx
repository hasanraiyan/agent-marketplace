import { auth } from "@clerk/nextjs/server";

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative gate for every /projects route. proxy.ts only performs an
  // optimistic redirect for signed-out users.
  await auth.protect();

  return children;
}
