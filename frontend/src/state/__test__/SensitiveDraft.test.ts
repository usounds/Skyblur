import { beforeEach, describe, expect, it, vi } from 'vitest';

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
}

describe('SensitiveDraftStore', () => {
  let memoryStorage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    vi.resetModules();
    memoryStorage = createMemoryStorage();
    vi.stubGlobal('localStorage', memoryStorage);
  });

  it('moves normal draft content into the sensitive bucket when password visibility starts', async () => {
    const { useTempPostStore } = await import('../TempPost');
    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    useTempPostStore.getState().setText('secret text');
    useTempPostStore.getState().setAdditional('secret additional');
    useTempPostStore.getState().setEncryptKey('old password');
    useTempPostStore.getState().setVisibility('password');

    expect(useTempPostStore.getState()).toMatchObject({
      text: '',
      additional: '',
      encryptKey: '',
      visibility: 'password',
    });
    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: 'secret text',
      additional: 'secret additional',
      password: 'old password',
      encryptKey: 'old password',
    });
  });

  it('keeps password visibility edits out of the normal persisted draft', async () => {
    const { useTempPostStore } = await import('../TempPost');
    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    useTempPostStore.getState().setVisibility('password');
    useTempPostStore.getState().setText('typed while password');
    useTempPostStore.getState().setAdditional('additional while password');
    useTempPostStore.getState().setEncryptKey('password while password');

    expect(useTempPostStore.getState()).toMatchObject({
      text: '',
      additional: '',
      encryptKey: 'password while password',
      visibility: 'password',
    });
    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: 'typed while password',
      additional: 'additional while password',
      password: 'password while password',
      encryptKey: 'password while password',
    });

    const normalDraft = JSON.parse(memoryStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(JSON.stringify(normalDraft)).not.toContain('typed while password');
    expect(JSON.stringify(normalDraft)).not.toContain('additional while password');
    expect(JSON.stringify(normalDraft)).not.toContain('password while password');
  });

  it('restores text/additional but discards password when leaving password visibility', async () => {
    const { useTempPostStore } = await import('../TempPost');
    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    useTempPostStore.getState().setVisibility('password');
    useTempPostStore.getState().setText('safe to move back');
    useTempPostStore.getState().setAdditional('also safe');
    useTempPostStore.getState().setEncryptKey('drop me');
    useTempPostStore.getState().setVisibility('public');

    expect(useTempPostStore.getState()).toMatchObject({
      text: 'safe to move back',
      additional: 'also safe',
      encryptKey: '',
      visibility: 'public',
    });
    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: '',
      additional: '',
      password: '',
      encryptKey: '',
    });
  });

  it('clears sensitive draft through the explicit policy API', async () => {
    const { clearSensitiveDraft, useSensitiveDraftStore } = await import('../SensitiveDraft');

    useSensitiveDraftStore.getState().setSensitiveDraft({
      text: 'secret',
      additional: 'secret additional',
      password: 'password',
      encryptKey: 'password',
    });

    clearSensitiveDraft();

    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: '',
      additional: '',
      password: '',
      encryptKey: '',
    });
  });

  it('does not expose password edit unlock transfer fields from the sensitive draft store', async () => {
    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    useSensitiveDraftStore.getState().setSensitiveDraft({
      text: 'new draft text',
      additional: 'new draft additional',
      password: 'new draft password',
    });
    const lastPersistedDraft = JSON.parse(memoryStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');

    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: 'new draft text',
      additional: 'new draft additional',
      password: 'new draft password',
    });
    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('setUnlockedPasswordPost');
    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('unlockedText');
    expect(JSON.stringify(lastPersistedDraft)).not.toContain('unlockedBlurUri');
  });

  it('ignores legacy persisted unlocked password post data during rehydration', async () => {
    memoryStorage.setItem('zustand.sensitive-post-draft', JSON.stringify({
      state: {
        text: 'new draft text',
        additional: 'new draft additional',
        password: 'new draft password',
        encryptKey: 'new draft password',
        unlockedBlurUri: 'at://did:plc:abc/uk.skyblur.post/3abc',
        unlockedText: 'legacy unlocked text',
        unlockedAdditional: 'legacy unlocked additional',
        unlockedPassword: 'legacy unlocked password',
      },
      version: 0,
    }));

    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('unlockedBlurUri');
    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('unlockedText');
    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('unlockedAdditional');
    expect(useSensitiveDraftStore.getState()).not.toHaveProperty('unlockedPassword');
    expect(JSON.stringify(useSensitiveDraftStore.getState())).not.toContain('legacy unlocked text');
    expect(JSON.stringify(useSensitiveDraftStore.getState())).not.toContain('legacy unlocked additional');
    expect(JSON.stringify(useSensitiveDraftStore.getState())).not.toContain('legacy unlocked password');
  });

  it('persists and clears the reply target alongside the local draft', async () => {
    const { useTempPostStore } = await import('../TempPost');

    useTempPostStore.getState().setReplyPost({
      uri: 'at://did:plc:abc/app.bsky.feed.post/3reply',
      cid: 'cid',
      author: {} as never,
      record: {
        text: 'reply target',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      indexedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(useTempPostStore.getState()).toMatchObject({
      reply: 'at://did:plc:abc/app.bsky.feed.post/3reply',
      replyPostSnapshot: {
        uri: 'at://did:plc:abc/app.bsky.feed.post/3reply',
        text: 'reply target',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    });

    useTempPostStore.getState().clearTempPost();

    expect(useTempPostStore.getState()).toMatchObject({
      reply: '',
      replyPostSnapshot: undefined,
    });
  });
});
