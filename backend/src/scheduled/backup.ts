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
                    const dumpData = await dumpRes.json();

                    // Identify the user DID if possible. 
                    // RestrictedPostDO is sharded by name = DID.
                    // But here we obtained ID from list. idFromString(id) gives us access, but we don't know the 'name' (DID) used to create it if it was created with idFromName.
                    // Actually, if created with idFromName, the ID is derived.
                    // If we can't extract DID from ID easily (we can't), we verify if the dump contains identifying info OR just store by DO ID.
                    // Storing by DO ID is safer for backup. 
                    // Wait, implementation plan said "users.keys" from KV gave us DID. 
                    // Now we have raw IDs.
                    // We can try to guess DID if it's stored inside the DO data?
                    // RestrictedPostDO stores { text, additional } keyed by URI? 
                    // URI: at://<DID>/...
                    // Key is the URI. So we can extract DID from the first key found in dumpData.

                    let did = obj.id; // Default to Object ID
                    const keys = Object.keys(dumpData as any);
                    if (keys.length > 0) {
                        const firstKey = keys[0];
                        // at://did:plc:xxx/collection/rkey
                        const match = firstKey.match(/^at:\/\/(did:[^/]+)\//);
                        if (match) {
                            did = match[1];
                        }
                    }

                    await env.SKYBLUR_BACKUP.put(`restricted_posts/${backupTimestamp}/${did}.json`, JSON.stringify(dumpData));
                }
            } catch (err) {
                console.error(`Failed to backup object ${obj.id}:`, err);
            }
        }

        cursor = data.result_info?.cursors?.after;

    } while (cursor);
}
