"use client";

import * as React from "react";
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireTitle,
  QuestionnaireChoices,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireInput,
  QuestionnaireActions,
  QuestionnaireProgress,
  QuestionnairePrevious,
  QuestionnaireSkip,
  QuestionnaireNext,
  QuestionnaireSubmit,
} from "@/components/ui/questionnaire";
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { ChatInterruptData } from "./types";

/**
 * HITL approval + multi-step clarification — built on the Questionnaire
 * primitive, which already is a multi-step Q&A wizard (progress, keyboard
 * 1-9 shortcuts via shortcuts="numbers", previous/skip/next/submit nav).
 * NotebookChat.js hand-rolled all of this (step state, keyboard handler,
 * custom-text fallback); here it's what the primitive is built for.
 */
function InterruptPanel({
  interrupt,
  onSubmitClarification,
  onDecideHitl,
}: {
  interrupt: ChatInterruptData;
  onSubmitClarification?: (answers: Record<string, string>) => void;
  onDecideHitl?: (actionId: string, decision: "approve" | "reject") => void;
}) {
  if (interrupt.kind === "hitl") {
    return (
      <div className="flex flex-col gap-2 rounded-none border border-border bg-card p-3">
        {interrupt.actionRequests.map((action) => (
          <Item key={action.id} variant="muted">
            <ItemContent>
              <ItemTitle>{action.label}</ItemTitle>
              {action.description && (
                <ItemDescription>{action.description}</ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDecideHitl?.(action.id, "reject")}
              >
                <XIcon /> Reject
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onDecideHitl?.(action.id, "approve")}
              >
                <CheckIcon /> Approve
              </Button>
            </ItemActions>
          </Item>
        ))}
      </div>
    );
  }

  const { questions } = interrupt;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const answers: Record<string, string> = {};
    questions.forEach((q, idx) => {
      const name = q.id ?? `q-${idx}`;
      const value = data.get(name);
      if (typeof value === "string" && value.trim()) answers[name] = value.trim();
    });
    onSubmitClarification?.(answers);
  };

  return (
    <div className="rounded-none border border-border bg-card p-3">
      <Questionnaire
        items={questions.map((q, idx) => ({
          name: q.id ?? `q-${idx}`,
          choices: q.options?.map((o) => ({ value: o.value })),
          required: q.required !== false,
        }))}
        shortcuts="numbers"
        onSubmit={handleSubmit}
      >
        {questions.map((q, idx) => {
          const name = q.id ?? `q-${idx}`;
          return (
            <QuestionnaireItem key={name} name={name} required={q.required !== false}>
              <QuestionnaireTitle>{q.question}</QuestionnaireTitle>
              {q.options?.length ? (
                <QuestionnaireChoices>
                  {q.options.map((opt) => (
                    <QuestionnaireChoice key={opt.value} value={opt.value}>
                      {opt.label}
                      {opt.description && (
                        <QuestionnaireChoiceDescription>
                          {opt.description}
                        </QuestionnaireChoiceDescription>
                      )}
                    </QuestionnaireChoice>
                  ))}
                  {q.allowCustom && (
                    <QuestionnaireInput placeholder="Something else…" />
                  )}
                </QuestionnaireChoices>
              ) : (
                <QuestionnaireInput placeholder="Type your answer…" />
              )}
            </QuestionnaireItem>
          );
        })}
        <QuestionnaireActions>
          <QuestionnaireProgress />
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit />
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}

export { InterruptPanel };
