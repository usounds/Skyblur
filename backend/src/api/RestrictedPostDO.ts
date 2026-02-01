import { DurableObject } from "cloudflare:workers";
import { Env } from "@/index";

export class RestrictedPostDO extends DurableObject {
    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");

        if (!key) {
            return new Response("Missing key", { status: 400 });
        }

        if (request.method === "GET") {
            const val = await this.ctx.storage.get(key);
            if (val === undefined) {
                return new Response(null, { status: 404 });
            }
            return new Response(JSON.stringify(val), {
                headers: { "Content-Type": "application/json" },
            });
        }

        if (request.method === "PUT") {
            const val = await request.json();
            await this.ctx.storage.put(key, val);
            return new Response("OK");
        }

        if (request.method === "DELETE") {
            await this.ctx.storage.delete(key);
            return new Response("OK");
        }

        return new Response("Method not allowed", { status: 405 });
    }
}
