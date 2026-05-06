"use client";

import { ReplyList } from "@/components/ReplyList";
import { OwnedListPicker } from "@/components/OwnedListPicker";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { isListVisibility, type OwnedListOption } from "@/logic/listVisibility";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import type { PostComposerInitialData, PostComposerState } from "@/types/postComposer";
import {
  THREADGATE_FOLLOWERS,
  THREADGATE_FOLLOWING,
  THREADGATE_MENTION,
  VISIBILITY_FOLLOWERS,
  VISIBILITY_FOLLOWING,
  VISIBILITY_LIST,
  VISIBILITY_LOGIN,
  VISIBILITY_MUTUAL,
  VISIBILITY_PASSWORD,
  VISIBILITY_PUBLIC,
  type ThreadGateValue,
  type VisibilityValue,
} from "@/types/types";
import { Accordion, Alert, Button, Chip, Group, Paper, PasswordInput, SimpleGrid, Switch, Text } from "@mantine/core";
import { AlertTriangle, Globe, Handshake, List, Lock, LogIn, MessageCircle, Quote, Reply as ReplyIcon, UserCheck, Users } from "lucide-react";
import type { ComposerFixTarget } from "@/types/postComposer";
import { useState } from "react";

type AudienceStepProps = {
  state: PostComposerState;
  setState: (patch: Partial<PostComposerState>) => void;
  initialData?: PostComposerInitialData;
  stepError?: ComposerFixTarget;
  stepErrorMessage?: string;
};

export function getPasswordWhitespaceError(password: string) {
  return /[ \t\r\n\u3000]/.test(password);
}

export function getVisibilityOutcomeCopy(visibility: VisibilityValue, locale: Record<string, string>) {
  const values: Record<VisibilityValue, { bluesky: string; skyblur: string }> = {
    public: {
      bluesky: locale.PostComposer_AudienceOutcomePublicBluesky,
      skyblur: locale.PostComposer_AudienceOutcomePublicSkyblur,
    },
    login: {
      bluesky: locale.PostComposer_AudienceOutcomeLoginBluesky,
      skyblur: locale.PostComposer_AudienceOutcomeLoginSkyblur,
    },
    password: {
      bluesky: locale.PostComposer_AudienceOutcomePasswordBluesky,
      skyblur: locale.PostComposer_AudienceOutcomePasswordSkyblur,
    },
    followers: {
      bluesky: locale.PostComposer_AudienceOutcomeFollowersBluesky,
      skyblur: locale.PostComposer_AudienceOutcomeFollowersSkyblur,
    },
    following: {
      bluesky: locale.PostComposer_AudienceOutcomeFollowingBluesky,
      skyblur: locale.PostComposer_AudienceOutcomeFollowingSkyblur,
    },
    mutual: {
      bluesky: locale.PostComposer_AudienceOutcomeMutualBluesky,
      skyblur: locale.PostComposer_AudienceOutcomeMutualSkyblur,
    },
    list: {
      bluesky: locale.PostComposer_AudienceOutcomeListBluesky,
      skyblur: locale.PostComposer_AudienceOutcomeListSkyblur,
    },
  };

  return values[visibility];
}

export function getGateControlsEditable(state: PostComposerState, initialData?: PostComposerInitialData) {
  return state.mode !== "edit" || initialData?.gateControlsEditable !== false;
}

