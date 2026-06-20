"use client";

import { AuthenticationTitle } from "@/components/login/Login";
import PageLoading from "@/components/PageLoading";
import { ScopeReloginNotice } from "@/components/ScopeReloginNotice";
import { ShareActions } from "@/components/share/ShareActions";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Alert, Button, Group, Modal, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { EditPostLoader } from "./EditPostLoader";
import { PostComposerScreen } from "./PostComposerScreen";
import { WriteStep } from "./WriteStep";
import { AudienceStep } from "./AudienceStep";
import { SkyblurCheckStep } from "./SkyblurCheckStep";
import { buildPostComposerSavePlan, postComposerSave } from "@/logic/postComposer/save";
import { buildSkyblurCheckSummary } from "@/logic/postComposer/skyblurCheck";
import { useComposerLocaleSwitchGuardStore } from "@/state/ComposerLocaleSwitchGuard";
import { clearSensitiveDraft, useSensitiveDraftStore } from "@/state/SensitiveDraft";
import { fromReplyPostSnapshot, useTempPostStore } from "@/state/TempPost";
import { useRouter } from "next/navigation";
import type { PostComposerInitialData, PostComposerState, SavePlan } from "@/types/postComposer";
import { VISIBILITY_LIST, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC, type PostView, type VisibilityValue } from "@/types/types";
import type { ResourceUri } from "@atcute/lexicons/syntax";

type PostComposerRouteScaffoldProps = {
  mode: "create" | "edit";
  didParam?: string;
  rkeyParam?: string;
  initialEditData?: PostComposerInitialData;
  onExit?: () => void;
};

const activeCreateSessionKey = "skyblur.post-composer.active-create-session";

type PostedShareState = {
  path: string;
  url: string;
  text: string;
};

function hasActiveCreateSession() {
  return typeof window !== "undefined" && window.sessionStorage.getItem(activeCreateSessionKey) === "1";
}

function setActiveCreateSession(active: boolean) {
  if (typeof window === "undefined") return;
  if (active) {
    window.sessionStorage.setItem(activeCreateSessionKey, "1");
  } else {
    window.sessionStorage.removeItem(activeCreateSessionKey);
  }
}

function safeDecode(value?: string) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function buildPostPath(did: string, blurUri: string) {
  const rkey = blurUri.split("/").pop() || "";
  return `/post/${did}/${rkey}`;
}

function syncCreateDraft(state: PostComposerState) {
  setActiveCreateSession(true);

  const tempPost = useTempPostStore.getState();

  tempPost.setVisibility(state.visibility);
  tempPost.setSimpleMode(state.simpleMode);
  tempPost.setLimitConsecutive(state.limitConsecutive);
  tempPost.setListUri(state.visibility === VISIBILITY_LIST ? state.listUri : undefined);
  tempPost.setText(state.text);
  tempPost.setAdditional(state.additional);
  tempPost.setEncryptKey(state.visibility === VISIBILITY_PASSWORD ? state.password : "");
  tempPost.setReply(state.replyPost?.uri ?? "");
  tempPost.setReplyPost(state.replyPost);
}

