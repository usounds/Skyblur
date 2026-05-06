import { UkSkyblurPostEncrypt, UkSkyblurPostStore } from "@/lexicon/UkSkyblur";
import { IdentityResolver } from "@/logic/IdentityResolver";
import { isListVisibility, isRestrictedVisibility } from "@/logic/listVisibility";
import type {
  ComposerStorageFormat,
  PostComposerInitialData,
  PostComposerState,
  RestrictedVisibility,
  SavePlan,
  SavePlanWriteTarget,
  SaveResult,
  SameStorageEditableField,
} from "@/types/postComposer";
import { MENTION_REGEX, SKYBLUR_POST_COLLECTION, TAG_REGEX, TRAILING_PUNCTUATION_REGEX, type ThreadGateValue, type VisibilityValue } from "@/types/types";
import type { ActorIdentifier, ResourceUri } from "@atcute/lexicons/syntax";
import * as TID from "@atcute/tid";
import { franc } from "franc";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iso6393to1 = require("iso-639-3-to-1");

type PostComposerSaveInput = {
  state: PostComposerState;
  plan: SavePlan;
  did: string;
  agent: any;
  apiProxyAgent: any;
  locale?: Record<string, string>;
  initialData?: PostComposerInitialData;
};

type Write = {
  $type: "com.atproto.repo.applyWrites#create" | "com.atproto.repo.applyWrites#update" | "com.atproto.repo.applyWrites#delete";
  collection: `${string}.${string}.${string}`;
  rkey: string;
  value?: Record<string, unknown>;
};

const urlPattern = /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:@&=+$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g;

function utf16IndexToUtf8Index(str: string, utf16Index: number): number {
  return new TextEncoder().encode(str.slice(0, utf16Index)).length;
}

function detectLanguage(text: string, locale?: Record<string, string>): string {
  return iso6393to1(franc(text)) || locale?.CreatePost_Lang || "en";
}

function isLikelyValidDomain(domain: string) {
  return /^[\w.-]+\.[a-z]{2,}$/i.test(domain);
}

async function buildFacets(text: string) {
  const facets: Record<string, unknown>[] = [];
  let tagMatch: RegExpExecArray | null;
  TAG_REGEX.lastIndex = 0;

  while ((tagMatch = TAG_REGEX.exec(text))) {
    const prefix = tagMatch[1];
    let candidateTag = tagMatch[2];
    if (!candidateTag) continue;

    candidateTag = candidateTag.trim().replace(TRAILING_PUNCTUATION_REGEX, "");
    if (candidateTag.length === 0 || candidateTag.length > 64) continue;

    const startPos = tagMatch.index + prefix.length;
    const fullTag = `#${candidateTag}`;
    const byteStart = utf16IndexToUtf8Index(text, startPos);
    const byteEnd = byteStart + new TextEncoder().encode(fullTag).length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: candidateTag }],
    });
  }

  MENTION_REGEX.lastIndex = 0;
  for (const match of text.matchAll(MENTION_REGEX)) {
    const prefix = match[1] ?? "";
    const handle = match[3];
    if (!handle || (!isLikelyValidDomain(handle) && !handle.endsWith(".test"))) continue;

    const startPos = (match.index ?? 0) + prefix.length;
    const endPos = startPos + 1 + handle.length;

    try {
      const result = await IdentityResolver.resolve(handle as ActorIdentifier);
      facets.push({
        $type: "app.bsky.richtext.facet",
        index: {
          byteStart: utf16IndexToUtf8Index(text, startPos),
          byteEnd: utf16IndexToUtf8Index(text, endPos),
        },
        features: [{ $type: "app.bsky.richtext.facet#mention", did: result.did }],
      });
    } catch {
      // Keep posting possible when a syntactic mention cannot be resolved.
    }
  }

  for (const match of text.matchAll(urlPattern)) {
    const url = match[0];
    const startPos = match.index ?? 0;
    const byteStart = utf16IndexToUtf8Index(text, startPos);
    const byteEnd = byteStart + new TextEncoder().encode(url).length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    });
  }

  return facets;
}

function getAppOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://skyblur.uk";
}

