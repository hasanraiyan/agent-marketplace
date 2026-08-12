"use client";

import { NextStepProvider, NextStep } from "nextstepjs";
import { onboardingTours, ONBOARDING_SECTIONS } from "./onboarding-tours";
import { OnboardingCard } from "./onboarding-card";
import { markOnboardingSeen } from "@/lib/api/profile";

// Maps a tour name back to the section key the backend tracks, so
// onComplete/onSkip can mark it seen regardless of which tour fired.
const SECTION_BY_TOUR = Object.fromEntries(
  Object.entries(ONBOARDING_SECTIONS).map(([section, tour]) => [tour, section]),
);

function handleTourEnd(tourName) {
  const section = SECTION_BY_TOUR[tourName];
  if (!section) return;
  // Fire-and-forget — a failed write here just means the tour may show
  // again next visit, not worth blocking or surfacing an error for.
  markOnboardingSeen(section).catch(() => {});
}

export function OnboardingProvider({ children }) {
  return (
    <NextStepProvider>
      <NextStep
        steps={onboardingTours}
        cardComponent={OnboardingCard}
        onComplete={handleTourEnd}
        onSkip={(_step, tourName) => handleTourEnd(tourName)}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
