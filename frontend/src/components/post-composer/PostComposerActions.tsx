"use client";

import type { ComposerStep } from "@/types/postComposer";
import { useLocale } from "@/state/Locale";
import { Button, Group } from "@mantine/core";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import classes from "./PostComposerActions.module.css";

type PostComposerActionsProps = {
  step: ComposerStep;
  submitLabel: string;
  canGoNext: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

export function PostComposerActions({
  step,
  submitLabel,
  canGoNext,
  canSubmit,
  submitting,
  onBack,
  onNext,
  onSubmit,
}: PostComposerActionsProps) {
  const { localeData: locale } = useLocale();
  const isCheckStep = step === "check";

  return (
    <Group
      justify="space-between"
      className={classes.dock}
    >
      <Button
        type="button"
        variant="light"
        color="blue"
        leftSection={<ArrowLeft size={16} />}
        onClick={onBack}
        className={classes.backButton}
      >
        {locale.PostComposer_ActionBack}
      </Button>
      {isCheckStep ? (
        <Button
          type="button"
          leftSection={<Send size={16} />}
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          className={classes.primaryButton}
        >
          {submitLabel}
        </Button>
      ) : (
        <Button
          type="button"
          rightSection={<ArrowRight size={16} />}
          onClick={onNext}
          disabled={!canGoNext}
          className={classes.primaryButton}
        >
          {locale.PostComposer_ActionNext}
        </Button>
      )}
    </Group>
  );
}