async function buildBlueskyPostValue(input: PostComposerSaveInput & { rkey: string; blurUri: string }) {
  const text = input.state.textForBluesky || input.state.blurredText || input.state.text;
  const facets = await buildFacets(text);
  const postValue: Record<string, unknown> = {
    $type: "app.bsky.feed.post",
    text,
    langs: [detectLanguage(input.state.text, input.locale)],
    via: "Skyblur",
    "uk.skyblur.post.uri": input.blurUri,
    "uk.skyblur.post.visibility": input.state.visibility,
    createdAt: new Date().toISOString(),
    facets,
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: `${getAppOrigin()}/post/${input.did}/${input.rkey}`,
        title: input.locale?.CreatePost_OGPTitle || "Skyblur",
        description: `${input.locale?.CreatePost_OGPDescription || "Refer to the unblurred text."}${input.state.visibility === "password" ? input.locale?.CreatePost_OGPDescriptionPassword || "" : ""}`,
      },
    },
  };

  const replyPost = input.state.replyPost;
  if (replyPost) {
    postValue.reply = {
      $type: "app.bsky.feed.post#replyRef",
      root: {
        cid: replyPost.record.reply?.root.cid || replyPost.cid,
        uri: (replyPost.record.reply?.root.uri || replyPost.uri) as ResourceUri,
        $type: "com.atproto.repo.strongRef",
      },
      parent: {
        cid: replyPost.cid || "",
        uri: replyPost.uri as ResourceUri,
        $type: "com.atproto.repo.strongRef",
      },
    };
  }

  return postValue;
}

export function getComposerStorageFormat(visibility: VisibilityValue): ComposerStorageFormat {
  if (visibility === "password") return "password-blob";
  if (isRestrictedVisibility(visibility)) return "restricted-store";
  return "public-record";
}

function editableFieldsForPlan(kind: SavePlan["kind"]): SameStorageEditableField[] {
  return ["text", "additional", "simpleMode", "limitConsecutive", "listUri", "threadGate", "postGate"];
}

function sameThreadGate(left: ThreadGateValue[] = [], right: ThreadGateValue[] = []) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function buildWriteTargets(input: {
  mode: "create" | "edit";
  storageFormat: ComposerStorageFormat;
  threadGate: ThreadGateValue[];
  allowQuote: boolean;
  initialData?: PostComposerInitialData;
}): SavePlanWriteTarget[] {
  const targets: SavePlanWriteTarget[] = [];

  if (input.mode === "create") {
    targets.push("create-bluesky-post", "create-skyblur-record");
    if (input.storageFormat === "password-blob") targets.push("upload-password-blob");
    if (input.storageFormat === "restricted-store") targets.push("store-restricted-content");
    if (input.threadGate.length) targets.push("create-threadgate");
    if (!input.allowQuote) targets.push("create-postgate");
    return targets;
  }

  targets.push("update-skyblur-record");
  if (input.storageFormat === "password-blob") targets.push("upload-password-blob");
  if (input.storageFormat === "restricted-store") targets.push("store-restricted-content");
  if (input.initialData?.gateControlsEditable !== false) {
    if (!sameThreadGate(input.threadGate, input.initialData?.threadGate ?? [])) targets.push("update-threadgate");
    if (input.allowQuote !== (input.initialData?.postGate?.allowQuote ?? true)) targets.push("update-postgate");
  }
  return targets;
}

