import { describe, expect, it } from 'vitest';

import {
  buildVisibilitySummary,
} from '../visibilitySummary';
import {
  normalizeFullWidthBrackets,
  transformPostText,
  validatePostText,
} from '../text';

describe('post composer text helpers', () => {
  it('normalizes full-width brackets before editing', () => {
    expect(normalizeFullWidthBrackets('これは［秘密］です')).toBe('これは[秘密]です');
  });

  it('flags full-width brackets before other bracket errors', () => {
    expect(validatePostText('これは［秘密です', false)).toBe('full-width-bracket');
  });

  it('flags unbalanced closing brackets', () => {
    expect(validatePostText('これは秘密]です', false)).toBe('unbalanced-bracket');
  });

  it('flags nested or unclosed brackets with the existing duplicate warning category', () => {
    expect(validatePostText('これは[秘密[です]]', false)).toBe('duplicate-or-unclosed-bracket');
    expect(validatePostText('これは[秘密です', false)).toBe('duplicate-or-unclosed-bracket');
  });

  it('keeps simple mode bracket-free for user input', () => {
    expect(validatePostText('一行目\n[二行目]', true)).toBe('bracket-in-simple-mode');
  });

  it('builds simple mode record text from the second line through the last line', () => {
    const result = transformPostText({
      text: '見出し\n秘密の本文\n続き',
      simpleMode: true,
      omitChar: '○',
    });

    expect(result.recordText).toBe('見出し\n[秘密の本文\n続き]');
    expect(result.blurredText).toBe('見出し\n○○○○○\n○○');
  });

  it('replaces bracketed content and can limit consecutive omit characters', () => {
    const result = transformPostText({
      text: 'これは[とても長い秘密]です',
      simpleMode: false,
      limitConsecutive: true,
      omitChar: '○',
    });

    expect(result.recordText).toBe('これは[とても長い秘密]です');
    expect(result.blurredText).toBe('これは○○○○○です');
  });
});

describe('post composer visibility summary', () => {
  it('summarizes public and login visibility without restricted storage', () => {
    expect(buildVisibilitySummary('public')).toMatchObject({
      storageFormat: 'public-record',
      readableBy: 'anyone',
      requiresLogin: false,
    });
    expect(buildVisibilitySummary('login')).toMatchObject({
      storageFormat: 'public-record',
      readableBy: 'logged-in-users',
      requiresLogin: true,
    });
  });

  it('uses existing restricted/list visibility predicates for storage decisions', () => {
    expect(buildVisibilitySummary('followers')).toMatchObject({
      storageFormat: 'restricted-store',
      readableBy: 'followers',
      requiresLogin: true,
    });
    expect(buildVisibilitySummary('list', 'at://did:example/app.bsky.graph.list/abc')).toMatchObject({
      storageFormat: 'restricted-store',
      readableBy: 'list-members',
      requiresList: true,
      listUri: 'at://did:example/app.bsky.graph.list/abc',
    });
  });

  it('summarizes password visibility as password blob storage', () => {
    expect(buildVisibilitySummary('password')).toMatchObject({
      storageFormat: 'password-blob',
      readableBy: 'password-holders',
      requiresPassword: true,
    });
  });
});
