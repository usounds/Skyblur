import { isListVisibility, isRestrictedVisibility } from '../listVisibility';
import type { ComposerStorageFormat, RestrictedVisibility } from '../../types/postComposer';
import type { VisibilityValue } from '../../types/types';

export type VisibilitySummary = {
  visibility: VisibilityValue;
  storageFormat: ComposerStorageFormat;
  readableBy:
    | 'anyone'
    | 'logged-in-users'
    | 'password-holders'
    | 'followers'
    | 'following'
    | 'mutuals'
    | 'list-members';
  unreadableView: 'full-text' | 'login-required' | 'password-required' | 'restricted';
  requiresLogin: boolean;
  requiresPassword: boolean;
  requiresList: boolean;
  listUri?: string;
};

export function getComposerStorageFormat(visibility: VisibilityValue): ComposerStorageFormat {
  if (visibility === 'password') return 'password-blob';
  if (isRestrictedVisibility(visibility)) return 'restricted-store';
  return 'public-record';
}

export function buildVisibilitySummary(visibility: VisibilityValue, listUri?: string): VisibilitySummary {
  const storageFormat = getComposerStorageFormat(visibility);
  const requiresList = isListVisibility(visibility);

  if (visibility === 'public') {
    return {
      visibility,
      storageFormat,
      readableBy: 'anyone',
      unreadableView: 'full-text',
      requiresLogin: false,
      requiresPassword: false,
      requiresList,
      listUri,
    };
  }

  if (visibility === 'login') {
    return {
      visibility,
      storageFormat,
      readableBy: 'logged-in-users',
      unreadableView: 'login-required',
      requiresLogin: true,
      requiresPassword: false,
      requiresList,
      listUri,
    };
  }

  if (visibility === 'password') {
    return {
      visibility,
      storageFormat,
      readableBy: 'password-holders',
      unreadableView: 'password-required',
      requiresLogin: false,
      requiresPassword: true,
      requiresList,
      listUri,
    };
  }

  const restrictedAudience: Record<RestrictedVisibility, VisibilitySummary['readableBy']> = {
    followers: 'followers',
    following: 'following',
    mutual: 'mutuals',
    list: 'list-members',
  };

  return {
    visibility,
    storageFormat,
    readableBy: restrictedAudience[visibility],
    unreadableView: 'restricted',
    requiresLogin: true,
    requiresPassword: false,
    requiresList,
    listUri,
  };
}
