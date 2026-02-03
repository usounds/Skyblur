import { Env } from "@/index";

interface CloudflareDOListResponse {
    result: {
        id: string;
    }[];
    success: boolean;
    errors: any[];
    messages: any[];
    result_info: {
        page: number;
        per_page: number;
        total_count: number;
    }
}

export async function handleBackup(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.CLOUDFLARE_ACCOUNT_ID) {
        console.error("CLOUDFLARE_ACCOUNT_ID is not set.");
        return;
    }

    if (!env.CLOUDFLARE_API_TOKEN) {
        console.error("CLOUDFLARE_API_TOKEN is not set.");
        return;
    }

    // Note: To get the Namespace ID, we might need to list namespaces or have it hardcoded/configured.
    // For now assuming we can find it via API or it's known.
    // However, listing *all* DOs in a script might be tricky without knowing the Namespace ID.
    // Let's assume we fetch the namespace ID first or use a known one.
    // There is no direct way to get Namespace ID from binding in Worker runtime easily without using the API with the script name.

    // Strategy: List Namespaces to find "RestrictedPostDO"
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = env.CLOUDFLARE_API_TOKEN;
    const namespaceName = "RestrictedPostDO"; // The class name in wrangler

    // 1. Get Namespace ID
    let namespaceId = "";
    try {
        const nsListRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/durable_objects/namespaces`, {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!nsListRes.ok) {
            console.error(`Failed to list namespaces: ${nsListRes.status}`);
            return;
        }

        const nsList = await nsListRes.json() as { result: { id: string, class: string }[] };
        const targetNs = nsList.result.find(ns => ns.class === namespaceName);

        if (!targetNs) {
            console.error(`Namespace for class ${namespaceName} not found.`);
            return;
        }
        namespaceId = targetNs.id;

    } catch (e) {
        console.error("Error fetching namespace ID:", e);
        return;
    }

    // 2. List Objects (Pagination)
    let cursor: string | undefined = undefined;
    const backupTimestamp = new Date().toISOString();

    do {
        const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/durable_objects/namespaces/${namespaceId}/objects`);
        if (cursor) url.searchParams.set("cursor", cursor);

        // Note: The API for listing objects exists but returns IDs.
        // Confirming endpoint: GET accounts/:account_identifier/workers/durable_objects/namespaces/:id/objects

        const res = await fetch(url.toString(), {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            console.error(`Failed to list objects: ${res.status}`);
            break;
        }

        const data = await res.json() as { result: { id: string }[], result_info: { cursors?: { after: string } } };

        for (const obj of data.result) {
            try {
                const stub = env.SKYBLUR_DO_RESTRICTED.get(env.SKYBLUR_DO_RESTRICTED.idFromString(obj.id));
                const dumpRes = await stub.fetch("http://do/dump");

                if (dumpRes.ok) {
                    const dumpData = await dumpRes.json() as { did: string | null, posts: any[] };

                    // Use stored DID for filename if available, otherwise Object ID
                    const filename = dumpData.did ? `${dumpData.did}.json` : `${obj.id}.json`;

                    await env.SKYBLUR_BACKUP.put(`restricted_posts/${backupTimestamp}/${filename}`, JSON.stringify(dumpData));
                }
            } catch (err) {
                console.error(`Failed to backup object ${obj.id}:`, err);
            }
        }

        cursor = data.result_info?.cursors?.after;

    } while (cursor);
}
