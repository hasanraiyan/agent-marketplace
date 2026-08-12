"use client";

import { useEffect, useState } from "react";

function frontendApiOrigin() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const encoded = pk.replace(/^pk_(test|live)_/, "");
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return host ? `https://${host}` : null;
  } catch {
    return null;
  }
}

function parseConfig(data) {
  const userSettings = data?.user_settings || {};
  const social = userSettings.social || {};
  const attributes = userSettings.attributes || {};
  return {
    socialProviders: Object.entries(social)
      .filter(([, config]) => config?.enabled)
      .map(([strategy, config]) => ({
        strategy,
        name: config.name || strategy,
        logoUrl: config.logo_url,
      })),
    attributes,
  };
}

const EMPTY_CONFIG = { socialProviders: [], attributes: {} };

/**
 * Reads which sign-up/sign-in fields and OAuth providers are actually
 * enabled on the Clerk instance behind the currently loaded publishable
 * key, from the same public, unauthenticated environment endpoint Clerk's
 * own components use. Test and live Clerk instances are configured
 * independently in the dashboard and can differ (e.g. Google enabled on
 * one, a required field toggled on another) — the custom auth forms read
 * this instead of hardcoding what exists, so a dashboard change doesn't
 * require a code change.
 *
 * Returns { loading: true } until the first fetch resolves, then
 * { loading: false, socialProviders, attributes } — attributes keeps
 * Clerk's own snake_case field names (email_address, username, password,
 * first_name, last_name, phone_number), each an { enabled, required }
 * pair straight from the API response.
 */
export function useClerkAuthConfig() {
  const origin = frontendApiOrigin();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    fetch(`${origin}/v1/environment`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConfig(parseConfig(data));
      })
      .catch(() => {
        if (!cancelled) setConfig(EMPTY_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  if (!config) return { loading: true, ...EMPTY_CONFIG };
  return { loading: false, ...config };
}
