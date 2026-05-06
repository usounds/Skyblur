"use client";

import { isListVisibility } from "@/logic/listVisibility";
import { buildPostComposerSavePlan } from "@/logic/postComposer/save";
import { transformPostText, validatePostText, type BracketValidationError } from "@/logic/postComposer/text";
import { getPasswordWhitespaceError } from "./AudienceStep";
import type {
  ComposerFixTarget,
  ComposerStep,
  PostComposerInitialData,
  PostComposerState,
  SavePlan,
  SaveResult,
} from "@/types/postComposer";
import { VISIBILITY_PASSWORD } from "@/types/types";
import { useLocale } from "@/state/Locale";
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PostComposerActions } from "./PostComposerActions";
import { PostComposerStepper } from "./PostComposerStepper";

type BuildSavePlanResult =
  | { ok: true; plan: SavePlan }
  | { ok: false; message: string; fixTarget?: ComposerFixTarget };

type PostComposerRenderArgs = {
  state: PostComposerState;
  setState: (patch: Partial<PostComposerState>) => void;
  goToStep: (step: ComposerStep) => void;
  stepError?: ComposerFixTarget;
  stepErrorMessage?: string;
};

type PostComposerScreenProps = {
  initialData?: PostComposerInitialData;
  onBack?: () => void;
  onStateChange?: (state: PostComposerState) => void;
  requiresRelogin?: boolean;
  buildSavePlan?: (state: PostComposerState) => BuildSavePlanResult;
  onSubmit?: (state: PostComposerState, plan: SavePlan) => Promise<SaveResult>;
  renderStep: (args: PostComposerRenderArgs) => ReactNode;
};

const stepOrder: ComposerStep[] = ["write", "audience", "check"];

function getBracketValidationMessageKey(error: BracketValidationError | undefined) {
  if (error === "full-width-bracket") return "CreatePost_BracketFromFullToHalf";
  if (error === "duplicate-or-unclosed-bracket") return "CreatePost_ErrorDuplicateBranket";
  if (error === "unbalanced-bracket") return "CreatePost_BracketsUnbalanced";
  if (error === "bracket-in-simple-mode") return "CreatePost_NotBracketInSimpleMode";
  return undefined;
}

export function createInitialComposerState(initialData?: PostComposerInitialData, omitChar = "○"): PostComposerState {
  const text = initialData?.text ?? "";
  const simpleMode = initialData?.simpleMode ?? false;
  const limitConsecutive = initialData?.limitConsecutive ?? false;
  const transformed = transformPostText({
    text,
    simpleMode,
    limitConsecutive,
    omitChar,
  });

  return {
    mode: initialData?.mode ?? "create",
    step: "write",
    text,
    textForRecord: transformed.recordText,
    textForBluesky: transformed.blurredText,
    blurredText: transformed.blurredText,
    additional: initialData?.additional ?? "",
    simpleMode,
    limitConsecutive,
    visibility: initialData?.visibility ?? "public",
    password: initialData?.password ?? "",
    listUri: initialData?.listUri,
    replyPost: initialData?.replyPost,
    threadGate: initialData?.threadGate ?? [],
    postGate: initialData?.postGate ?? { allowQuote: true },
    dirty: false,
    submitting: false,
  };
}

export function getStepError(state: PostComposerState, step: ComposerStep): ComposerFixTarget | undefined {
  if (step === "write" && !state.text.trim()) {
    return { step: "write", field: "text", messageKey: "PostComposer_ErrorTextRequired" };
  }
  if (step === "write") {
    const messageKey = getBracketValidationMessageKey(validatePostText(state.text, state.simpleMode));
    if (messageKey) {
      return { step: "write", field: "text", messageKey };
    }
  }

  if (step === "audience") {
    if (state.visibility === VISIBILITY_PASSWORD && !state.password.trim()) {
      return { step: "audience", field: "password", messageKey: "PostComposer_ErrorPasswordRequired" };
    }
    if (state.visibility === VISIBILITY_PASSWORD && getPasswordWhitespaceError(state.password)) {
      return { step: "audience", field: "password", messageKey: "CreatePost_PasswordErrorSpace" };
    }
    if (isListVisibility(state.visibility) && !state.listUri) {
      return { step: "audience", field: "listUri", messageKey: "PostComposer_ErrorListRequired" };
    }
  }

  return undefined;
}