export function buildPostComposerSavePlan(state: PostComposerState, initialData?: PostComposerInitialData): SavePlan | { error: "unsupported-storage-change" } {
  const toStorageFormat = getComposerStorageFormat(state.visibility);

  if (state.mode === "create") {
    const base = {
      mode: "create" as const,
      toVisibility: state.visibility,
      toStorageFormat,
      threadGate: state.threadGate,
      postGate: state.postGate,
      editableFields: editableFieldsForPlan("create-public"),
      writeTargets: buildWriteTargets({
        mode: "create",
        storageFormat: toStorageFormat,
        threadGate: state.threadGate,
        allowQuote: state.postGate.allowQuote,
        initialData,
      }),
      requiresPasswordUnlock: false as const,
      updatesBlueskyPostBody: false as const,
    };

    if (state.visibility === "password") {
      return {
        ...base,
        kind: "create-password",
        toVisibility: "password",
        toStorageFormat: "password-blob",
        requiresPasswordInput: true,
      };
    }

    if (isRestrictedVisibility(state.visibility)) {
      return {
        ...base,
        kind: "create-restricted",
        toVisibility: state.visibility as RestrictedVisibility,
        toStorageFormat: "restricted-store",
        requiresPasswordInput: false,
      };
    }

    return {
      ...base,
      kind: "create-public",
      toVisibility: state.visibility as "public" | "login",
      toStorageFormat: "public-record",
      requiresPasswordInput: false,
    };
  }

  const fromVisibility = initialData?.originalVisibility;
  const fromStorageFormat = initialData?.originalStorageFormat ?? (fromVisibility ? getComposerStorageFormat(fromVisibility) : undefined);
  const changesPasswordBoundary = fromVisibility === "password"
    ? state.visibility !== "password"
    : state.visibility === "password";

  if (!fromVisibility || !fromStorageFormat || changesPasswordBoundary) {
    return { error: "unsupported-storage-change" };
  }

  return {
    kind: "update-same-storage",
    mode: "edit",
    fromVisibility,
    toVisibility: state.visibility,
    fromStorageFormat,
    toStorageFormat,
    threadGate: state.threadGate,
    postGate: state.postGate,
    editableFields: editableFieldsForPlan("update-same-storage"),
    writeTargets: buildWriteTargets({
      mode: "edit",
      storageFormat: toStorageFormat,
      threadGate: state.threadGate,
      allowQuote: state.postGate.allowQuote,
      initialData,
    }),
    requiresPasswordInput: state.visibility === "password",
    requiresPasswordUnlock: state.visibility === "password",
    updatesBlueskyPostBody: false,
  };
}

function buildThreadGateWrite(input: { did: string; rkey: string; threadGate: ThreadGateValue[]; mode: "create" | "edit" }): Write | undefined {
  if (!input.threadGate.length && input.mode === "create") return undefined;

  const allow: { $type: string }[] = [];
  if (input.threadGate.includes("mention")) allow.push({ $type: "app.bsky.feed.threadgate#mentionRule" });
  if (input.threadGate.includes("following")) allow.push({ $type: "app.bsky.feed.threadgate#followingRule" });
  if (input.threadGate.includes("followers")) allow.push({ $type: "app.bsky.feed.threadgate#followerRule" });

  return {
    $type: input.mode === "create" ? "com.atproto.repo.applyWrites#create" : "com.atproto.repo.applyWrites#update",
    collection: "app.bsky.feed.threadgate",
    rkey: input.rkey,
    value: {
      $type: "app.bsky.feed.threadgate",
      post: `at://${input.did}/app.bsky.feed.post/${input.rkey}`,
      allow,
      createdAt: new Date().toISOString(),
    },
  };
}

function buildPostGateWrite(input: { did: string; rkey: string; allowQuote: boolean; mode: "create" | "edit" }): Write | undefined {
  if (input.allowQuote && input.mode === "create") return undefined;

  return {
    $type: input.mode === "create" ? "com.atproto.repo.applyWrites#create" : "com.atproto.repo.applyWrites#update",
    collection: "app.bsky.feed.postgate",
    rkey: input.rkey,
    value: {
      $type: "app.bsky.feed.postgate",
      post: `at://${input.did}/app.bsky.feed.post/${input.rkey}`,
      embeddingRules: input.allowQuote ? [] : [{ $type: "app.bsky.feed.postgate#disableRule" }],
      detachedEmbeddingUris: [],
      createdAt: new Date().toISOString(),
    },
  };
}

function buildEditThreadGateWrite(input: {
  did: string;
  rkey: string;
  threadGate: ThreadGateValue[];
  recordExists: boolean;
}): Write | undefined {
  if (!input.threadGate.length) {
    if (!input.recordExists) return undefined;
    return {
      $type: "com.atproto.repo.applyWrites#delete",
      collection: "app.bsky.feed.threadgate",
      rkey: input.rkey,
    };
  }

  return {
    ...buildThreadGateWrite({ ...input, mode: "edit" })!,
    $type: input.recordExists ? "com.atproto.repo.applyWrites#update" : "com.atproto.repo.applyWrites#create",
  };
}