export function PostComposerRouteScaffold({ mode, didParam, rkeyParam, initialEditData, onExit }: PostComposerRouteScaffoldProps) {
  const { localeData: locale } = useLocale();
  const router = useRouter();
  const setHasUnsavedComposerChanges = useComposerLocaleSwitchGuardStore((state) => state.setHasUnsavedComposerChanges);
  const did = useXrpcAgentStore((state) => state.did);
  const agent = useXrpcAgentStore((state) => state.agent);
  const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
  const serviceUrl = useXrpcAgentStore((state) => state.serviceUrl);
  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
  const missingScopes = useXrpcAgentStore((state) => state.missingAppBskyRpcScopes);
  const clearTempPost = useTempPostStore((state) => state.clearTempPost);
  const tempText = useTempPostStore((state) => state.text);
  const tempAdditional = useTempPostStore((state) => state.additional);
  const tempSimpleMode = useTempPostStore((state) => state.simpleMode);
  const tempVisibility = useTempPostStore((state) => state.visibility);
  const tempListUri = useTempPostStore((state) => state.listUri);
  const tempLimitConsecutive = useTempPostStore((state) => state.limitConsecutive);
  const tempReply = useTempPostStore((state) => state.reply);
  const tempReplyPostSnapshot = useTempPostStore((state) => state.replyPostSnapshot);
  const sensitiveText = useSensitiveDraftStore((state) => state.text);
  const sensitiveAdditional = useSensitiveDraftStore((state) => state.additional);
  const sensitivePassword = useSensitiveDraftStore((state) => state.password || state.encryptKey);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [restorePostData, setRestorePostData] = useState(false);
  const initialRestoreDecision = mode === "create" && hasActiveCreateSession() ? "fresh" : "pending";
  const [restoreDecision, setRestoreDecision] = useState<"pending" | "restored" | "fresh">(initialRestoreDecision);
  const restoreDecisionRef = useRef<"pending" | "restored" | "fresh">(initialRestoreDecision);
  const suppressCreateDraftSyncRef = useRef(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(mode !== "create");
  const [initialCreateDraft, setInitialCreateDraft] = useState<PostComposerInitialData | null>(null);
  const [restoredReplyPost, setRestoredReplyPost] = useState<PostView | undefined>();
  const [isTempReplyResolved, setIsTempReplyResolved] = useState(mode !== "create");
  const [restoreReplyWarning, setRestoreReplyWarning] = useState("");
  const [postedShare, setPostedShare] = useState<PostedShareState | null>(null);

  const routeDid = useMemo(() => safeDecode(didParam), [didParam]);
  const commitRestoreDecision = useCallback((decision: "pending" | "restored" | "fresh") => {
    restoreDecisionRef.current = decision;
    if (mode === "create" && decision !== "pending") setActiveCreateSession(true);
    setRestoreDecision(decision);
  }, [mode]);
  const exitToConsole = useCallback(() => {
    setActiveCreateSession(false);
    setHasUnsavedComposerChanges(false);
    if (onExit) {
      onExit();
      return;
    }
    if (mode === "create") {
      router.back();
      return;
    }
    router.push("/console");
  }, [mode, onExit, router, setHasUnsavedComposerChanges]);
  const completeToConsole = useCallback(() => {
    setActiveCreateSession(false);
    setHasUnsavedComposerChanges(false);
    if (onExit) {
      onExit();
    }
    router.push("/console");
  }, [onExit, router, setHasUnsavedComposerChanges]);
  useEffect(() => {
    return () => {
      suppressCreateDraftSyncRef.current = false;
      setHasUnsavedComposerChanges(false);
    };
  }, [setHasUnsavedComposerChanges]);
  const routeRkey = useMemo(() => safeDecode(rkeyParam), [rkeyParam]);
  const hasInlineEditData = mode === "edit" && !!initialEditData;
  const hasInvalidEditParams = mode === "edit" && !hasInlineEditData && (!routeDid || !routeRkey);
  const isDifferentAccount = mode === "edit" && !hasInlineEditData && !!routeDid && !!did && routeDid !== did;
  const createInitialData = useMemo<PostComposerInitialData>(() => {
    const visibility = (tempVisibility ?? VISIBILITY_PUBLIC) as VisibilityValue;
    const isPassword = visibility === VISIBILITY_PASSWORD;

    return {
      mode: "create",
      authorDid: did,
      text: isPassword ? sensitiveText : tempText,
      additional: isPassword ? sensitiveAdditional : tempAdditional,
      password: isPassword ? sensitivePassword : "",
      simpleMode: tempSimpleMode,
      limitConsecutive: tempLimitConsecutive,
      visibility,
      listUri: visibility === VISIBILITY_LIST ? tempListUri : undefined,
      replyPost: restoredReplyPost ?? fromReplyPostSnapshot(tempReplyPostSnapshot),
      passwordUnlocked: false,
      ...(isPassword ? { originalStorageFormat: "password-blob" as const } : {}),
    };
  }, [
    did,
    sensitiveAdditional,
    sensitiveText,
    tempAdditional,
    tempLimitConsecutive,
    tempListUri,
    tempSimpleMode,
    tempText,
    tempVisibility,
    sensitivePassword,
    restoredReplyPost,
    tempReplyPostSnapshot,
  ]);
  const hasCreateDraft = mode === "create" && !!(
    tempText
    || tempAdditional
    || tempReply
    || (tempVisibility === VISIBILITY_PASSWORD && (sensitiveText || sensitiveAdditional || sensitivePassword))
  );
  const emptyCreateInitialData = useMemo<PostComposerInitialData>(() => ({
    mode: "create",
    authorDid: did,
    text: "",
    additional: "",
    password: "",
    simpleMode: false,
    limitConsecutive: false,
    visibility: VISIBILITY_PUBLIC as VisibilityValue,
    passwordUnlocked: false,
	  }), [did]);
  const shouldUsePersistedCreateDraft = restoreDecision === "restored" || (initialRestoreDecision === "fresh" && hasCreateDraft);
  const activeCreateInitialData = shouldUsePersistedCreateDraft ? createInitialData : emptyCreateInitialData;

  useEffect(() => {
    if (mode !== "create") return;
    if (!isDraftHydrated || isAuthenticated !== true) return;

    if (tempReplyPostSnapshot) {
      setRestoredReplyPost(fromReplyPostSnapshot(tempReplyPostSnapshot));
      setRestoreReplyWarning("");
      setIsTempReplyResolved(true);
      return;
    }

    if (!tempReply) {
      setRestoredReplyPost(undefined);
      setRestoreReplyWarning("");
      setIsTempReplyResolved(true);
      return;
    }

    if (!did || !agent || !tempReply.includes(did)) {
      setRestoredReplyPost(undefined);
      setRestoreReplyWarning(locale.PostComposer_RestoreReplyFailed);
      setIsTempReplyResolved(true);
      return;
    }

    let isActive = true;
    setIsTempReplyResolved(false);

    void agent.get("app.bsky.feed.getPosts", {
      params: {
        uris: [tempReply as ResourceUri],
      },
    }).then((result) => {
      if (!isActive) return;
      const post = result.ok ? result.data?.posts?.[0] : undefined;
      setRestoredReplyPost(post as PostView | undefined);
      setRestoreReplyWarning(post ? "" : locale.PostComposer_RestoreReplyFailed);
      setIsTempReplyResolved(true);
    }).catch(() => {
      if (!isActive) return;
      setRestoredReplyPost(undefined);
      setRestoreReplyWarning(locale.PostComposer_RestoreReplyFailed);
      setIsTempReplyResolved(true);
    });

    return () => {
      isActive = false;
    };
  }, [agent, did, isAuthenticated, isDraftHydrated, locale.PostComposer_RestoreReplyFailed, mode, tempReply, tempReplyPostSnapshot]);

  useEffect(() => {
    if (mode !== "create") return;

    const tempPersist = (useTempPostStore as any).persist;
    const sensitivePersist = (useSensitiveDraftStore as any).persist;
    const isHydrated = () => {
      return (tempPersist?.hasHydrated?.() ?? true) && (sensitivePersist?.hasHydrated?.() ?? true);
    };

    if (isHydrated()) {
      setIsDraftHydrated(true);
      return;
    }

    const unsubscribers = [
      tempPersist?.onFinishHydration?.(() => {
        if (isHydrated()) setIsDraftHydrated(true);
      }),
      sensitivePersist?.onFinishHydration?.(() => {
        if (isHydrated()) setIsDraftHydrated(true);
      }),
    ].filter(Boolean);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "create" || isAuthenticated !== true || !isDraftHydrated || restoreDecisionRef.current !== "pending") return;

	    if (!hasCreateDraft) {
	      commitRestoreDecision("fresh");
	      return;
	    }

	    if (tempReply && !isTempReplyResolved) return;

	    setInitialCreateDraft(createInitialData);
	    setRestorePostData(true);
	  }, [commitRestoreDecision, createInitialData, hasCreateDraft, isAuthenticated, isDraftHydrated, isTempReplyResolved, mode, tempReply]);

  useEffect(() => {
    const currentState = useXrpcAgentStore.getState();

    if (isSessionChecked || currentState.isSessionChecked) {
      setIsAuthenticated(!!currentState.did);
      return;
    }

    if (did && serviceUrl) {
      setIsAuthenticated(true);
      return;
    }

    let isActive = true;

    void useXrpcAgentStore.getState().checkSession().then((result) => {
      if (isActive) setIsAuthenticated(result.authenticated);
    });

    return () => {
      isActive = false;
    };
  }, [did, isSessionChecked, serviceUrl]);

  useEffect(() => {
    if (isAuthenticated === true && !did) {
      setIsAuthenticated(false);
    }
  }, [did, isAuthenticated]);

  if (isAuthenticated === null) {
    return <PageLoading />;
  }

  if (isAuthenticated === false) {
    return (
      <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12 flex flex-col items-center">
        <main className="w-full">
          <AuthenticationTitle />
        </main>
      </div>
    );
  }

  if (mode === "create" && (!isDraftHydrated || restoreDecision === "pending")) {
    return (
      <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12">
        <main className="w-full">
          <ScopeReloginNotice compact />
          <PageLoading />
          <Modal
            opened={restorePostData}
            onClose={() => {
              setRestorePostData(false);
            }}
            closeOnClickOutside={false}
            closeOnEscape={false}
            withCloseButton={false}
            title={locale.CreatePost_RestoreTitle}
            centered
          >
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {initialCreateDraft?.text ?? ""}
            </Text>
            {restoreReplyWarning && (
              <Alert icon={<AlertTriangle size={16} />} color="yellow" variant="light" mt="md">
                {restoreReplyWarning}
              </Alert>
            )}
            <Group mt="md" justify="flex-end">
              <Button
                variant="default"
                color="gray"
                onClick={() => {
                  setRestorePostData(false);
                  exitToConsole();
                }}
              >
                {locale.DeleteList_CancelButton}
              </Button>
              <Button
                variant="filled"
                color="red"
                onClick={() => {
                  clearTempPost();
                  setRestorePostData(false);
                  commitRestoreDecision("fresh");
                }}
              >
                {locale.DeleteList_DeleteButton}
              </Button>
              <Button
                variant="filled"
                onClick={() => {
                  setRestorePostData(false);
                  commitRestoreDecision("restored");
                }}
              >
                {locale.CreatePost_RestoreButton}
              </Button>
            </Group>
          </Modal>
        </main>
      </div>
    );
  }

  const renderComposer = (initialData?: PostComposerInitialData) => (
      <PostComposerScreen
      key={mode === "create" ? restoreDecision : initialData?.blurUri}
      initialData={initialData ?? activeCreateInitialData}
      onBack={exitToConsole}
      onStateChange={(state) => {
        if (mode === "create" && suppressCreateDraftSyncRef.current) {
          return;
        }
        setHasUnsavedComposerChanges(state.dirty);
        if (mode === "create") {
          syncCreateDraft(state);
        }
      }}
      requiresRelogin={missingScopes.length > 0}
      onSubmit={async (state, plan) => {
        const result = await postComposerSave({ state, plan, did, agent, apiProxyAgent, locale, initialData });
        if (result.status === "success") {
          suppressCreateDraftSyncRef.current = true;
          clearSensitiveDraft();
          clearTempPost();
          setActiveCreateSession(false);
          setHasUnsavedComposerChanges(false);
          if (mode === "create" && state.showShareAfterPost) {
            const path = buildPostPath(did, result.blurUri);
            setPostedShare({
              path,
              url: result.skyblurUrl ?? `${window.location.origin}${path}`,
              text: state.textForBluesky || state.blurredText,
            });
            return result;
          }
          completeToConsole();
        }
        return result;
      }}
      renderStep={({ state, setState, goToStep, stepError, stepErrorMessage }) => {
        if (state.step === "write") return <WriteStep state={state} setState={setState} stepError={stepError} stepErrorMessage={stepErrorMessage} />;
        if (state.step === "audience") return (
          <AudienceStep
            state={state}
            setState={setState}
            initialData={initialData}
            stepError={stepError}
            stepErrorMessage={stepErrorMessage}
          />
        );

        const planResult = buildPostComposerSavePlan(state, initialData);
        if ("error" in planResult) {
          return null;
        }
        return (
          <SkyblurCheckStep
            summary={buildSkyblurCheckSummary(state, planResult as SavePlan)}
            requiresRelogin={missingScopes.length > 0}
            showShareAfterPost={state.showShareAfterPost}
            onShowShareAfterPostChange={(checked) => setState({ showShareAfterPost: checked, dirty: state.dirty })}
            onFix={(target) => goToStep(target.step)}
          />
        );
      }}
    />
  );

  return (
    <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12">
      <main className="w-full">
        <ScopeReloginNotice compact />

        {hasInvalidEditParams || isDifferentAccount ? (
          <Alert icon={<AlertTriangle size={18} />} color="red" variant="light">
            {hasInvalidEditParams
              ? locale.PostComposer_LoadErrorInvalidRoute
              : locale.PostComposer_LoadErrorDifferentAccount}
          </Alert>
        ) : initialEditData ? (
          renderComposer(initialEditData)
        ) : mode === "edit" ? (
          <EditPostLoader did={routeDid} rkey={routeRkey} onBack={exitToConsole}>
            {(initialData) => renderComposer(initialData)}
          </EditPostLoader>
        ) : (
          renderComposer()
        )}
      </main>
      <Modal
        opened={!!postedShare}
        onClose={completeToConsole}
        centered
        radius="lg"
        size="md"
      >
        {postedShare && (
          <Stack gap="lg">
            <Stack align="center" gap="xs">
              <ThemeIcon size={52} radius="xl" variant="light" color="blue">
                <Check size={28} strokeWidth={2.5} />
              </ThemeIcon>
              <Text size="xl" fw={700}>{locale.Share_PostedTitle}</Text>
              <Text size="sm" c="dimmed" ta="center">{locale.Share_PostedDescription}</Text>
            </Stack>
            <Paper p="md" radius="md" bg="var(--mantine-color-default-hover)">
              <Text size="sm" lineClamp={3}>{postedShare.text || locale.Share_DefaultText}</Text>
            </Paper>
            <ShareActions url={postedShare.url} text={postedShare.text} fallbackText={locale.Share_DefaultText} title={locale.Common_Title} />
            <Group justify="center" gap="xs">
              <Button variant="subtle" onClick={() => router.push(postedShare.path)}>
                {locale.Share_OpenSkyblur}
              </Button>
              <Button variant="subtle" color="gray" onClick={completeToConsole}>
                {locale.Share_BackToConsole}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
