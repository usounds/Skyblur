import { NextResponse } from "next/server";
import { EncryptBody } from "@/types/types";
const SALT = process.env.SALT || "salt";

export async function deriveKey(password: string): Promise<CryptoKey> {
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
            salt: encoder.encode(SALT),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function decryption(pds: string, repo: string, cid: string, password: string): Promise<NextResponse> {
    const url = `${pds}/xrpc/com.atproto.sync.getBlob?did=${repo}&cid=${cid}`;

    // Fetch the blob data
    const response = await fetch(url);
    if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch blob: ${response.statusText}` }, { status: 404 });
    }

    // Get the blob data
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Base64エンコードされたデータをデコード
    const decodedData = new TextDecoder().decode(uint8Array);

    const key = await deriveKey(password);
    const [ivBase64, encryptedBase64] = decodedData.split(":");

    const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
    const encryptedData = new Uint8Array(atob(encryptedBase64).split("").map(c => c.charCodeAt(0)));

    try {
        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encryptedData
        );

        const decryptedText = JSON.parse(new TextDecoder().decode(decryptedData)) as EncryptBody;
        return NextResponse.json(decryptedText);
    } catch (error) {
        return NextResponse.json({ error: "Decryption failed. "+error }, { status: 403 });
    }
}