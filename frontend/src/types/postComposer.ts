import type { UkSkyblurPost } from '@/lexicon/UkSkyblur';

import type { PostView, ThreadGateValue, VisibilityValue } from './types';

export type ComposerStep = 'write' | 'audience' | 'check';

export type PostComposerMode = 'create' | 'edit';

export type PublicRecordVisibility = 'public' | 'login';

export type PasswordVisibility = 'password';

export type RestrictedVisibility = 'followers' | 'following' | 'mutual' | 'list';

export type ComposerStorageFormat =
    | 'public-record'
    | 'password-blob'
    | 'restricted-store';

export type PostGateState = {
    allowQuote: boolean;
};

export type PostComposerState = {
    mode: PostComposerMode;
    step: ComposerStep;
    text: string;
    textForRecord: string;
    textForBluesky: string;
    blurredText: string;
    additional: string;
    simpleMode: boolean;
    limitConsecutive: boolean;
    visibility: VisibilityValue;
    password: string;
    listUri?: string;
    replyPost?: PostView;
    threadGate: ThreadGateValue[];
    postGate: PostGateState;
    dirty: boolean;
    submitting: boolean;
};

export type PostComposerInitialData = {
    mode: PostComposerMode;
    authorDid: string;
    originalVisibility?: VisibilityValue;
    originalStorageFormat?: ComposerStorageFormat;
    blurUri?: string;
    blurCid?: string;
    blueskyPostUri?: string;
    blueskyPostCid?: string;
    record?: UkSkyblurPost.Record;
    text?: string;
    additional?: string;
    password?: string;
    simpleMode?: boolean;
    limitConsecutive?: boolean;
    visibility?: VisibilityValue;
    listUri?: string;
    replyPost?: PostView;
    threadGate?: ThreadGateValue[];
    postGate?: PostGateState;
    threadGateRecordExists?: boolean;
    postGateRecordExists?: boolean;
    gateControlsEditable?: boolean;
    passwordUnlocked?: boolean;
};

export type SameStorageEditableField =
    | 'text'
    | 'additional'
    | 'simpleMode'
    | 'limitConsecutive'
    | 'listUri'
    | 'threadGate'
    | 'postGate';

export type OutOfMvpEditableField =
    | 'blueskyPostBody'
    | 'blueskyEmbedCard'
    | 'storageVisibilityMigration';

export type SavePlanWriteTarget =
    | 'create-bluesky-post'
    | 'create-skyblur-record'
    | 'update-skyblur-record'
    | 'create-threadgate'
    | 'update-threadgate'
    | 'create-postgate'
    | 'update-postgate'
    | 'upload-password-blob'
    | 'store-restricted-content';

type SavePlanBase = {
    mode: PostComposerMode;
    fromVisibility?: VisibilityValue;
    toVisibility: VisibilityValue;
    fromStorageFormat?: ComposerStorageFormat;
    toStorageFormat: ComposerStorageFormat;
    threadGate: ThreadGateValue[];
    postGate: PostGateState;
    editableFields: SameStorageEditableField[];
    writeTargets: SavePlanWriteTarget[];
    requiresPasswordInput: boolean;
    requiresPasswordUnlock: boolean;
    updatesBlueskyPostBody: false;
};

export type CreatePublicSavePlan = SavePlanBase & {
    kind: 'create-public';
    mode: 'create';
    toVisibility: PublicRecordVisibility;
    toStorageFormat: 'public-record';
    requiresPasswordInput: false;
    requiresPasswordUnlock: false;
};

export type CreatePasswordSavePlan = SavePlanBase & {
    kind: 'create-password';
    mode: 'create';
    toVisibility: PasswordVisibility;
    toStorageFormat: 'password-blob';
    requiresPasswordInput: true;
    requiresPasswordUnlock: false;
};

export type CreateRestrictedSavePlan = SavePlanBase & {
    kind: 'create-restricted';
    mode: 'create';
    toVisibility: RestrictedVisibility;
    toStorageFormat: 'restricted-store';
    requiresPasswordInput: false;
    requiresPasswordUnlock: false;
};

export type UpdateSameStorageSavePlan = SavePlanBase & {
    kind: 'update-same-storage';
    mode: 'edit';
    fromVisibility: VisibilityValue;
    fromStorageFormat: ComposerStorageFormat;
    requiresPasswordUnlock: boolean;
};

export type SavePlan =
    | CreatePublicSavePlan
    | CreatePasswordSavePlan
    | CreateRestrictedSavePlan
    | UpdateSameStorageSavePlan;

export type SaveFailureReason =
    | 'validation'
    | 'password-required'
    | 'password-unlock-required'
    | 'encrypt-failed'
    | 'blob-upload-failed'
    | 'restricted-store-failed'
    | 'apply-writes-failed'
    | 'threadgate-failed'
    | 'postgate-failed'
    | 'conflict'
    | 'unauthorized'
    | 'unsupported-storage-change';

export type SaveWarningReason =
    | 'restricted-cleanup-failed';

export type SaveResult =
    | {
        status: 'success';
        mode: PostComposerMode;
        planKind: SavePlan['kind'];
        blurUri: string;
        blurCid?: string;
        blueskyPostUri?: string;
        writes: SavePlanWriteTarget[];
        warning?: {
            reason: SaveWarningReason;
            messageKey: string;
        };
    }
    | {
        status: 'failed';
        reason: SaveFailureReason;
        retryable: boolean;
        messageKey?: string;
        fixTarget?: ComposerFixTarget;
    };

export type ComposerFixField =
    | 'text'
    | 'additional'
    | 'visibility'
    | 'password'
    | 'listUri'
    | 'replyPost'
    | 'threadGate'
    | 'postGate'
    | 'savePlan';

export type ComposerFixTarget = {
    step: ComposerStep;
    field: ComposerFixField;
    messageKey?: string;
};

export type SkyblurCheckAudienceSummary = {
    readableBy: string[];
    unreadableView: string;
    visibilityChanged: boolean;
};

export type SkyblurCheckSummary = {
    blueskyText: string;
    skyblurText: string;
    additionalText?: string;
    replyTarget?: string;
    audience: SkyblurCheckAudienceSummary;
    visibility: VisibilityValue;
    threadGate: ThreadGateValue[];
    postGate: PostGateState;
    savePlan: SavePlan;
    fixTargets: ComposerFixTarget[];
    updatesBlueskyPostBody: false;
    unsupportedFields: OutOfMvpEditableField[];
};
