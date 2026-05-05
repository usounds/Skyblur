import { VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_LIST, VISIBILITY_MUTUAL } from '@/types/types';
import type { AppBskyGraphDefs } from '@atcute/bluesky';
import type { Client } from '@atcute/client';
import type { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';

export type OwnedListOption = {
  uri: string;
  cid?: string;
  name: string;
  description?: string;
  purpose?: string;
  avatar?: string;
  memberCount?: number;
};

export function isListVisibility(visibility?: string | null) {
  return visibility === VISIBILITY_LIST;
}

export function isRestrictedVisibility(visibility?: string | null) {
  return [VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL, VISIBILITY_LIST].includes(visibility || '');
}

export function fallbackListName(uri: string) {
  const parts = uri.split('/');
  return parts[parts.length - 1] || uri.replace(/^at:\/\//, '');
}

export function compactListUri(uri: string) {
  if (uri.length <= 36) return uri;
  return `${uri.slice(0, 24)}...${uri.slice(-10)}`;
}

export function normalizeListView(view: Partial<AppBskyGraphDefs.ListView> | null | undefined): OwnedListOption | null {
  if (!view?.uri) return null;

  return {
    uri: view.uri,
    cid: view.cid,
    name: view.name || fallbackListName(view.uri),
    description: view.description,
    purpose: view.purpose,
    avatar: view.avatar,
    memberCount: view.listItemCount,
  };
}

export async function fetchOwnedLists(agent: Client, did: string): Promise<OwnedListOption[]> {
  const lists: OwnedListOption[] = [];
  let cursor: string | undefined;

  do {
    const response = await agent.get('app.bsky.graph.getLists', {
      params: {
        actor: did as ActorIdentifier,
        limit: 100,
        cursor,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lists');
    }

    const data = response.data as { cursor?: string; lists?: AppBskyGraphDefs.ListView[] };
    for (const list of data.lists || []) {
      if (list.creator?.did !== did) continue;
      const option = normalizeListView(list);
      if (option) lists.push(option);
    }
    cursor = data.cursor;
  } while (cursor);

  return lists;
}

export async function fetchListSummary(agent: Client, listUri: string): Promise<OwnedListOption | null> {
  const response = await agent.get('app.bsky.graph.getList', {
    params: {
      list: listUri as ResourceUri,
      limit: 1,
    },
  });

  if (!response.ok) return null;

  const data = response.data as { list?: AppBskyGraphDefs.ListView };
  return normalizeListView(data.list);
}
