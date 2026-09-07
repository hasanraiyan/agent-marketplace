"use client";

import { useUser } from "@clerk/nextjs";

// Ported from frontend/src/hooks/use-profile.js — normalizes Clerk's user
// object into the shape the dashboard actually needs.
export function useProfile() {
  const { user, isLoaded } = useUser();

  return {
    user: user
      ? {
          id: user.id,
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          username: user.username || user.firstName || "User",
          avatarUrl: user.imageUrl,
        }
      : null,
    isLoaded,
  };
}
