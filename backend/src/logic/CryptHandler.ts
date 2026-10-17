

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            iterations: 100000,
            hash: "SHA-256",
            salt: salt.slice(0).buffer
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

function buildValidatedUrl(pds: string, did: string, cid: string): string {
    try {
        const base = new URL(pds);
        const host = base.hostname.toLowerCase().replace(/\.$/, '');
        // PDS hosts are federated, not a static domain allowlist. Reject local
        // names and all IP literals, including WHATWG-normalized numeric IPv4.
        if (base.protocol !== 'https:' || base.username || base.password || base.port
            || base.pathname !== '/' || base.search || base.hash
            || /[\s\\]/.test(pds) || /\/%2e|\/\.\./i.test(pds)
            || /^\d+\.\d+\.\d+\.\d+$/.test(host)
            || !host.includes('.') || host.length > 253
            || !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
            || /\.(?:localhost|local|internal|home|lan|invalid|test)$/.test(host)) {
            throw new Error('Unsafe PDS URL');
        }
        const url = new URL('/xrpc/com.atproto.sync.getBlob', base);
        url.searchParams.set('did', did);
        url.searchParams.set('cid', cid);
        return url.href;
    } catch {
        throw new Error('Invalid URL');
    }
}

export async function getDecrypt(pds: string, repo: string, cid: string, password: string) {
    let decodedData
    //Blob取得
    try {
        const url = buildValidatedUrl(pds, repo, cid);
        // Use the Workers global fetch network boundary, never a private/VPC
        // binding. Do not follow redirects to unvalidated destinations.
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
        if (!response.ok || (response.status >= 300 && response.status < 400)) {
            console.log(`getDecrypt error ${url}`)
            throw new Error(`Cannot get blob from ${url}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        decodedData = new TextDecoder().decode(uint8Array);

    } catch (e) {
        throw new Error('Cannot get blob. ' + e);
    }

    try {
        // Blobからivと暗号化データを切り分け
        const [ivBase64, salt, encryptedBase64] = decodedData.split(":");
        const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
        const encryptedData = new Uint8Array(atob(encryptedBase64).split("").map(c => c.charCodeAt(0)));

        // saltをデコード
        let decodedSalt = atob(salt);
        const saltArray = new Uint8Array(decodedSalt.split("").map(char => char.charCodeAt(0)));

        // saltから鍵を生成
        const key = await deriveKey(password, saltArray);

        // 暗号化データを復号化
        let decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv.buffer,
            },
            key,
            encryptedData.buffer
        );

        // 結果をデコードして元のJSONに戻す
        let decoder = new TextDecoder();
        let decryptedText = JSON.parse(decoder.decode(decrypted)) as { text: string, additional: string }

        return { text: decryptedText.text, additional: decryptedText.additional };
    } catch (e) {
        throw new Error("Decrypt failed.");
    }
}
