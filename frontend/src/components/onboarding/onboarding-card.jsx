"use client";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom cardComponent for NextStep (see nextstepjs's documented shadcn/ui
// integration pattern). Built from the app's actual card idiom — the
// compact, dense-info style used by StudioHomePage's StatTile/ResourceCard
// — rather than shadcn's full-padding Card primitives, since a tour
// tooltip is closer in spirit to those than to a page-level form card.
export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="w-80 rounded-2xl border border-slate-150/70 bg-white shadow-lg dark:border-slate-850/60 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="flex items-center gap-2.5">
          {step.icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-900">
              {step.icon}
            </span>
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {step.title}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          onClick={skipTour}
          aria-label="Skip tour"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      <div className="px-4 pb-4 text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
        {step.content}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100/80 px-4 py-3 dark:border-slate-850/60">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === currentStep
                  ? "bg-[#1E60FF]"
                  : "bg-slate-200 dark:bg-slate-800",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-3 text-xs font-bold"
              onClick={prevStep}
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-full bg-[#1E60FF] px-3 text-xs font-bold text-white hover:bg-[#154ed0]"
            onClick={nextStep}
          >
            {isLastStep ? "Done" : "Next"}
          </Button>
        </div>
      </div>
      {arrow}
    </div>
  );
}
