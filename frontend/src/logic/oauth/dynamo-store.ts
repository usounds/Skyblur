import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import type { Store } from "@atcute/oauth-node-client";
import { Resource } from "sst";

import { LOCK_TTL_SECONDS, SESSION_TTL_SECONDS, STATE_TTL_SECONDS } from "./constants";

type StoreKind = "session" | "state";
type OAuthMemoryItem = {
  value: string;
  expiresAt: number;
  updatedAt: number;
  owner?: string;
};

const globalForOAuthStore = globalThis as unknown as {
  skyblurOAuthMemoryStore?: Map<string, OAuthMemoryItem>;
  skyblurOAuthWarnedMemoryFallback?: boolean;
};

const client = new DynamoDBClient({});
let aesKey: CryptoKey | null | undefined;
const memoryStore =
  globalForOAuthStore.skyblurOAuthMemoryStore ||
  (globalForOAuthStore.skyblurOAuthMemoryStore = new Map<string, OAuthMemoryItem>());

function getTableName() {
  let linkedName: string | undefined;
  try {
    linkedName = (Resource as unknown as { OAuthStore?: { name?: string } }).OAuthStore?.name;
  } catch (error) {
    if (!process.env.OAUTH_STORE_TABLE_NAME && !isLocalFallbackEnabled()) {
      console.warn("[OAuthStore] SST Resource link is unavailable; falling back to env table name.");
    }
  }

  const tableName = linkedName || process.env.OAUTH_STORE_TABLE_NAME;
  if (!tableName && isLocalFallbackEnabled()) {
    return "__memory__";
  }

  if (!tableName) {
    throw new Error("OAuthStore table is not linked and OAUTH_STORE_TABLE_NAME is not set");
  }
  return tableName;
}

function ttlForKind(kind: StoreKind) {
  return kind === "session" ? SESSION_TTL_SECONDS : STATE_TTL_SECONDS;
}

function isLocalFallbackEnabled() {
  return process.env.NODE_ENV === "development" && process.env.USE_AWS_REAL_DB !== "true";
}

function isFallbackError(error: unknown) {
  const err = error as { name?: string; code?: string; __type?: string };
  const errorName = err.name || err.code || err.__type || "";
  return [
    "ResourceNotFound",
    "CredentialsError",
    "NoCredentials",
    "AccessDenied",
    "ValidationException",
    "UnrecognizedClientException",
  ].some((name) => errorName.includes(name));
}

function warnMemoryFallback(commandName: string) {
  if (globalForOAuthStore.skyblurOAuthWarnedMemoryFallback) return;
  console.warn(
    "[OAuthStore] Falling back to in-memory DynamoDB stub for local development. Command: %s",
    commandName,
  );
  globalForOAuthStore.skyblurOAuthWarnedMemoryFallback = true;
}

type DynamoCommand = GetItemCommand | PutItemCommand | DeleteItemCommand | ScanCommand;

async function sendDynamo<T>(command: DynamoCommand): Promise<T> {
  if (getCommandTableName(command) === "__memory__") {
    warnMemoryFallback(command.constructor.name);
    return handleMemoryCommand(command) as T;
  }

  try {
    return (await (client as any).send(command)) as T;
  } catch (error) {
    if (isLocalFallbackEnabled() && isFallbackError(error)) {
      warnMemoryFallback(command.constructor.name);
      return handleMemoryCommand(command) as T;
    }
    throw error;
  }
}

function getCommandTableName(command: DynamoCommand) {
  if (command instanceof GetItemCommand) return command.input.TableName;
  if (command instanceof PutItemCommand) return command.input.TableName;
  if (command instanceof DeleteItemCommand) return command.input.TableName;
  if (command instanceof ScanCommand) return command.input.TableName;
  return undefined;
}

function handleMemoryCommand(command: DynamoCommand) {
  const now = Math.floor(Date.now() / 1000);

  if (command instanceof GetItemCommand) {
    const pk = command.input.Key?.pk?.S;
    if (!pk) return {};

    const item = memoryStore.get(pk);
    if (!item || item.expiresAt < now) {
      memoryStore.delete(pk);
      return {};
    }

    return {
      Item: {
        pk: { S: pk },
        value: { S: item.value },
        expiresAt: { N: String(item.expiresAt) },
        updatedAt: { N: String(item.updatedAt) },
        ...(item.owner ? { owner: { S: item.owner } } : {}),
      },
    };
  }

  if (command instanceof PutItemCommand) {
    const pk = command.input.Item?.pk?.S;
    const value = command.input.Item?.value?.S;
    const expiresAt = Number(command.input.Item?.expiresAt?.N || now);
    const updatedAt = Number(command.input.Item?.updatedAt?.N || Date.now());
    const owner = command.input.Item?.owner?.S;
    if (!pk || !value) return {};

    const existing = memoryStore.get(pk);
    const requiresAvailableLock = command.input.ConditionExpression?.includes("attribute_not_exists");
    if (requiresAvailableLock && existing && existing.expiresAt >= now) {
      throw new ConditionalCheckFailedException({
        message: "Memory lock is already held",
        $metadata: {},
      });
    }

    memoryStore.set(pk, { value, expiresAt, updatedAt, owner });
    return {};
  }

  if (command instanceof DeleteItemCommand) {
    const pk = command.input.Key?.pk?.S;
    if (!pk) return {};

    const existing = memoryStore.get(pk);
    const owner = command.input.ExpressionAttributeValues?.[":owner"]?.S;
    if (command.input.ConditionExpression && owner && existing?.owner !== owner) {
      throw new ConditionalCheckFailedException({
        message: "Memory lock owner mismatch",
        $metadata: {},
      });
    }

    memoryStore.delete(pk);
    return {};
  }

  if (command instanceof ScanCommand) {
    const prefix = command.input.ExpressionAttributeValues?.[":prefix"]?.S || "";
    return {
      Items: Array.from(memoryStore.keys())
        .filter((pk) => pk.startsWith(prefix))
        .map((pk) => ({ pk: { S: pk } })),
    };
  }

  return {};
}

