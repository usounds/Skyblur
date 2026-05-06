"use client";

import AutoResizeTextArea from "@/components/AutoResizeTextArea";
import { normalizeFullWidthBrackets, transformPostText, type BracketValidationError } from "@/logic/postComposer/text";
import { useLocale } from "@/state/Locale";
import type { ComposerFixTarget, PostComposerState } from "@/types/postComposer";
import { Button, Group, Modal, Switch, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

type WriteStepProps = {
  state: PostComposerState;
  setState: (patch: Partial<PostComposerState>) => void;
  stepError?: ComposerFixTarget;
  stepErrorMessage?: string;
};

export function getPostTextWarning(error: BracketValidationError | undefined, locale: Record<string, string>) {
  if (error === "duplicate-or-unclosed-bracket") return locale.CreatePost_ErrorDuplicateBranket;
  if (error === "unbalanced-bracket") return locale.CreatePost_BracketsUnbalanced;
  if (error === "bracket-in-simple-mode") return locale.CreatePost_NotBracketInSimpleMode;
  return "";
}

export function WriteStep({ state, setState, stepError, stepErrorMessage }: WriteStepProps) {
  const { localeData: locale } = useLocale();
  const [changeModeOpened, { open: openChangeMode, close: closeChangeMode }] = useDisclosure(false);

  const applyText = (text: string, simpleMode = state.simpleMode, limitConsecutive = state.limitConsecutive) => {
    const transformed = transformPostText({
      text,
      simpleMode,
      limitConsecutive,
      omitChar: locale.CreatePost_OmmitChar,
    });

    setState({
      text,
      textForRecord: transformed.recordText,
      textForBluesky: transformed.blurredText,
      blurredText: transformed.blurredText,
    });
  };

  const warning = getPostTextWarning(
    transformPostText({
      text: state.text,
      simpleMode: state.simpleMode,
      limitConsecutive: state.limitConsecutive,
      omitChar: locale.CreatePost_OmmitChar,
    }).validationError,
    locale,
  );
  const textError = stepError?.field === "text" ? stepErrorMessage : undefined;

  return (
    <div>
      <Modal opened={changeModeOpened} onClose={closeChangeMode} title={locale.CreatePost_ChangeSimpleMode} centered>
        <Text>{locale.CreatePost_ChangeSimpleModeDescription}</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" color="gray" onClick={closeChangeMode}>
            {locale.DeleteList_CancelButton}
          </Button>
          <Button
            color="red"
            onClick={() => {
              const nextSimpleMode = !state.simpleMode;
              setState({ simpleMode: nextSimpleMode, text: "", textForRecord: "", textForBluesky: "", blurredText: "" });
              closeChangeMode();
            }}
          >
            {locale.CreatePost_OK}
          </Button>
        </Group>
      </Modal>

      <Text size="sm" fw={700} mb={6}>{locale.CreatePost_Post}</Text>
      <Switch checked={state.simpleMode} onChange={openChangeMode} label={locale.PostComposer_SimpleModeLabel} mb={4} />
      <Text size="sm" c="dimmed" mb="xs">
        {state.simpleMode ? locale.CreatePost_PostSimpleModeDescription : locale.PostComposer_BracketHelp}
      </Text>

      <AutoResizeTextArea
        text={state.text}
        setPostText={applyText}
        disabled={false}
        locale={locale}
        placeHolder={locale.CreatePost_PostPlaceHolder}
        max={300}
        isEnableBrackets={!state.simpleMode}
        error={textError || warning}
      />

      {transformPostText({
        text: state.text,
        simpleMode: state.simpleMode,
        limitConsecutive: state.limitConsecutive,
        omitChar: locale.CreatePost_OmmitChar,
      }).hasFullWidthBrackets && (
        <Group justify="center" mb="md">
          <Button onClick={() => applyText(normalizeFullWidthBrackets(state.text))}>
            {locale.CreatePost_BracketFromFullToHalf}
          </Button>
        </Group>
      )}

      {state.mode === "create" && (
        <Switch
          checked={state.limitConsecutive}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setState({ limitConsecutive: checked });
            applyText(state.text, state.simpleMode, checked);
          }}
          label={locale.CreatePost_LimitConsecutiveOmmit}
          mb="md"
        />
      )}

      <Text size="sm" fw={600} mt="md">{locale.CreatePost_Additional}</Text>
      <Text size="sm" c="dimmed" mb="xs">{locale.CreatePost_AdditionalDescription}</Text>
      <AutoResizeTextArea
        text={state.additional}
        setPostText={(additional) => setState({ additional })}
        disabled={false}
        locale={locale}
        placeHolder={locale.CreatePost_AdditionalPlaceHolder}
        max={10000}
        isEnableBrackets={false}
      />
    </div>
  );
}
