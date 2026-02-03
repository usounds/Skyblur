import { DurableObject } from "cloudflare:workers";
import { Env } from "@/index";

export class RestrictedPostDO extends DurableObject {
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
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        // key parameter is expected to be the rkey
        const key = url.searchParams.get("key");

        if (request.method === "GET") {
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

            const result = this.ctx.storage.sql.exec("SELECT text, additional, visibility FROM posts WHERE rkey = ?", key);
            // .one() returns the first row or null if no results
            const row = result.one();

            if (!row) {
                return new Response(null, { status: 404 });
            }
            return new Response(JSON.stringify(row), {
                headers: { "Content-Type": "application/json" },
            });
        }

        if (request.method === "PUT") {
            if (!key) return new Response("Missing key", { status: 400 });

            const body = await request.json() as any;
            const { text, additional, visibility, did } = body;
            const createdAt = new Date().toISOString();

            // Store DID if provided (Singleton config)
            if (did) {
                this.ctx.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('did', ?)", did);
            }

            this.ctx.storage.sql.exec(
                "INSERT OR REPLACE INTO posts (rkey, text, additional, visibility, created_at) VALUES (?, ?, ?, ?, ?)",
                key, text, additional, visibility, createdAt
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
