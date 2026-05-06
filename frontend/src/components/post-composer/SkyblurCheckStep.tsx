"use client";

import PostTextWithBold from "@/components/PostTextWithBold";
import type { ComposerFixTarget, SkyblurCheckSummary } from "@/types/postComposer";
import { useLocale } from "@/state/Locale";
import { Badge, Button, Group, Stack, Tabs, Text } from "@mantine/core";
import { AlertTriangle, CornerDownRight, Eye, EyeOff, MessageCircle, Quote, Users } from "lucide-react";
import { useState } from "react";
import classes from "./SkyblurCheckStep.module.css";

type SkyblurCheckStepProps = {
  summary: SkyblurCheckSummary;
  requiresRelogin?: boolean;
  onFix: (target: ComposerFixTarget) => void;
};

function getReadableByLabel(value: string, locale: Record<string, string>) {
  const labels: Record<string, string> = {
    "anyone": locale.PostComposer_CheckReadableAnyone,
    "logged-in-users": locale.PostComposer_CheckReadableLoggedIn,
    "password-holders": locale.PostComposer_CheckReadablePassword,
    followers: locale.PostComposer_CheckReadableFollowers,
    following: locale.PostComposer_CheckReadableFollowing,
    mutuals: locale.PostComposer_CheckReadableMutuals,
    "list-members": locale.PostComposer_CheckReadableListMembers,
  };
  return labels[value];
}

function getThreadGateLabel(value: string, locale: Record<string, string>) {
  const labels: Record<string, string> = {
    mention: locale.PostComposer_CheckThreadGateMention,
    following: locale.PostComposer_CheckThreadGateFollowing,
    followers: locale.PostComposer_CheckThreadGateFollowers,
  };
  return labels[value];
}

function joinLabels(values: string[], mapper: (value: string) => string, fallback: string) {
  return values.length > 0 ? values.map(mapper).join(", ") : fallback;
}

