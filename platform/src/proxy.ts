import { clerkMiddleware } from "@clerk/nextjs/server";

// Public paths: the marketing page, Clerk's auth pages and SSO callback,
// share links (/r), docs/concepts content, and static metadata files.
// Everything else is the signed-in Studio (/projects/**), which is protected
// at the resource level in src/app/projects/layout.tsx.
const PUBLIC_PATHS = new Set([
  "/",
  "/search-index.json",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
]);
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/sso-callback", "/r", "/docs", "/concepts"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublicPath(request.nextUrl.pathname)) return;

  // Optimistic redirect only — it improves the signed-out experience by
  // answering before the page renders. The authoritative check lives in the
  // protected layout.
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