function buildEditPostGateWrite(input: {
  did: string;
  rkey: string;
  allowQuote: boolean;
  recordExists: boolean;
}): Write | undefined {
  if (input.allowQuote) {
    if (!input.recordExists) return undefined;
    return {
      $type: "com.atproto.repo.applyWrites#delete",
      collection: "app.bsky.feed.postgate",
      rkey: input.rkey,
    };
  }

  return {
    ...buildPostGateWrite({ ...input, mode: "edit" })!,
    $type: input.recordExists ? "com.atproto.repo.applyWrites#update" : "com.atproto.repo.applyWrites#create",
  };
}

function buildEditGateWrites(input: PostComposerSaveInput & { rkey: string }) {
  const { state, initialData, did, rkey } = input;
  const writes: Write[] = [];
  if (initialData?.gateControlsEditable === false) return writes;

  if (!sameThreadGate(state.threadGate, initialData?.threadGate ?? [])) {
    const write = buildEditThreadGateWrite({
      did,
      rkey,
      threadGate: state.threadGate,
      recordExists: initialData?.threadGateRecordExists ?? false,
    });
    if (write) writes.push(write);
  }

  if (state.postGate.allowQuote !== (initialData?.postGate?.allowQuote ?? true)) {
    const write = buildEditPostGateWrite({
      did,
      rkey,
      allowQuote: state.postGate.allowQuote,
      recordExists: initialData?.postGateRecordExists ?? false,
    });
    if (write) writes.push(write);
  }

  return writes;
}

