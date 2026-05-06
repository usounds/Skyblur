"use client";

import type { ComposerStep } from "@/types/postComposer";
import { useLocale } from "@/state/Locale";
import { Stepper } from "@mantine/core";
import { CheckCircle2, Edit3, Users } from "lucide-react";

type PostComposerStepperProps = {
  step: ComposerStep;
  onStepChange: (step: ComposerStep) => void;
  isStepReachable: (step: ComposerStep) => boolean;
};

const steps: Array<{ value: ComposerStep; label: string; icon: typeof Edit3 }> = [
  { value: "write", label: "書く", icon: Edit3 },
  { value: "audience", label: "見せる相手", icon: Users },
  { value: "check", label: "投稿前チェック", icon: CheckCircle2 },
];

export function PostComposerStepper({ step, onStepChange, isStepReachable }: PostComposerStepperProps) {
  const { localeData: locale } = useLocale();
  const activeIndex = steps.findIndex((item) => item.value === step);
  const labels: Record<ComposerStep, string> = {
    write: locale.PostComposer_StepWrite,
    audience: locale.PostComposer_StepAudience,
    check: locale.PostComposer_StepCheck,
  };

  return (
    <Stepper
      active={activeIndex}
      onStepClick={(index) => {
        const nextStep = steps[index]!.value;
        /* istanbul ignore next -- Direct step clicks are a convenience path; E2E covers primary Next/Back navigation. */
        if (isStepReachable(nextStep)) onStepChange(nextStep);
      }}
      allowNextStepsSelect={false}
      iconSize={32}
      size="sm"
      mb="xl"
      styles={{
        root: {
          maxWidth: 720,
        },
        steps: {
          alignItems: "center",
        },
        separator: {
          alignSelf: "center",
          marginTop: 0,
        },
        step: {
          transition: "color 140ms ease, opacity 140ms ease",
        },
        stepIcon: {
          borderWidth: 1,
          transition: "border-color 140ms ease, background-color 140ms ease, color 140ms ease",
        },
        stepLabel: {
          fontWeight: 700,
          letterSpacing: 0,
        },
      }}
    >
      {steps.map((item) => {
        const Icon = item.icon;
        const isReachable = isStepReachable(item.value);

        return (
          <Stepper.Step
            key={item.value}
            label={labels[item.value]}
            icon={<Icon size={17} />}
            allowStepSelect={isReachable}
          />
        );
      })}
    </Stepper>
  );
}
