import "server-only";
import { NextResponse } from "next/server";

/**
 * Response helpers. New endpoints answer `{ data }` for a single record and
 * `{ data, meta: { page, pageSize, total } }` for lists. The endpoints the
 * frontend already calls keep their original keys (`{ profile }`,
 * `{ records }`, `{ user }`, ...).
 */

export const ok = <T>(body: T, init?: ResponseInit) => NextResponse.json(body, init);
export const created = <T>(body: T) => NextResponse.json(body, { status: 201 });
export const noContent = () => new NextResponse(null, { status: 204 });

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export const paged = <T>(data: T[], meta: PageMeta) => NextResponse.json({ data, meta });
