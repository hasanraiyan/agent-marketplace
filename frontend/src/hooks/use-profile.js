"use client";

import { useUser } from "@clerk/nextjs";

export function useProfile() {
  const { user, isLoaded } = useUser();

  return {
    user: user ? {
      id: user.id,
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      username: user.username || user.firstName || "User",
      avatarUrl: user.imageUrl,
    } : null,
    isLoaded
  };
}
