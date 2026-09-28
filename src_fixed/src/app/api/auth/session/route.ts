import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user }, { status: 200 });
}
