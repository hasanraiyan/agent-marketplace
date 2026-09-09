import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || "https://platform.persona.hasanraiyan.me";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/forgot-password(.*)",
  "/dashboard/agents/(.*)", // Allow public viewing of agents with dashboard layout
  "/developer/invitations/(.*)", // Post-accept landing page (Clerk redirect target)
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/developer" || pathname === "/developer/") {
    return NextResponse.redirect(new URL(`/projects${search}`, PLATFORM_URL));
  }
  if (pathname.startsWith("/developer/projects")) {
    const subpath = pathname.replace(/^\/developer\/projects/, "/projects");
    return NextResponse.redirect(new URL(`${subpath}${search}`, PLATFORM_URL));
  }
  if (pathname.startsWith("/developer/")) {
    const subpath = pathname.replace(/^\/developer/, "");
    return NextResponse.redirect(new URL(`${subpath}${search}`, PLATFORM_URL));
  }
  if (pathname === "/projects" || pathname === "/projects/") {
    return NextResponse.redirect(new URL(`/projects${search}`, PLATFORM_URL));
  }
  if (pathname.startsWith("/projects/")) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, PLATFORM_URL));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
