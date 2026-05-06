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

  it('stores an unlocked password post separately from the new-post password draft', async () => {
    const { useSensitiveDraftStore } = await import('../SensitiveDraft');

    useSensitiveDraftStore.getState().setSensitiveDraft({
      text: 'new draft text',
      additional: 'new draft additional',
      password: 'new draft password',
    });
    useSensitiveDraftStore.getState().setUnlockedPasswordPost({
      blurUri: 'at://did:plc:abc/uk.skyblur.post/3abc',
      text: 'already unlocked text',
      additional: 'already unlocked additional',
      password: 'already unlocked password',
    });

    expect(useSensitiveDraftStore.getState()).toMatchObject({
      text: 'new draft text',
      additional: 'new draft additional',
      password: 'new draft password',
      unlockedBlurUri: 'at://did:plc:abc/uk.skyblur.post/3abc',
      unlockedText: 'already unlocked text',
      unlockedAdditional: 'already unlocked additional',
      unlockedPassword: 'already unlocked password',
    });
  });
});