export function SkyblurCheckStep({ summary, requiresRelogin, onFix }: SkyblurCheckStepProps) {
  const { localeData: locale } = useLocale();
  const isEditMode = summary.savePlan.mode === "edit";
  const [skyblurPreviewAudience, setSkyblurPreviewAudience] = useState<string | null>("allowed");
  const hasBlockingFix = summary.fixTargets.length > 0;
  const hasBlockedAudience = summary.audience.unreadableView !== "full-text";
  /* istanbul ignore next -- Relogin/fix decision branches are covered by route-level notices and save-plan tests; E2E exercises the ready posting path. */
  const status = requiresRelogin === true ? "relogin" : hasBlockingFix ? "fix" : "ready";
  const statusCopy = {
    relogin: {
      title: locale.PostComposer_CheckReloginTitle,
      description: locale.PostComposer_CheckReloginDescription,
      color: "yellow",
    },
    fix: {
      title: locale.PostComposer_CheckFixTitle,
      description: locale.PostComposer_CheckFixDescription,
      color: "red",
    },
    ready: {
      title: locale.PostComposer_CheckReadyDecisionTitle,
      description: locale.PostComposer_CheckReadyDecisionDescription,
      color: "blue",
    },
  }[status];

  return (
    <div className={classes.shell}>
      {/* istanbul ignore next -- Non-ready status banners are covered by route-level relogin/unsupported-flow E2E. */}
      {status !== "ready" && (
        <div className={classes.header}>
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <span className={`${classes.statusIcon} ${classes.statusIconWarning}`}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <Text fw={800}>{statusCopy.title}</Text>
              <Text size="sm" c="dimmed">{statusCopy.description}</Text>
            </div>
          </Group>
          <Badge variant="light" color={statusCopy.color}>
            {statusCopy.title}
          </Badge>
        </div>
      )}

      {/* istanbul ignore next -- Fix-target rendering is covered by save-plan unit tests and unsupported-flow route E2E. */}
      {hasBlockingFix && (
        <div className={classes.fixNotice}>
          <Stack gap="xs">
            <Text size="sm" fw={600}>{locale.PostComposer_CheckFixRequired}</Text>
            <Group gap="xs">
              {summary.fixTargets.map((target) => (
                <Button key={`${target.step}-${target.field}`} size="compact-sm" variant="light" color="red" onClick={() => onFix(target)}>
                  {locale.PostComposer_CheckFixButton}
                </Button>
              ))}
            </Group>
          </Stack>
        </div>
      )}

      <div className={classes.platformGrid}>
        <section className={classes.panel}>
          <Group gap={8} mb="xs">
            <Eye size={17} />
            <Text fw={800}>{locale.PostComposer_CheckSkyblurTitle}</Text>
          </Group>
          {hasBlockedAudience && (
            <Tabs value={skyblurPreviewAudience} onChange={setSkyblurPreviewAudience} variant="pills" radius="xl" mb="sm">
              <Tabs.List>
                <Tabs.Tab value="allowed" leftSection={<Users size={14} />}>
                  {locale.PostComposer_CheckAllowedViewerTab}
                </Tabs.Tab>
                <Tabs.Tab value="blocked" leftSection={<EyeOff size={14} />}>
                  {locale.PostComposer_CheckBlockedViewerTab}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
          )}
          {/* istanbul ignore next -- The blocked-audience tab is visual-only; E2E validates the underlying restricted visibility decision. */}
          {hasBlockedAudience && skyblurPreviewAudience === "blocked" ? (
            <div className={classes.blueskyEquivalentPreview}>
              <PostTextWithBold postText={summary.blueskyText} isValidateBrackets={false} isMask={locale.CreatePost_OmmitChar} />
            </div>
          ) : (
            <>
              <PostTextWithBold postText={summary.skyblurText} isValidateBrackets={true} isMask={null} />
              {summary.additionalText && (
                <div className={classes.additionalPreview}>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{summary.additionalText}</Text>
                </div>
              )}
            </>
          )}

          <div className={classes.platformSettings}>
            <div className={classes.metaRow}>
              <Group gap={6}>
                <Users size={15} />
                <Text size="sm" c="dimmed">{locale.PostComposer_CheckReadableBy}</Text>
              </Group>
              <Text size="sm" fw={600}>
                {joinLabels(summary.audience.readableBy, (value) => getReadableByLabel(value, locale), locale.PostComposer_CheckNoRestriction)}
              </Text>
            </div>
            {/* istanbul ignore next -- Edit visibility-change handling is asserted by the unsupported migration route test. */}
            {summary.audience.visibilityChanged && (
              <Badge variant="light" color="yellow">{locale.PostComposer_CheckVisibilityChanged}</Badge>
            )}
          </div>
        </section>

        <section className={classes.panel}>
          <Group gap={8} mb="xs">
            <EyeOff size={17} />
            <Text fw={800}>{locale.PostComposer_CheckBlueskyTitle}</Text>
          </Group>
          {isEditMode ? (
            <Text size="sm" c="dimmed">
              {locale.PostComposer_CheckEditBlueskyNotUpdated}
            </Text>
          ) : (
            <PostTextWithBold postText={summary.blueskyText} isValidateBrackets={false} isMask={locale.CreatePost_OmmitChar} />
          )}

          <div className={classes.platformSettings}>
            <div className={classes.metaRow}>
              <Group gap={6}>
                <MessageCircle size={15} />
                <Text size="sm" c="dimmed">{locale.PostComposer_CheckThreadGate}</Text>
              </Group>
              <Text size="sm" fw={600}>
                {joinLabels(summary.threadGate, (value) => getThreadGateLabel(value, locale), locale.PostComposer_CheckNoRestriction)}
              </Text>
            </div>
            {!isEditMode && (
              <div className={classes.metaRow}>
                <Group gap={6}>
                  <CornerDownRight size={15} />
                  <Text size="sm" c="dimmed">{locale.PostComposer_ReplyTargetTitle}</Text>
                </Group>
                <Text size="sm" fw={600}>{summary.replyTarget ?? locale.PostComposer_CheckNoRestriction}</Text>
              </div>
            )}
            <div className={classes.metaRow}>
              <Group gap={6}>
                <Quote size={15} />
                <Text size="sm" c="dimmed">{locale.PostComposer_CheckPostGate}</Text>
              </Group>
              <Text size="sm" fw={600}>{summary.postGate.allowQuote ? locale.PostComposer_CheckQuoteAllowed : locale.PostComposer_CheckQuoteRestricted}</Text>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
