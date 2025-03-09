import { NextRequest, NextResponse } from "next/server";
import { deriveKey } from "@/logic/HandleEncrypt";

export async function POST(req: NextRequest) {
  console.log(req)
  try {
    const { body, password } = await req.json();
    if (!body || !password) {
      return NextResponse.json({ error: "body and password are required" }, { status: 400 });
    }

    const key = await deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(body)
    );

    const encryptedText = `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(encryptedData)))}`;

    return NextResponse.json({ encryptedText });
  } catch (error) {
    return NextResponse.json({ error: "Encryption failed" }, { status: 500 });
  }
}
