"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { getProfile } from "@/lib/api/profile";
import { ONBOARDING_SECTIONS } from "@/components/onboarding/onboarding-tours";

const REPLAY_KEY = "onboarding:replay";

// Requests a tour replay from anywhere in the app (e.g. a "Replay tour"
// button in Settings). The target section's landing page isn't necessarily
// mounted yet — useOnboardingSection picks this flag up on its own mount
// rather than relying on startNextStep being called before the page (and
// its selector-anchored elements) actually exist.
export function requestOnboardingReplay(section) {
  sessionStorage.setItem(REPLAY_KEY, section);
}

// Fires a section's guided tour the first time that section is visited.
// Persisted server-side (User.onboardingSeen) via GET /profile, so it
// doesn't repeat across devices/sessions once completed or skipped.
export function useOnboardingSection(section) {
  const { startNextStep } = useNextStep();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (sessionStorage.getItem(REPLAY_KEY) === section) {
      sessionStorage.removeItem(REPLAY_KEY);
      startNextStep(ONBOARDING_SECTIONS[section]);
      return;
    }

    let cancelled = false;
    getProfile()
      .then((res) => {
        if (cancelled) return;
        const seen = res.data?.data?.onboardingSeen || [];
        if (!seen.includes(section)) {
          startNextStep(ONBOARDING_SECTIONS[section]);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // Runs once per mount for a given section — startNextStep is stable
    // from the NextStep context, section is a static prop by call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
}