async function buildSkyblurRecordValue(input: PostComposerSaveInput & { rkey: string; blurUri: string }) {
  const { state, plan, agent, apiProxyAgent } = input;
  const createdAt = input.initialData?.record?.createdAt || new Date().toISOString();

  if (plan.toStorageFormat === "password-blob") {
    const encryptBody: UkSkyblurPostEncrypt.Input = {
      body: JSON.stringify({ text: state.text, additional: state.additional }),
      password: state.password,
    };
    const response = await apiProxyAgent.post("uk.skyblur.post.encrypt", { input: encryptBody, as: "json" });
    if (!response.ok) return { ok: false as const, reason: "encrypt-failed" as const };

    const data = response.data as UkSkyblurPostEncrypt.Output;
    const arrayBuffer = await new Blob([data.body], { type: "text/plain" }).arrayBuffer();
    const blobResponse = await agent.post("com.atproto.repo.uploadBlob", {
      input: new Uint8Array(arrayBuffer),
      encoding: "binary",
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (!blobResponse.ok) return { ok: false as const, reason: "blob-upload-failed" as const };

    return {
      ok: true as const,
      value: {
        uri: `at://${input.did}/app.bsky.feed.post/${input.rkey}`,
        text: state.blurredText || state.textForBluesky,
        additional: "",
        createdAt,
        encryptBody: (blobResponse.data as any).blob,
        visibility: state.visibility,
      },
    };
  }

  if (plan.toStorageFormat === "restricted-store") {
    const storeBody: UkSkyblurPostStore.Input = {
      text: state.text,
      additional: state.additional,
      visibility: state.visibility as RestrictedVisibility,
      uri: input.blurUri as ResourceUri,
      ...(isListVisibility(state.visibility) ? { listUri: state.listUri as ResourceUri } : {}),
    };
    const response = await apiProxyAgent.post("uk.skyblur.post.store", { input: storeBody, as: "json" });
    if (!response.ok) return { ok: false as const, reason: "restricted-store-failed" as const };

    return {
      ok: true as const,
      value: {
        uri: `at://${input.did}/app.bsky.feed.post/${input.rkey}`,
        text: state.blurredText || state.textForBluesky,
        createdAt,
        visibility: state.visibility,
        ...(isListVisibility(state.visibility) ? { listUri: state.listUri } : {}),
      },
    };
  }

  return {
    ok: true as const,
    value: {
      uri: `at://${input.did}/app.bsky.feed.post/${input.rkey}`,
      text: state.textForRecord,
      additional: state.additional,
      createdAt,
      visibility: state.visibility,
    },
  };
}

export async function postComposerSave(input: PostComposerSaveInput): Promise<SaveResult> {
  const { state, plan, did, agent, apiProxyAgent, initialData } = input;
  const rkey = initialData?.blurUri?.split("/").pop() || TID.now();
  const blurUri = `at://${did}/${SKYBLUR_POST_COLLECTION}/${rkey}`;
  const mode = plan.mode;
  const writes: Write[] = [];
  let cleanupWarning: { reason: "restricted-cleanup-failed"; messageKey: string } | undefined;

  if (mode === "create") {
    writes.push({
      $type: "com.atproto.repo.applyWrites#create",
      collection: "app.bsky.feed.post",
      rkey,
      value: await buildBlueskyPostValue({ ...input, rkey, blurUri }),
    });
  }

  const recordResult = await buildSkyblurRecordValue({ ...input, rkey, blurUri });
  if (!recordResult.ok) {
    const messageKeyByReason = {
      "encrypt-failed": "PostComposer_ErrorEncryptFailed",
      "blob-upload-failed": "PostComposer_ErrorBlobUploadFailed",
      "restricted-store-failed": "PostComposer_ErrorRestrictedStoreFailed",
    } satisfies Record<typeof recordResult.reason, string>;
    return {
      status: "failed",
      reason: recordResult.reason,
      retryable: true,
      messageKey: messageKeyByReason[recordResult.reason],
    };
  }

  writes.push({
    $type: mode === "create" ? "com.atproto.repo.applyWrites#create" : "com.atproto.repo.applyWrites#update",
    collection: SKYBLUR_POST_COLLECTION,
    rkey,
    value: recordResult.value,
  });

  if (mode === "create") {
    const threadGateWrite = buildThreadGateWrite({ did, rkey, threadGate: state.threadGate, mode });
    if (threadGateWrite) writes.push(threadGateWrite);
    const postGateWrite = buildPostGateWrite({ did, rkey, allowQuote: state.postGate.allowQuote, mode });
    if (postGateWrite) writes.push(postGateWrite);
  }

  let response: Awaited<ReturnType<typeof agent.post>>;
  try {
    response = await agent.post("com.atproto.repo.applyWrites", {
      input: {
        repo: did,
        writes,
      },
    });
  } catch {
    return {
      status: "failed",
      reason: "apply-writes-failed",
      retryable: true,
      messageKey: "PostComposer_ErrorApplyWritesFailed",
    };
  }

  if (!response.ok) {
    return {
      status: "failed",
      reason: response.status === 401 || response.status === 403
        ? "unauthorized"
        : response.status === 409
          ? "conflict"
          : "apply-writes-failed",
      retryable: response.status !== 401 && response.status !== 403,
      messageKey: response.status === 401 || response.status === 403
        ? "PostComposer_ErrorUnauthorized"
        : response.status === 409
          ? "PostComposer_ErrorConflict"
          : "PostComposer_ErrorApplyWritesFailed",
    };
  }

  if (mode === "edit") {
    const gateWrites = buildEditGateWrites({ ...input, rkey });
    if (gateWrites.length > 0) {
      const gateResponse = await agent.post("com.atproto.repo.applyWrites", {
        input: {
          repo: did,
          writes: gateWrites,
        },
      });

      if (!gateResponse.ok) {
        return {
          status: "failed",
          reason: "threadgate-failed",
          retryable: gateResponse.status !== 401 && gateResponse.status !== 403,
          messageKey: "PostComposer_ErrorGateSavePartial",
        };
      }
    }
  }

  if (
    mode === "edit"
    && plan.fromVisibility
    && isRestrictedVisibility(plan.fromVisibility)
    && !isRestrictedVisibility(state.visibility)
  ) {
    try {
      const cleanupResponse = await apiProxyAgent.post("uk.skyblur.post.deleteStored", {
        input: {
          uri: blurUri as ResourceUri,
        },
      });
      if (!cleanupResponse.ok) {
        cleanupWarning = {
          reason: "restricted-cleanup-failed",
          messageKey: "PostComposer_WarningRestrictedCleanupFailed",
        };
      }
    } catch {
      cleanupWarning = {
        reason: "restricted-cleanup-failed",
        messageKey: "PostComposer_WarningRestrictedCleanupFailed",
      };
    }
  }

  return {
    status: "success",
    mode,
    planKind: plan.kind,
    blurUri,
    blurCid: (response.data as any)?.commit?.cid,
    blueskyPostUri: `at://${did}/app.bsky.feed.post/${rkey}`,
    writes: plan.writeTargets,
    ...(cleanupWarning ? { warning: cleanupWarning } : {}),
  };
}
