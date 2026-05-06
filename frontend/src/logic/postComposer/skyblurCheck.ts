import type {
  ComposerFixTarget,
  PostComposerState,
  SavePlan,
  SkyblurCheckSummary,
} from "@/types/postComposer";
import { buildVisibilitySummary } from "./visibilitySummary";

function buildFixTargets(state: PostComposerState): ComposerFixTarget[] {
  const targets: ComposerFixTarget[] = [];

  if (!state.text.trim()) {
    targets.push({ step: "write", field: "text", messageKey: "PostComposer_ErrorTextRequired" });
  }
  if (state.visibility === "password" && !state.password.trim()) {
    targets.push({ step: "audience", field: "password", messageKey: "PostComposer_ErrorPasswordRequired" });
  }
  if (state.visibility === "list" && !state.listUri) {
    targets.push({ step: "audience", field: "listUri", messageKey: "PostComposer_ErrorListRequired" });
  }

  return targets;
}

export function buildReplyTargetLabel(text: string | undefined) {
  const normalizedText = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedText) return undefined;

  const chars = Array.from(normalizedText);
  return chars.length > 50 ? `${chars.slice(0, 50).join("")}...` : normalizedText;
}

export function buildSkyblurCheckSummary(state: PostComposerState, savePlan: SavePlan): SkyblurCheckSummary {
  const visibilitySummary = buildVisibilitySummary(state.visibility, state.listUri);
  const replyTarget = buildReplyTargetLabel(state.replyPost?.record.text);

  return {
    blueskyText: state.textForBluesky || state.blurredText || state.text,
    skyblurText: state.textForRecord || state.text,
    additionalText: state.additional || undefined,
    replyTarget,
    audience: {
      readableBy: [visibilitySummary.readableBy],
      unreadableView: visibilitySummary.unreadableView,
      visibilityChanged: savePlan.fromVisibility !== undefined && savePlan.fromVisibility !== savePlan.toVisibility,
    },
    visibility: state.visibility,
    threadGate: state.threadGate,
    postGate: state.postGate,
    savePlan,
    fixTargets: buildFixTargets(state),
    updatesBlueskyPostBody: false,
    unsupportedFields: savePlan.mode === "edit"
      ? ["blueskyPostBody", "blueskyEmbedCard"]
      : [],
  };
}