export function PostComposerScreen({
  initialData,
  onBack,
  onStateChange,
  requiresRelogin = false,
  buildSavePlan,
  onSubmit,
  renderStep,
}: PostComposerScreenProps) {
  const { localeData: locale } = useLocale();
  const [state, setRawState] = useState(() => createInitialComposerState(initialData, locale.CreatePost_OmmitChar));
  const [submitError, setSubmitError] = useState("");
  const [attemptedStep, setAttemptedStep] = useState<ComposerStep | null>(null);
  const [confirmBackOpened, setConfirmBackOpened] = useState(false);
  const hasMountedRef = useRef(false);

  const setState = useCallback((patch: Partial<PostComposerState>) => {
    setRawState((current) => {
      return {
        ...current,
        ...patch,
        dirty: patch.dirty ?? true,
      };
    });
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (!state.dirty) return;
    onStateChange?.(state);
  }, [onStateChange, state]);

  const goToStep = useCallback((step: ComposerStep) => {
    setRawState((current) => ({ ...current, step }));
    setAttemptedStep(null);
  }, []);

  const savePlanResult = useMemo(() => {
    const result = buildSavePlan ? buildSavePlan(state) : buildPostComposerSavePlan(state, initialData);
    if ("ok" in result) return result;
    if ("error" in result) {
      return {
        ok: false as const,
        message: locale.PostComposer_ErrorUnsupportedStorageChange,
        fixTarget: { step: "audience", field: "visibility", messageKey: result.error } satisfies ComposerFixTarget,
      };
    }
    return { ok: true as const, plan: result };
  }, [buildSavePlan, initialData, state]);
  const planStepError = savePlanResult && !savePlanResult.ok ? savePlanResult.fixTarget : undefined;
  const getBlockingStepError = useCallback((step: ComposerStep) => {
    const stepError = getStepError(state, step);
    if (stepError) return stepError;
    if (planStepError?.step === step) return planStepError;
    return undefined;
  }, [planStepError, state]);
  const currentStepIndex = stepOrder.indexOf(state.step);
  const currentStepError = getBlockingStepError(state.step);

  const firstBlockingStep = useMemo(() => {
    return stepOrder.find((step) => getBlockingStepError(step));
  }, [getBlockingStepError]);

  const isStepReachable = useCallback((targetStep: ComposerStep) => {
    const targetIndex = stepOrder.indexOf(targetStep);
    if (targetIndex <= currentStepIndex) return true;
    const blockingIndex = firstBlockingStep ? stepOrder.indexOf(firstBlockingStep) : -1;
    return blockingIndex === -1 || targetIndex <= blockingIndex;
  }, [currentStepIndex, firstBlockingStep]);

  const requestStepChange = useCallback((targetStep: ComposerStep) => {
    if (!isStepReachable(targetStep)) {
      setAttemptedStep(state.step);
      return;
    }
    goToStep(targetStep);
  }, [goToStep, isStepReachable, state.step]);

  useEffect(() => {
    if (!state.dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.dirty]);

  const handleBack = () => {
    if (state.step !== "write") {
      const previousStep = stepOrder[Math.max(0, currentStepIndex - 1)];
      goToStep(previousStep);
      return;
    }
    if (state.mode === "edit" && state.dirty) {
      setConfirmBackOpened(true);
      return;
    }
    onBack?.();
  };

  const handleNext = () => {
    if (currentStepError) {
      setAttemptedStep(state.step);
      return;
    }
    const nextStep = stepOrder[Math.min(stepOrder.length - 1, currentStepIndex + 1)];
    goToStep(nextStep);
  };

  const handleSubmit = async () => {
    if (!onSubmit || !savePlanResult?.ok) return;

    setRawState((current) => ({ ...current, submitting: true }));
    setSubmitError("");

    try {
      const result = await onSubmit(state, savePlanResult.plan);
      if (result.status === "success") {
        if (result.warning) {
          notifications.show({
            id: `post-composer-${result.warning.reason}`,
            color: "yellow",
            message: locale[result.warning.messageKey as keyof typeof locale] || locale.PostComposer_ErrorSaveFailed,
          });
        }
        setRawState((current) => ({ ...current, dirty: false, submitting: false }));
      } else {
        const message = result.messageKey ? locale[result.messageKey as keyof typeof locale] : locale.PostComposer_ErrorSaveFailed;
        setSubmitError(message);
        setRawState((current) => ({ ...current, submitting: false }));
      }
    } catch {
      setSubmitError(locale.PostComposer_ErrorSaveFailed);
      setRawState((current) => ({ ...current, submitting: false }));
    }
  };

  const activeStepError = currentStepError && attemptedStep === state.step ? currentStepError : undefined;
  const activeStepErrorMessage = activeStepError?.messageKey ? locale[activeStepError.messageKey as keyof typeof locale] : undefined;
  const planErrorVisible = savePlanResult && !savePlanResult.ok && planStepError?.step === state.step;
  const canGoNext = !currentStepError;
  const canSubmit = state.step === "check" && !requiresRelogin && !firstBlockingStep && !!onSubmit && !!savePlanResult?.ok;

  return (
    <Stack gap="lg">
      <Modal
        opened={confirmBackOpened}
        onClose={() => setConfirmBackOpened(false)}
        title={locale.CreatePost_ConfirmBackTitle}
        centered
      >
        <Text>{locale.CreatePost_ConfirmBackDescription}</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" color="gray" onClick={() => setConfirmBackOpened(false)}>
            {locale.DeleteList_CancelButton}
          </Button>
          <Button
            variant="filled"
            color="red"
            onClick={() => {
              setConfirmBackOpened(false);
              onBack?.();
            }}
          >
            {locale.Menu_Back}
          </Button>
        </Group>
      </Modal>

      <PostComposerStepper step={state.step} onStepChange={requestStepChange} isStepReachable={isStepReachable} />

      {planErrorVisible && (
        <Alert color="yellow" variant="default" radius="sm">
          {savePlanResult.message}
        </Alert>
      )}

      {submitError && (
        <Alert color="red" variant="default" radius="sm">
          {submitError}
        </Alert>
      )}

      {renderStep({ state, setState, goToStep, stepError: activeStepError, stepErrorMessage: activeStepErrorMessage })}

      <PostComposerActions
        step={state.step}
        submitLabel={state.mode === "edit" ? locale.CreatePost_UpdateButton : locale.PostComposer_ActionSubmit}
        canGoNext={canGoNext}
        canSubmit={canSubmit}
        submitting={state.submitting}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />
    </Stack>
  );
}
