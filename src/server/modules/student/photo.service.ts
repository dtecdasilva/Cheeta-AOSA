import "server-only";
import { eq } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { applicantProfiles, files } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { discardBytes, fileUrl, markFilesDeleted, storeUpload } from "@/server/storage/files.service";

/**
 * The applicant's photo: one JPG or PNG, up to 2 MB, shown on their
 * demographic record and their application (to the institutions they
 * submit to and to Cheeta administration). Replacing it removes the old one.
 */

export interface PhotoView {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export async function photoOf(db: Executor, userId: string): Promise<PhotoView | null> {
  const [row] = await db
    .select({ f: files })
    .from(applicantProfiles)
    .innerJoin(files, eq(files.id, applicantProfiles.photoFileId))
    .where(eq(applicantProfiles.userId, userId))
    .limit(1);
  if (!row || row.f.deletedAt) return null;
  return { url: fileUrl(row.f), name: row.f.originalName, size: row.f.sizeBytes, uploadedAt: row.f.createdAt.toISOString() };
}

export function myPhoto(user: PublicUser) {
  return photoOf(getDb(), user.id);
}

export async function setPhoto(user: PublicUser, file: File | null) {
  if (!file) throw new ValidationError({ file: "Choose a photo." });
  const db = getDb();
  const [profile] = await db.select({ photoFileId: applicantProfiles.photoFileId }).from(applicantProfiles).where(eq(applicantProfiles.userId, user.id)).limit(1);
  if (!profile) throw new NotFoundError("Applicant profile");
  const stored = await storeUpload({ owner: user, file, purpose: "applicant-photo" });
  const removed = await db.transaction(async (tx) => {
    await tx.update(applicantProfiles).set({ photoFileId: stored.id, updatedAt: new Date() }).where(eq(applicantProfiles.userId, user.id));
    await audit(tx, { action: "photo", entityType: "account", entityId: user.id, actorUserId: user.id, before: { photoFileId: profile.photoFileId }, after: { photoFileId: stored.id } });
    return markFilesDeleted(tx, [profile.photoFileId]);
  });
  await discardBytes(removed);
  return photoOf(db, user.id);
}

export async function removePhoto(user: PublicUser) {
  const db = getDb();
  const [profile] = await db.select({ photoFileId: applicantProfiles.photoFileId }).from(applicantProfiles).where(eq(applicantProfiles.userId, user.id)).limit(1);
  if (!profile?.photoFileId) return null;
  const removed = await db.transaction(async (tx) => {
    await tx.update(applicantProfiles).set({ photoFileId: null, updatedAt: new Date() }).where(eq(applicantProfiles.userId, user.id));
    await audit(tx, { action: "photo", entityType: "account", entityId: user.id, actorUserId: user.id, before: { photoFileId: profile.photoFileId }, after: { photoFileId: null } });
    return markFilesDeleted(tx, [profile.photoFileId]);
  });
  await discardBytes(removed);
  return null;
}
