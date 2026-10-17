import { randomUUID } from 'node:crypto';
import { signDid, verifySignedSession, verifyLegacySignedDid, type SignedBrowserSession } from './cookies';
import { DynamoOAuthStore, requestOAuthLock } from './dynamo-store';
import { SESSION_TTL_SECONDS } from './constants';

type Account = { generation: string; legacyAllowed: boolean };
type StoredSession = SignedBrowserSession & { generation: string };
export type BrowserSession = SignedBrowserSession & { replacementCookie?: string };
const accounts = new DynamoOAuthStore<string, Account>('browser-account');
const migration = new DynamoOAuthStore<string, { expiresAt: number }>('browser-account');
const sessions = new DynamoOAuthStore<string, StoredSession>('browser-session');

function parseCookie(raw: string | undefined | null) {
  try {
    const value = raw ? decodeURIComponent(raw) : raw;
    return { current: verifySignedSession(value), legacyDid: verifyLegacySignedDid(value) };
  } catch {
    return { current: null, legacyDid: null };
  }
}

async function legacyDeadline() {
  // One rollout-wide deadline, never a sliding per-user migration window.
  const existing = await migration.get('migration:v1');
  if (existing) return existing.expiresAt;
  return requestOAuthLock('browser-migration:v1', async () => {
    let policy = await migration.get('migration:v1');
    if (!policy) {
      policy = { expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
      if (!await migration.setIfOwner('migration:v1', policy, 'migration:v1')) {
        policy = await migration.get('migration:v1');
        if (!policy) throw new Error('Migration policy unavailable');
      }
    }
    return policy.expiresAt;
  });
}

async function ensureAccount(did: string): Promise<Account> {
  let account = await accounts.get(did);
  if (!account) {
    account = { generation: randomUUID(), legacyAllowed: true };
    if (!await accounts.setIfOwner(did, account, account.generation)) {
      account = await accounts.get(did);
      if (!account) throw new Error('Browser account unavailable');
    }
  }
  return account;
}

async function createSession(did: string, account: Account): Promise<BrowserSession> {
  const session: StoredSession = {
    did, sessionId: randomUUID(), generation: account.generation,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const replacementCookie = signDid(did, session.sessionId, session.expiresAt);
  await sessions.set(session.sessionId, session, session.sessionId);
  return { ...session, replacementCookie };
}

async function checkCurrent(cookie: SignedBrowserSession): Promise<BrowserSession | null> {
  const stored = await sessions.get(cookie.sessionId);
  if (!stored || stored.did !== cookie.did || stored.sessionId !== cookie.sessionId
      || stored.expiresAt !== cookie.expiresAt) return null;
  const account = await accounts.get(cookie.did);
  return account?.generation === stored.generation ? cookie : null;
}

export async function getBrowserSession(
  raw: string | undefined | null,
  restoreLegacy?: (did: string) => Promise<unknown>,
  migrateLegacy = false,
): Promise<BrowserSession | null> {
  const { current, legacyDid } = parseCookie(raw);
  if (current) return checkCurrent(current);
  if (!legacyDid || !restoreLegacy) return null;
  const deadline = await legacyDeadline();
  if (deadline <= Math.floor(Date.now() / 1000)) return null;
  // A signature alone cannot migrate a deleted/revoked OAuth grant.
  try { await restoreLegacy(legacyDid); } catch { return null; }
  return requestOAuthLock(`browser-session:${legacyDid}`, async () => {
    const account = await ensureAccount(legacyDid);
    if (!account.legacyAllowed) return null;
    if (migrateLegacy) return createSession(legacyDid, account);
    return { did: legacyDid, sessionId: 'legacy', expiresAt: deadline };
  });
}

export async function issueBrowserSession(did: string, assertOAuthSession?: () => Promise<unknown>) {
  await legacyDeadline();
  return requestOAuthLock(`browser-session:${did}`, async () => {
    if (assertOAuthSession) await assertOAuthSession();
    const session = await createSession(did, await ensureAccount(did));
    return session.replacementCookie!;
  });
}

export async function revokeBrowserSession(
  raw: string | undefined | null,
  revokeOAuth?: (did: string) => Promise<void>,
  restoreLegacy?: (did: string) => Promise<unknown>,
) {
  const authenticated = await getBrowserSession(raw, restoreLegacy);
  if (!authenticated) {
    // A legacy grant may already have been deleted before this rollout. An
    // explicit full logout must still leave a tombstone so a future login
    // cannot reactivate its old DID-only cookie.
    const { legacyDid } = parseCookie(raw);
    if (revokeOAuth && legacyDid && await legacyDeadline() > Math.floor(Date.now() / 1000)) {
      await requestOAuthLock(`browser-session:${legacyDid}`, async () => {
        const account = await accounts.get(legacyDid);
        if (!account || account.legacyAllowed) {
          const next = { generation: randomUUID(), legacyAllowed: false };
          await accounts.setIfOwner(legacyDid, next, next.generation, account?.generation);
        }
      });
    }
    return;
  }
  await requestOAuthLock(`browser-session:${authenticated.did}`, async () => {
    const account = await accounts.get(authenticated.did);
    if (!account) return;
    if (authenticated.sessionId === 'legacy') {
      if (!account.legacyAllowed) return;
    } else if (!await checkCurrent(authenticated)) return;
    if (revokeOAuth) {
      // Persist revocation before contacting upstream, even if that call fails.
      const next = { generation: randomUUID(), legacyAllowed: false };
      if (!await accounts.setIfOwner(authenticated.did, next, next.generation, account.generation)) return;
      await revokeOAuth(authenticated.did);
    } else if (authenticated.sessionId !== 'legacy') {
      await sessions.deleteIfOwner(authenticated.sessionId, authenticated.sessionId);
    }
    // Identical legacy cookies cannot identify one device. Local legacy logout
    // clears that browser's cookie; full logout also closes legacy migration.
  });
}
