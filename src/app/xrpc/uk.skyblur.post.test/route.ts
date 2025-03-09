export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const SALT = process.env.SECRET_KEY || "salt";
  return NextResponse.json({ salt: SALT });
}