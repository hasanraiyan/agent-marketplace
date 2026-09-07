"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenFetcher } from "@/lib/api/core";

export function AxiosTokenProvider() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenFetcher(getToken);
  }, [getToken]);

  return null;
}
