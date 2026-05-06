"use client";

import { UkSkyblurPost } from "@/lexicon/UkSkyblur";
import { isRestrictedVisibility } from "@/logic/listVisibility";
import { useLocale } from "@/state/Locale";
import { useSensitiveDraftStore } from "@/state/SensitiveDraft";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import type { PostComposerInitialData } from "@/types/postComposer";
import {
  SKYBLUR_POST_COLLECTION,
  THREADGATE_FOLLOWERS,
  THREADGATE_FOLLOWING,
  THREADGATE_MENTION,
  type ThreadGateValue,
  type VisibilityValue,
} from "@/types/types";
import { Alert, Loader, Stack, Text } from "@mantine/core";
import type { ResourceUri } from "@atcute/lexicons/syntax";
import { AlertTriangle } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PasswordUnlockGate } from "./PasswordUnlockGate";

type EditPostLoaderProps = {
  did: string;
  rkey: string;
  children: (initialData: PostComposerInitialData) => ReactNode;
};

type EditLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "password"; baseInitialData: PostComposerInitialData; encryptCid: string }
  | { status: "loaded"; initialData: PostComposerInitialData };

const visibilityValues = new Set<VisibilityValue>([
  "public",
  "password",
  "login",
  "followers",
  "following",
  "mutual",
  "list",
]);

const threadGateRuleMap: Record<string, ThreadGateValue> = {
  "app.bsky.feed.threadgate#mentionRule": THREADGATE_MENTION as ThreadGateValue,
  "app.bsky.feed.threadgate#followingRule": THREADGATE_FOLLOWING as ThreadGateValue,
  "app.bsky.feed.threadgate#followerRule": THREADGATE_FOLLOWERS as ThreadGateValue,
};

export function normalizeEditRouteParams(did: string, rkey: string) {
  const normalizedDid = did.trim();
  const normalizedRkey = rkey.trim();

  /* istanbul ignore next -- The route scaffold rejects different/empty DID params before this loader is used in E2E. */
  if (!normalizedDid.startsWith("did:")) {
    return { ok: false as const, reason: "invalid-did" };
  }
  /* istanbul ignore next -- Next.js route shape prevents empty or slash-containing rkeys from reaching the loader. */
  if (!normalizedRkey || normalizedRkey.includes("/") || normalizedRkey.includes("\\")) {
    return { ok: false as const, reason: "invalid-rkey" };
  }

  return { ok: true as const, did: normalizedDid, rkey: normalizedRkey };
}

export function normalizeEncryptCid(record: UkSkyblurPost.Record) {
  const encryptBody = record.encryptBody as any;
  return encryptBody?.ref?.$link
    || encryptBody?.ref
    || encryptBody?.cid
    || encryptBody?.$link
    || "";
}

export function validateEditableRecord(value: unknown): { ok: true; record: UkSkyblurPost.Record; visibility: VisibilityValue } | { ok: false; reason: string } {
  const record = value as Partial<UkSkyblurPost.Record> | null | undefined;

  if (!record || record.$type !== SKYBLUR_POST_COLLECTION) {
    return { ok: false, reason: "invalid-record-type" };
  }
  if (!record.visibility || !visibilityValues.has(record.visibility as VisibilityValue)) {
    return { ok: false, reason: "invalid-visibility" };
  }
  if (typeof record.text !== "string") {
    return { ok: false, reason: "invalid-text" };
  }

  return {
    ok: true,
    record: record as UkSkyblurPost.Record,
    visibility: record.visibility as VisibilityValue,
  };
}

export function buildEditInitialData(input: {
  did: string;
  rkey: string;
  cid?: string;
  record: UkSkyblurPost.Record;
  text?: string;
  additional?: string;
  passwordUnlocked?: boolean;
}): PostComposerInitialData {
  const visibility = input.record.visibility as VisibilityValue;

  return {
    mode: "edit",
    authorDid: input.did,
    originalVisibility: visibility,
    originalStorageFormat: visibility === "password"
      ? "password-blob"
      : isRestrictedVisibility(visibility)
        ? "restricted-store"
        : "public-record",
    blurUri: `at://${input.did}/${SKYBLUR_POST_COLLECTION}/${input.rkey}`,
    blurCid: input.cid,
    record: input.record,
    text: input.text ?? input.record.text,
    additional: input.additional ?? input.record.additional ?? "",
    visibility,
    listUri: input.record.listUri,
    passwordUnlocked: input.passwordUnlocked ?? visibility !== "password",
  };
}