export function AudienceStep({ state, setState, initialData, stepError, stepErrorMessage }: AudienceStepProps) {
  const { localeData: locale } = useLocale();
  const did = useXrpcAgentStore((store) => store.did);
  const agent = useXrpcAgentStore((store) => store.agent);
  const [replyPickerOpened, setReplyPickerOpened] = useState(!!state.replyPost);

  const setVisibility = (visibility: VisibilityValue) => {
    setState({
      visibility,
      listUri: isListVisibility(visibility) ? state.listUri : undefined,
      password: visibility === VISIBILITY_PASSWORD ? state.password : "",
    });
  };

  const setSelectedList = (list: OwnedListOption | null) => {
    setState({ listUri: list?.uri });
  };
  const listError = stepError?.field === "listUri" ? stepErrorMessage : undefined;
  const passwordError = stepError?.field === "password" ? stepErrorMessage : undefined;
  const visibilityOutcome = getVisibilityOutcomeCopy(state.visibility, locale);
  const gateControlsEditable = getGateControlsEditable(state, initialData);

  const visibilityOptions = [
    { value: VISIBILITY_PUBLIC as VisibilityValue, label: locale.CreatePost_VisibilityPublic, icon: Globe },
    { value: VISIBILITY_LOGIN as VisibilityValue, label: locale.CreatePost_VisibilityLogin, icon: LogIn },
    { value: VISIBILITY_PASSWORD as VisibilityValue, label: locale.CreatePost_VisibilityPassword, icon: Lock },
    { value: VISIBILITY_FOLLOWERS as VisibilityValue, label: locale.CreatePost_VisibilityFollowers, icon: Users },
    { value: VISIBILITY_FOLLOWING as VisibilityValue, label: locale.CreatePost_VisibilityFollowing, icon: UserCheck },
    { value: VISIBILITY_MUTUAL as VisibilityValue, label: locale.CreatePost_VisibilityMutual, icon: Handshake },
    { value: VISIBILITY_LIST as VisibilityValue, label: locale.CreatePost_VisibilityList, icon: List },
  ];

  return (
    <div>
      <Text fw={600} mb={4}>{locale.CreatePost_PublishMethodTitle}</Text>
      <Text size="sm" c="dimmed" mb="sm">{locale.CreatePost_PublishMethodDescription}</Text>

      <SimpleGrid cols={{ base: 2, xs: 3, sm: 4 }} spacing="xs">
        {visibilityOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = state.visibility === option.value;

          return (
            <Button
              key={option.value}
              variant={isSelected ? "light" : "default"}
              color="blue"
              h={70}
              fullWidth
              fw="normal"
              px={2}
              onClick={() => setVisibility(option.value)}
              styles={{
                label: {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  whiteSpace: "normal",
                  lineHeight: 1.2,
                  width: "100%",
                  height: "100%",
                },
              }}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span style={{ fontSize: 11 }}>{option.label}</span>
            </Button>
          );
        })}
      </SimpleGrid>

      <Paper withBorder radius="sm" p="sm" mt="sm" style={{ background: "var(--mantine-color-body)" }}>
        <Text size="sm" fw={700} mb={6}>{locale.PostComposer_AudienceOutcomeTitle}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <div>
            <Text size="xs" c="dimmed">{locale.PostComposer_AudienceOutcomeBluesky}</Text>
            <Text size="sm">{visibilityOutcome.bluesky}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">{locale.PostComposer_AudienceOutcomeSkyblur}</Text>
            <Text size="sm">{visibilityOutcome.skyblur}</Text>
          </div>
        </SimpleGrid>
      </Paper>

      {isListVisibility(state.visibility) && (
        <OwnedListPicker
          value={state.listUri}
          onChange={setSelectedList}
          did={did}
          agent={agent || null}
          error={listError || ""}
        />
      )}

      {state.visibility === VISIBILITY_PASSWORD && (
        <div style={{ marginTop: 16 }}>
          <Text size="sm" c="dimmed" mb={4}>{locale.CreatePost_PasswordInputDescription}</Text>
          <PasswordInput
            value={state.password}
            maxLength={20}
            placeholder="p@ssw0rd"
            onChange={(event) => setState({ password: event.currentTarget.value })}
            error={passwordError}
          />
          {getPasswordWhitespaceError(state.password) && (
            <Text size="sm" c="red" mt={4}>{locale.CreatePost_PasswordErrorSpace}</Text>
          )}
        </div>
      )}

      <Accordion variant="separated" mt="lg">
        <Accordion.Item value="details">
          <Accordion.Control icon={<MessageCircle size={16} />}>
            <div>
              <Text fw={600}>{locale.PostComposer_Details}</Text>
              <Text size="xs" c="dimmed">{locale.PostComposer_DetailsSummary}</Text>
            </div>
          </Accordion.Control>
          <Accordion.Panel>
            <Text fw={600} mb={4}>{locale.CreatePost_ThreadGateTitle}</Text>
            <Text size="sm" c="dimmed" mb="xs">{locale.PostComposer_ReplyControlDescription}</Text>
            {!gateControlsEditable && (
              <Alert icon={<AlertTriangle size={16} />} color="yellow" variant="light" mb="sm">
                {locale.PostComposer_GateControlsUnavailable}
              </Alert>
            )}
            <Chip.Group
              multiple
              value={state.threadGate}
              onChange={(value) => {
                if (!gateControlsEditable) return;
                setState({ threadGate: value as ThreadGateValue[] });
              }}
            >
              <Group gap="xs">
                <Chip value={THREADGATE_MENTION} disabled={!gateControlsEditable}>{locale.CreatePost_ThreadGateMention}</Chip>
                <Chip value={THREADGATE_FOLLOWING} disabled={!gateControlsEditable}>{locale.CreatePost_ThreadGateFollowing}</Chip>
                <Chip value={THREADGATE_FOLLOWERS} disabled={!gateControlsEditable}>{locale.CreatePost_ThreadGateFollowers}</Chip>
              </Group>
            </Chip.Group>

            <Group gap={6} mt="md" mb={4}>
              <Quote size={16} />
              <Text fw={600}>{locale.PostComposer_QuoteSettingTitle}</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="xs">{locale.PostComposer_QuoteSettingDescription}</Text>
            <Switch
              checked={state.postGate.allowQuote}
              disabled={!gateControlsEditable}
              onChange={(event) => {
                if (!gateControlsEditable) return;
                setState({ postGate: { allowQuote: event.currentTarget.checked } });
              }}
              label={locale.CreatePost_ThreadGateQuoteAllow}
            />

            <Text fw={600} mt="md" mb={4}>{locale.PostComposer_ReplyTargetTitle}</Text>
            <Text size="sm" c="dimmed" mb="xs">{locale.PostComposer_ReplyTargetDescription}</Text>
            <Switch
              checked={replyPickerOpened}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setReplyPickerOpened(checked);
                if (!checked) setState({ replyPost: undefined });
              }}
              label={locale.PostComposer_ReplyTargetToggle}
            />
            {replyPickerOpened && did && (
              <div style={{ marginTop: 12 }}>
                {state.replyPost ? (
                  <Paper withBorder radius="sm" p="sm">
                    <Group gap={8} mb={6}>
                      <ReplyIcon size={16} />
                      <Text size="sm" fw={600}>{locale.PostComposer_SelectedReplyTarget}</Text>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{state.replyPost.record.text}</Text>
                    <Group justify="space-between" mt="sm">
                      <Text size="xs" c="dimmed">{formatDateToLocale(state.replyPost.record.createdAt)}</Text>
                      <Button size="compact-sm" variant="default" onClick={() => setState({ replyPost: undefined })}>
                        {locale.PostComposer_ChangeReplyTarget}
                      </Button>
                    </Group>
                  </Paper>
                ) : (
                  <ReplyList handleSetPost={(replyPost) => setState({ replyPost })} did={did} />
                )}
              </div>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
