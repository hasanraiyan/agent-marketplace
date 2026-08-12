"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

// Custom cardComponent for NextStep (see nextstepjs's documented shadcn/ui
// integration pattern) — replaces the library's default styling with this
// app's own Card/Button so the tour looks native instead of bolted-on.
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
    <Card className="w-80 shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          {step.icon && (
            <span className="text-lg leading-none">{step.icon}</span>
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {step.title}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          onClick={skipTour}
          aria-label="Skip tour"
        >
          <XIcon className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-slate-600 dark:text-slate-400">
        {step.content}
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={prevStep}
            >
              Back
            </Button>
          )}
          <Button type="button" size="sm" onClick={nextStep}>
            {isLastStep ? "Done" : "Next"}
          </Button>
        </div>
      </CardFooter>
      {arrow}
    </Card>
  );
}