export function applyPasswordUnlockToInitialData(
  initialData: PostComposerInitialData,
  unlocked: { text: string; additional: string; password: string },
): PostComposerInitialData {
  return {
    ...initialData,
    text: unlocked.text,
    additional: unlocked.additional,
    password: unlocked.password,
    passwordUnlocked: true,
  };
}

export function parseThreadGateRecord(value: unknown): { recordExists: boolean; threadGate: ThreadGateValue[] } {
  const record = value as { $type?: string; allow?: { $type?: string }[] } | undefined;
  if (record?.$type !== "app.bsky.feed.threadgate") return { recordExists: false, threadGate: [] };

  return {
    recordExists: true,
    threadGate: (record.allow ?? [])
      .map((rule) => rule.$type ? threadGateRuleMap[rule.$type] : undefined)
      .filter((value): value is ThreadGateValue => !!value),
  };
}

export function parsePostGateRecord(value: unknown): { recordExists: boolean; postGate: { allowQuote: boolean } } {
  const record = value as { $type?: string; embeddingRules?: { $type?: string }[] } | undefined;
  if (record?.$type !== "app.bsky.feed.postgate") return { recordExists: false, postGate: { allowQuote: true } };

  return {
    recordExists: true,
    postGate: {
      allowQuote: !(record.embeddingRules ?? []).some((rule) => rule.$type === "app.bsky.feed.postgate#disableRule"),
    },
  };
}

async function loadGateInitialData(agent: any, did: string, rkey: string) {
  let gateControlsEditable = true;

  const [threadGateResponse, postGateResponse] = await Promise.all([
    agent.get("com.atproto.repo.getRecord", {
      params: {
        repo: did as any,
        collection: "app.bsky.feed.threadgate",
        rkey,
      },
    }).catch(() => ({ ok: false, status: 500 })),
    agent.get("com.atproto.repo.getRecord", {
      params: {
        repo: did as any,
        collection: "app.bsky.feed.postgate",
        rkey,
      },
    }).catch(() => ({ ok: false, status: 500 })),
  ]);

  if ((!threadGateResponse.ok && threadGateResponse.status !== 404) || (!postGateResponse.ok && postGateResponse.status !== 404)) {
    gateControlsEditable = false;
  }

  const threadGate = threadGateResponse.ok
    ? parseThreadGateRecord(threadGateResponse.data?.value)
    : { recordExists: false, threadGate: [] };
  const postGate = postGateResponse.ok
    ? parsePostGateRecord(postGateResponse.data?.value)
    : { recordExists: false, postGate: { allowQuote: true } };

  return {
    threadGate: threadGate.threadGate,
    postGate: postGate.postGate,
    threadGateRecordExists: threadGate.recordExists,
    postGateRecordExists: postGate.recordExists,
    gateControlsEditable,
  };
}

function getRestrictedEditErrorMessage(errorCode: string, locale: Record<string, string>) {
  if (errorCode === "NotFollower") return locale.Post_Restricted_NotAuthorized_Followers;
  if (errorCode === "NotFollowing") return locale.Post_Restricted_NotAuthorized_Following;
  if (errorCode === "NotMutual") return locale.Post_Restricted_NotAuthorized_Mutual;
  if (errorCode === "AuthRequired") return locale.Post_Restricted_LoginRequired;
  if (errorCode === "ContentMissing") return locale.Post_Restricted_ContentMissing;
  if (errorCode.startsWith("NotList")) return locale.Post_Restricted_NotAuthorized_List;
  if (errorCode === "ListMembershipCheckFailed") return locale.Post_Restricted_ListCheckFailed;
  return locale.Post_Restricted_NotAuthorized;
}

