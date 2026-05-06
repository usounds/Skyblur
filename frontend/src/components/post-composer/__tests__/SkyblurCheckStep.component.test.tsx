// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { SkyblurCheckStep } from "../SkyblurCheckStep";
import type { SkyblurCheckSummary } from "@/types/postComposer";

vi.mock("@/state/Locale", () => ({
  useLocale: () => ({
    localeData: {
      CreatePost_OmmitChar: "*",
      PostComposer_CheckBlueskyTitle: "Bluesky",
      PostComposer_CheckEditBlueskyNotUpdated: "Bluesky body and reply target are not editable here.",
      PostComposer_CheckNoRestriction: "None",
      PostComposer_CheckPostGate: "Quote setting",
      PostComposer_CheckReadableBy: "Readable by",
      PostComposer_CheckThreadGate: "Reply restriction",
      PostComposer_CheckQuoteAllowed: "Allowed",
      PostComposer_CheckQuoteRestricted: "Restricted",
      PostComposer_CheckReadableAnyone: "Anyone",
      PostComposer_CheckReadableLoggedIn: "Logged in",
      PostComposer_CheckReadablePassword: "Password",
      PostComposer_CheckReadableFollowers: "Followers",
      PostComposer_CheckReadableFollowing: "Following",
      PostComposer_CheckReadableMutuals: "Mutuals",
      PostComposer_CheckReadableListMembers: "List members",
      PostComposer_CheckThreadGateMention: "Mentioned users",
      PostComposer_CheckThreadGateFollowing: "Following users",
      PostComposer_CheckThreadGateFollowers: "Followers",
      PostComposer_CheckReadyDecisionTitle: "Ready",
      PostComposer_CheckReadyDecisionDescription: "Ready to post",
      PostComposer_CheckFixTitle: "Fix",
      PostComposer_CheckFixDescription: "Fix required",
      PostComposer_CheckReloginTitle: "Relogin",
      PostComposer_CheckReloginDescription: "Relogin required",
      PostComposer_CheckFixRequired: "Fix required",
      PostComposer_CheckFixButton: "Fix",
      PostComposer_CheckAllowedViewerTab: "Allowed",
      PostComposer_CheckBlockedViewerTab: "Blocked",
      PostComposer_CheckSkyblurTitle: "Skyblur",
      PostComposer_ReplyTargetTitle: "Reply target",
    },
  }),
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const summary: SkyblurCheckSummary = {
  blueskyText: "Bluesky body should be hidden",
  skyblurText: "Skyblur body remains visible",
  additionalText: "Additional",
  replyTarget: "Reply target should be hidden",
  audience: {
    readableBy: ["followers"],
    unreadableView: "restricted",
    visibilityChanged: false,
  },
  visibility: "followers",
  threadGate: ["mention"],
  postGate: { allowQuote: false },
  savePlan: {
    kind: "update-same-storage",
    mode: "edit",
    fromVisibility: "followers",
    toVisibility: "followers",
    fromStorageFormat: "restricted-store",
    toStorageFormat: "restricted-store",
    threadGate: ["mention"],
    postGate: { allowQuote: false },
    editableFields: ["text", "additional", "threadGate", "postGate"],
    writeTargets: ["update-skyblur-record", "update-threadgate", "update-postgate"],
    requiresPasswordInput: false,
    requiresPasswordUnlock: false,
    updatesBlueskyPostBody: false,
  },
  fixTargets: [],
  updatesBlueskyPostBody: false,
  unsupportedFields: ["blueskyPostBody", "blueskyEmbedCard"],
};

describe("SkyblurCheckStep", () => {
  it("hides Bluesky body and reply target in edit mode", () => {
    render(
      <MantineProvider>
        <SkyblurCheckStep summary={summary} onFix={vi.fn()} />
      </MantineProvider>,
    );

    const blueskyHeading = screen.getByText("Bluesky");
    const blueskyPanel = blueskyHeading.closest("section");
    expect(blueskyPanel).not.toBeNull();

    const panel = within(blueskyPanel as HTMLElement);
    expect(panel.queryByText("Bluesky body should be hidden")).not.toBeInTheDocument();
    expect(panel.queryByText("Reply target should be hidden")).not.toBeInTheDocument();
    expect(panel.getByText("Bluesky body and reply target are not editable here.")).toBeInTheDocument();
  });
});