function replaceBinary(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __type: "Uint8Array", data: Array.from(value) };
  }

  if (Array.isArray(value)) {
    return value.map(replaceBinary);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceBinary(child)]),
    );
  }

  return value;
}

function reviveBinary(value: unknown): unknown {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.__type === "Uint8Array" && Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[]);
    }

    if (Array.isArray(value)) {
      return value.map(reviveBinary);
    }

    return Object.fromEntries(
      Object.entries(obj).map(([key, child]) => [key, reviveBinary(child)]),
    );
  }

  return value;
}

async function getAesKey() {
  if (aesKey !== undefined) return aesKey;

  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    aesKey = null;
    return aesKey;
  }

  const bytes = Uint8Array.from(Buffer.from(raw, "base64"));
  aesKey = await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return aesKey;
}

async function encodeValue(value: unknown) {
  const replaced = replaceBinary(value);
  const key = await getAesKey();

  if (!key) return JSON.stringify(replaced);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(replaced)),
  );

  return JSON.stringify({
    __encrypted: true,
    iv: Buffer.from(iv).toString("base64"),
    data: Buffer.from(encrypted).toString("base64"),
  });
}

async function decodeValue(value: string) {
  const parsed = JSON.parse(value);
  if (!parsed?.__encrypted) return reviveBinary(parsed);

  const key = await getAesKey();
  if (!key) throw new Error("DATA_ENCRYPTION_KEY is required to decrypt OAuth store data");

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(Buffer.from(parsed.iv, "base64")) },
    key,
    Uint8Array.from(Buffer.from(parsed.data, "base64")),
  );

  return reviveBinary(JSON.parse(new TextDecoder().decode(decrypted)));
}

export class DynamoOAuthStore<K extends string, V> implements Store<K, V> {
  constructor(private readonly kind: StoreKind) {}

  private key(key: K) {
    return `${this.kind}:${key}`;
  }

  async get(key: K): Promise<V | undefined> {
    const res = await sendDynamo<{ Item?: { value?: { S?: string } } }>(
      new GetItemCommand({
        TableName: getTableName(),
        Key: { pk: { S: this.key(key) } },
      }),
    );

    const value = res.Item?.value?.S;
    if (!value) return undefined;

    return (await decodeValue(value)) as V;
  }

  async set(key: K, value: V): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await sendDynamo(
      new PutItemCommand({
        TableName: getTableName(),
        Item: {
          pk: { S: this.key(key) },
          value: { S: await encodeValue(value) },
          expiresAt: { N: String(now + ttlForKind(this.kind)) },
          updatedAt: { N: String(Date.now()) },
        },
      }),
    );
  }

  async delete(key: K): Promise<void> {
    await sendDynamo(
      new DeleteItemCommand({
        TableName: getTableName(),
        Key: { pk: { S: this.key(key) } },
      }),
    );
  }

  async clear(): Promise<void> {
    const prefix = `${this.kind}:`;
    let ExclusiveStartKey: Record<string, { S: string }> | undefined;

    do {
      const res = await sendDynamo<{
        Items?: Array<{ pk: { S: string } }>;
        LastEvaluatedKey?: Record<string, { S: string }>;
      }>(
        new ScanCommand({
          TableName: getTableName(),
          ProjectionExpression: "pk",
          FilterExpression: "begins_with(pk, :prefix)",
          ExpressionAttributeValues: {
            ":prefix": { S: prefix },
          },
          ExclusiveStartKey,
        }),
      );

      await Promise.all(
        (res.Items || []).map((item: { pk: { S: string } }) =>
          sendDynamo(
            new DeleteItemCommand({
              TableName: getTableName(),
              Key: { pk: item.pk },
            }),
          ),
        ),
      );

      ExclusiveStartKey = res.LastEvaluatedKey as Record<string, { S: string }> | undefined;
    } while (ExclusiveStartKey);
  }
}

export async function requestOAuthLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const pk = `lock:${name}`;
  const deadline = Date.now() + 70_000;
  const owner = crypto.randomUUID();

  while (Date.now() < deadline) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + LOCK_TTL_SECONDS;

    try {
      await sendDynamo(
        new PutItemCommand({
          TableName: getTableName(),
          Item: {
            pk: { S: pk },
            value: { S: JSON.stringify({ owner }) },
            owner: { S: owner },
            expiresAt: { N: String(expiresAt) },
            updatedAt: { N: String(Date.now()) },
          },
          ConditionExpression: "attribute_not_exists(pk) OR expiresAt < :now",
          ExpressionAttributeValues: {
            ":now": { N: String(now) },
          },
        }),
      );

      try {
        return await fn();
      } finally {
        try {
          await sendDynamo(
            new DeleteItemCommand({
              TableName: getTableName(),
              Key: { pk: { S: pk } },
              ConditionExpression: "#owner = :owner",
              ExpressionAttributeNames: {
                "#owner": "owner",
              },
              ExpressionAttributeValues: {
                ":owner": { S: owner },
              },
            }),
          );
        } catch (error) {
          if (!(error instanceof ConditionalCheckFailedException)) {
            throw error;
          }
        }
      }
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }

      const waitMs = Math.min(
        250 + Math.floor(Math.random() * 500),
        Math.max(0, deadline - Date.now()),
      );
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  throw new Error(`Lock acquisition timed out for ${name}`);
}