export function EditPostLoader({ did, rkey, children }: EditPostLoaderProps) {
  const { localeData: locale } = useLocale();
  const loginDid = useXrpcAgentStore((state) => state.did);
  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
  const agent = useXrpcAgentStore((state) => state.agent);
  const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
  const unlockedBlurUri = useSensitiveDraftStore((state) => state.unlockedBlurUri);
  const unlockedText = useSensitiveDraftStore((state) => state.unlockedText);
  const unlockedAdditional = useSensitiveDraftStore((state) => state.unlockedAdditional);
  const unlockedPassword = useSensitiveDraftStore((state) => state.unlockedPassword);
  const setUnlockedPasswordPost = useSensitiveDraftStore((state) => state.setUnlockedPasswordPost);
  const [loadState, setLoadState] = useState<EditLoadState>({ status: "loading" });
  const requestIdRef = useRef(0);

  const routeParams = useMemo(() => normalizeEditRouteParams(did, rkey), [did, rkey]);

  useEffect(() => {
    if (!isSessionChecked) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    async function loadRecord() {
      if (!routeParams.ok) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorInvalidRoute });
        return;
      }
      if (!loginDid) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorNeedLogin });
        return;
      }
      if (routeParams.did !== loginDid) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorDifferentAccount });
        return;
      }

      setLoadState({ status: "loading" });

      const recordResponse = await agent.get("com.atproto.repo.getRecord", {
        params: {
          repo: routeParams.did as any,
          collection: SKYBLUR_POST_COLLECTION,
          rkey: routeParams.rkey,
        },
      });

      /* istanbul ignore next -- Stale request protection is defensive for rapid route changes. */
      if (requestIdRef.current !== requestId) return;

      if (!recordResponse.ok) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorRecordFailed });
        return;
      }

      const validation = validateEditableRecord(recordResponse.data.value);
      if (!validation.ok) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorUnsupportedRecord });
        return;
      }

      const gateInitialData = await loadGateInitialData(agent, routeParams.did, routeParams.rkey);

      /* istanbul ignore next -- Stale request protection is defensive for rapid route changes. */
      if (requestIdRef.current !== requestId) return;

      const baseInitialData = {
        ...buildEditInitialData({
        did: routeParams.did,
        rkey: routeParams.rkey,
        cid: recordResponse.data.cid,
        record: validation.record,
        }),
        ...gateInitialData,
      };

      if (validation.visibility === "password") {
        if (unlockedBlurUri === baseInitialData.blurUri && unlockedText) {
          setLoadState({
            status: "loaded",
            initialData: applyPasswordUnlockToInitialData(baseInitialData, {
              text: unlockedText,
              additional: unlockedAdditional,
              password: unlockedPassword,
            }),
          });
          return;
        }

        const encryptCid = normalizeEncryptCid(validation.record);
        if (!encryptCid) {
          setLoadState({ status: "error", message: locale.PostComposer_LoadErrorPasswordDataMissing });
          return;
        }
        setLoadState({ status: "password", baseInitialData, encryptCid });
        return;
      }

      if (isRestrictedVisibility(validation.visibility)) {
        const uri = `at://${routeParams.did}/${SKYBLUR_POST_COLLECTION}/${routeParams.rkey}`;
        const response = await apiProxyAgent.post("uk.skyblur.post.getPost", {
          input: { uri: uri as ResourceUri },
        });

        /* istanbul ignore next -- Stale request protection is defensive for rapid route changes. */
        if (requestIdRef.current !== requestId) return;

        const data = response.data as { text?: string; additional?: string; errorCode?: string } | undefined;
        if (!response.ok || !data || typeof data.text !== "string") {
          setLoadState({ status: "error", message: locale.PostComposer_LoadErrorRestrictedContentFailed });
          return;
        }
        if (data.errorCode) {
          setLoadState({ status: "error", message: getRestrictedEditErrorMessage(data.errorCode, locale) });
          return;
        }

        setLoadState({
          status: "loaded",
          initialData: {
            ...baseInitialData,
            text: data.text,
            additional: data.additional ?? "",
          },
        });
        return;
      }

      setLoadState({ status: "loaded", initialData: baseInitialData });
    }

    void loadRecord().catch(() => {
      /* istanbul ignore next -- E2E covers non-ok responses; this guards unexpected client exceptions. */
      if (requestIdRef.current === requestId) {
        setLoadState({ status: "error", message: locale.PostComposer_LoadErrorRecordFailed });
      }
    });
  }, [
    agent,
    apiProxyAgent,
    isSessionChecked,
    locale.CreatePost_NeedLoginTitle,
    loginDid,
    routeParams,
    unlockedAdditional,
    unlockedBlurUri,
    unlockedPassword,
    unlockedText,
    setUnlockedPasswordPost,
  ]);

  if (loadState.status === "loading") {
    return (
      <Stack align="center" gap="sm" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">{locale.PostComposer_LoadingPost}</Text>
      </Stack>
    );
  }

  if (loadState.status === "error") {
    return (
      <Alert icon={<AlertTriangle size={18} />} color="red" variant="light">
        {loadState.message}
      </Alert>
    );
  }

  if (loadState.status === "password") {
    return (
      <PasswordUnlockGate
        did={did}
        encryptCid={loadState.encryptCid}
        onUnlocked={(unlocked) => {
          setUnlockedPasswordPost({
            blurUri: loadState.baseInitialData.blurUri ?? "",
            text: unlocked.text,
            additional: unlocked.additional,
            password: unlocked.password,
          });
          setLoadState({
            status: "loaded",
            initialData: applyPasswordUnlockToInitialData(loadState.baseInitialData, unlocked),
          });
        }}
      />
    );
  }

  return <>{children(loadState.initialData)}</>;
}
