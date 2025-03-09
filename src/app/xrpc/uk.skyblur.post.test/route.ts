export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const SALT = process.env.SALT || "salt";
  return NextResponse.json({ salt: SALT });
}