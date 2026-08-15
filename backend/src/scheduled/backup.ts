import { Env } from "@/index";

interface BackupTarget {
    className: string;
    pathPrefix: string;
    getStub: (env: Env, id: string) => { fetch: (url: string | Request) => Promise<Response> };
}

const BACKUP_TARGETS: BackupTarget[] = [
    {
        className: "RestrictedPostDO",
        pathPrefix: "restricted_posts",
        getStub: (env, id) => env.SKYBLUR_DO_RESTRICTED.get(env.SKYBLUR_DO_RESTRICTED.idFromString(id)),
    },
    {
        className: "PostMirrorDO",
        pathPrefix: "post_mirrors",
        getStub: (env, id) => env.SKYBLUR_DO_POST_MIRROR.get(env.SKYBLUR_DO_POST_MIRROR.idFromString(id)),
    },
];

async function backupNamespace(
    accountId: string,
    apiToken: string,
    target: BackupTarget,
    namespaceId: string,
    env: Env,
    backupTimestamp: string,
) {
    let cursor: string | undefined = undefined;

    do {
        const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/durable_objects/namespaces/${namespaceId}/objects`);
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url.toString(), {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            console.error(`Failed to list objects for ${target.className} (${namespaceId}): ${res.status}`);
            break;
        }

        const data = await res.json() as { result: { id: string }[]; result_info?: { cursors?: { after: string } } };

        for (const obj of data.result) {
            try {
                const stub = target.getStub(env, obj.id);
                const dumpRes = await stub.fetch("http://do/dump");

                if (dumpRes.ok) {
                    const dumpData = await dumpRes.json() as { did?: string | null; repo?: string | null; posts?: any[]; records?: any[] };

                    // Use stored DID or repo for filename if available, otherwise Object ID
                    const identifier = dumpData.did || dumpData.repo || obj.id;
                    const filename = `${identifier}.json`;

                    await env.SKYBLUR_BACKUP.put(`${target.pathPrefix}/${backupTimestamp}/${filename}`, JSON.stringify(dumpData));
                } else {
                    console.error(`Failed to dump object ${obj.id} in ${target.className}: status ${dumpRes.status}`);
                }
            } catch (err) {
                console.error(`Failed to backup object ${obj.id} in ${target.className}:`, err);
            }
        }

        cursor = data.result_info?.cursors?.after;

    } while (cursor);
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

    if (!env.SKYBLUR_BACKUP) {
        console.error("SKYBLUR_BACKUP binding is not set.");
        return;
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = env.CLOUDFLARE_API_TOKEN;

    // 1. Get Namespaces
    let namespaces: { id: string; class: string }[] = [];
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

        const nsList = await nsListRes.json() as { result: { id: string; class: string }[] };
        namespaces = nsList.result || [];
    } catch (e) {
        console.error("Error fetching namespaces:", e);
        return;
    }

    const backupTimestamp = new Date().toISOString();

    for (const target of BACKUP_TARGETS) {
        const targetNs = namespaces.find((ns) => ns.class === target.className);
        if (!targetNs) {
            console.error(`Namespace for class ${target.className} not found.`);
            continue;
        }

        await backupNamespace(accountId, apiToken, target, targetNs.id, env, backupTimestamp);
    }
}
