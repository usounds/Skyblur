"use client";

import { AuthenticationTitle } from "@/components/login/Login";
import PageLoading from "@/components/PageLoading";
import { ScopeReloginNotice } from "@/components/ScopeReloginNotice";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Alert, Button, Group, Modal, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { EditPostLoader } from "./EditPostLoader";
import { PostComposerScreen } from "./PostComposerScreen";
import { WriteStep } from "./WriteStep";
import { AudienceStep } from "./AudienceStep";
import { SkyblurCheckStep } from "./SkyblurCheckStep";
import { buildPostComposerSavePlan, postComposerSave } from "@/logic/postComposer/save";
import { buildSkyblurCheckSummary } from "@/logic/postComposer/skyblurCheck";
import { useComposerLocaleSwitchGuardStore } from "@/state/ComposerLocaleSwitchGuard";
import { clearSensitiveDraft, useSensitiveDraftStore } from "@/state/SensitiveDraft";
import { useTempPostStore } from "@/state/TempPost";
import { useRouter } from "next/navigation";
import type { PostComposerInitialData, PostComposerState, SavePlan } from "@/types/postComposer";
import { VISIBILITY_LIST, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC, type PostView, type VisibilityValue } from "@/types/types";
import type { ResourceUri } from "@atcute/lexicons/syntax";

type PostComposerRouteScaffoldProps = {
  mode: "create" | "edit";
  didParam?: string;
  rkeyParam?: string;
};

const activeCreateSessionKey = "skyblur.post-composer.active-create-session";

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
}

export function PostComposerRouteScaffold({ mode, didParam, rkeyParam }: PostComposerRouteScaffoldProps) {
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
  const sensitiveText = useSensitiveDraftStore((state) => state.text);
  const sensitiveAdditional = useSensitiveDraftStore((state) => state.additional);
  const sensitivePassword = useSensitiveDraftStore((state) => state.password || state.encryptKey);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [restorePostData, setRestorePostData] = useState(false);
  const initialRestoreDecision = mode === "create" && hasActiveCreateSession() ? "fresh" : "pending";
  const [restoreDecision, setRestoreDecision] = useState<"pending" | "restored" | "fresh">(initialRestoreDecision);
  const restoreDecisionRef = useRef<"pending" | "restored" | "fresh">(initialRestoreDecision);
  const [isDraftHydrated, setIsDraftHydrated] = useState(mode !== "create");
  const [initialCreateDraft, setInitialCreateDraft] = useState<PostComposerInitialData | null>(null);
  const [restoredReplyPost, setRestoredReplyPost] = useState<PostView | undefined>();
  const [isTempReplyResolved, setIsTempReplyResolved] = useState(mode !== "create");
  const [restoreReplyWarning, setRestoreReplyWarning] = useState("");

  const routeDid = useMemo(() => safeDecode(didParam), [didParam]);
  const commitRestoreDecision = useCallback((decision: "pending" | "restored" | "fresh") => {
    restoreDecisionRef.current = decision;
    if (mode === "create" && decision !== "pending") setActiveCreateSession(true);
    setRestoreDecision(decision);
  }, [mode]);
  const exitToConsole = useCallback(() => {
    setActiveCreateSession(false);
    setHasUnsavedComposerChanges(false);
    router.push("/console");
  }, [router, setHasUnsavedComposerChanges]);
  useEffect(() => {
    return () => {
      setHasUnsavedComposerChanges(false);
    };
  }, [setHasUnsavedComposerChanges]);
  const routeRkey = useMemo(() => safeDecode(rkeyParam), [rkeyParam]);
  const hasInvalidEditParams = mode === "edit" && (!routeDid || !routeRkey);
  const isDifferentAccount = mode === "edit" && !!routeDid && !!did && routeDid !== did;
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
      replyPost: restoredReplyPost,
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
  const activeCreateInitialData = shouldUsePersistedCreateDraft ? (initialCreateDraft ?? createInitialData) : emptyCreateInitialData;

	  useEffect(() => {
	    if (mode !== "create") return;
	    if (!isDraftHydrated || isAuthenticated !== true) return;

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
	  }, [agent, did, isAuthenticated, isDraftHydrated, locale.PostComposer_RestoreReplyFailed, mode, tempReply]);

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
              commitRestoreDecision("fresh");
            }}
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
                  commitRestoreDecision("fresh");
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
        setHasUnsavedComposerChanges(state.dirty);
        if (mode === "create") {
          syncCreateDraft(state);
        }
      }}
      requiresRelogin={missingScopes.length > 0}
      onSubmit={async (state, plan) => {
        const result = await postComposerSave({ state, plan, did, agent, apiProxyAgent, locale, initialData });
        if (result.status === "success") {
          clearSensitiveDraft();
          clearTempPost();
          setHasUnsavedComposerChanges(false);
          exitToConsole();
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
        ) : mode === "edit" ? (
          <EditPostLoader did={routeDid} rkey={routeRkey}>
            {(initialData) => renderComposer(initialData)}
          </EditPostLoader>
        ) : (
          renderComposer()
        )}
      </main>
    </div>
  );
}
