import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/config/env";
import { flushDeliveries } from "@/server/notifications/engine";

/**
 * For a scheduler (Vercel Cron: add { "path": "/api/cron/notifications",
 * "schedule": "*\/5 * * * *" } to vercel.json): sends what is waiting and
 * retries failures that are due. Needs CRON_SECRET, sent as a Bearer token,
 * which is what Vercel Cron does.
 */
export async function GET(req: NextRequest) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ""}`);
  // Compared in constant time, so the secret can't be guessed a character at a time from response times.
  if (!env.CRON_SECRET || given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  return NextResponse.json({ data: await flushDeliveries(200) });
}
