import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything in Studio requires a signed-in session except the public
// landing page (so the product can be seen before signing up), the auth
// pages themselves, and Clerk's SSO redirect target — same split
// frontend/ uses, plus the "/" marketing page.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
