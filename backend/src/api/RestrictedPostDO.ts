import { DurableObject } from "cloudflare:workers";
import { Env } from "@/index";

export class RestrictedPostDO extends DurableObject {
    private readonly initializedAt = performance.now();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        // Initialize SQLite table
        // created_at is TEXT to store ISO 8601 string
        this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS posts (
                rkey TEXT PRIMARY KEY,
                text TEXT,
                additional TEXT,
                visibility TEXT,
                list_uri TEXT,
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        const tableInfo = this.ctx.storage.sql.exec<{ name?: string }>("PRAGMA table_info(posts)");
        const columns = typeof (tableInfo as any)?.toArray === 'function'
            ? (tableInfo as any).toArray() as Array<{ name?: string }>
            : [];
        if (!columns.some((column) => column.name === 'list_uri')) {
            this.ctx.storage.sql.exec("ALTER TABLE posts ADD COLUMN list_uri TEXT");
        }
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        // key parameter is expected to be the rkey
        const key = url.searchParams.get("key");

        if (request.method === "GET") {
            const startedAt = performance.now();
            if (url.pathname === "/dump") {
                const postsResult = this.ctx.storage.sql.exec("SELECT * FROM posts");
                const posts = [...postsResult];

                const configResult = this.ctx.storage.sql.exec("SELECT value FROM config WHERE key = 'did'");
                const didRow = configResult.one();
                const did = didRow ? didRow.value : null;

                return new Response(JSON.stringify({ did, posts }), {
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (!key) {
                return new Response("Missing key", { status: 400 });
            }

            const result = this.ctx.storage.sql.exec("SELECT text, additional, visibility, list_uri as listUri FROM posts WHERE rkey = ?", key);
            const sqlDurationMs = Number((performance.now() - startedAt).toFixed(1));
            // .one() returns the first row or null if no results
            const row = result.one();
            const instanceAgeMs = Number((performance.now() - this.initializedAt).toFixed(1));
            const timingHeaders = {
                "Content-Type": "application/json",
                "X-Skyblur-Restricted-DO-Timing": JSON.stringify({
                    sqlMs: sqlDurationMs,
                    instanceAgeMs,
                    found: Boolean(row),
                }),
            };

            if (!row) {
                console.info('[RestrictedPostDO] get', {
                    key,
                    durationMs: Number((performance.now() - startedAt).toFixed(1)),
                    sqlMs: sqlDurationMs,
                    instanceAgeMs,
                    found: false,
                });
                return new Response(null, { status: 404, headers: timingHeaders });
            }
            console.info('[RestrictedPostDO] get', {
                key,
                durationMs: Number((performance.now() - startedAt).toFixed(1)),
                sqlMs: sqlDurationMs,
                instanceAgeMs,
                found: true,
            });
            return new Response(JSON.stringify(row), { headers: timingHeaders });
        }

        if (request.method === "PUT") {
            if (!key) return new Response("Missing key", { status: 400 });

            const body = await request.json() as any;
            if (!body || typeof body !== "object") {
                return new Response("Invalid body", { status: 400 });
            }
            const { text, additional, visibility, did } = body;
            const listUri = visibility === "list" && typeof body.listUri === "string" ? body.listUri : null;
            if (typeof text !== "string" || (additional !== undefined && typeof additional !== "string") || typeof visibility !== "string") {
                return new Response("Invalid body", { status: 400 });
            }
            const createdAt = new Date().toISOString();

            // Store DID if provided (Singleton config)
            if (did) {
                this.ctx.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('did', ?)", did);
            }

            this.ctx.storage.sql.exec(
                "INSERT OR REPLACE INTO posts (rkey, text, additional, visibility, list_uri, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                key, text, additional || "", visibility, listUri, createdAt
            );
            return new Response("OK");
        }

        if (request.method === "DELETE") {
            if (!key) return new Response("Missing key", { status: 400 });
            this.ctx.storage.sql.exec("DELETE FROM posts WHERE rkey = ?", key);
            return new Response("OK");
        }

        return new Response("Method not allowed", { status: 405 });
    }
}
