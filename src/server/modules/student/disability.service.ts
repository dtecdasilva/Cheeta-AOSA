import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { demographicProfiles, disabilityMedia, files } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { discardBytes, fileUrl, markFilesDeleted, storeUpload } from "@/server/storage/files.service";

/**
 * Photos and a short video for an applicant who has a disability, to help
 * institutions judge whether they can accommodate it. Optional. Allowed
 * only while the applicant's answer to the disability question is Yes:
 * up to MAX_PHOTOS photos and one video.
 */

export const MAX_PHOTOS = 3;
const VIDEO = new Set(["mp4", "mov", "webm"]);

export interface DisabilityMediaView {
  id: string;
  kind: "PHOTO" | "VIDEO";
  caption: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export async function mediaFor(db: Executor, userId: string): Promise<DisabilityMediaView[]> {
  const rows = await db
    .select({ m: disabilityMedia, f: files })
    .from(disabilityMedia)
    .innerJoin(files, eq(files.id, disabilityMedia.fileId))
    .where(eq(disabilityMedia.userId, userId))
    .orderBy(asc(disabilityMedia.createdAt));
  return rows.map(({ m, f }) => ({ id: m.id, kind: m.kind, caption: m.caption, name: f.originalName, mimeType: f.mimeType, size: f.sizeBytes, url: fileUrl(f), createdAt: m.createdAt.toISOString() }));
}

export function listMine(user: PublicUser) {
  return mediaFor(getDb(), user.id);
}

export async function addMedia(user: PublicUser, file: File | null, caption: string) {
  if (!file) throw new ValidationError({ file: "Choose a photo or video." });
  const db = getDb();
  const [profile] = await db.select({ disability: demographicProfiles.disability }).from(demographicProfiles).where(eq(demographicProfiles.userId, user.id)).limit(1);
  if (profile?.disability !== "Yes") throw new ConflictError("Answer Yes to the disability question, and save, before adding photos or a video.");
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? "").toLowerCase();
  const kind = VIDEO.has(ext) ? "VIDEO" : "PHOTO";
  const existing = await mediaFor(db, user.id);
  if (kind === "VIDEO" && existing.some((m) => m.kind === "VIDEO")) throw new ConflictError("You can add one video. Remove the current one to replace it.", { field: "file" });
  if (kind === "PHOTO" && existing.filter((m) => m.kind === "PHOTO").length >= MAX_PHOTOS) throw new ConflictError(`You can add up to ${MAX_PHOTOS} photos.`, { field: "file" });
  // Photos are kept small; the video limit is the purpose's own (and the deployment's).
  const stored = await storeUpload({ owner: user, file, purpose: "disability-media", ...(kind === "PHOTO" ? { allowedTypes: ["jpg", "png"], maxSizeKb: 5 * 1024 } : { allowedTypes: ["mp4", "mov", "webm"] }) });
  const id = newId("dmd");
  await db.transaction(async (tx) => {
    await tx.insert(disabilityMedia).values({ id, userId: user.id, fileId: stored.id, kind, caption: caption.trim().slice(0, 200) });
    await audit(tx, { action: "upload", entityType: "disability-media", entityId: id, meta: { kind, fileId: stored.id, size: stored.sizeBytes } });
  });
  return mediaFor(db, user.id);
}

export async function removeMedia(user: PublicUser, id: string) {
  const db = getDb();
  const removed = await db.transaction(async (tx) => {
    const [m] = await tx.delete(disabilityMedia).where(and(eq(disabilityMedia.id, id), eq(disabilityMedia.userId, user.id))).returning();
    if (!m) throw new NotFoundError("Photo or video");
    await audit(tx, { action: "delete", entityType: "disability-media", entityId: id, meta: { kind: m.kind } });
    return markFilesDeleted(tx, [m.fileId]);
  });
  await discardBytes(removed);
  return mediaFor(db, user.id);
}

/** When the answer becomes No, the photos and video go: nothing about a disability is kept that the applicant hasn't stated. Call in the save's transaction. */
export async function clearMedia(tx: Executor, userId: string) {
  const gone = await tx.delete(disabilityMedia).where(eq(disabilityMedia.userId, userId)).returning();
  if (!gone.length) return [];
  await audit(tx, { action: "delete", entityType: "disability-media", entityId: userId, meta: { reason: "disability answered No", count: gone.length } });
  return markFilesDeleted(tx, gone.map((g) => g.fileId));
}
