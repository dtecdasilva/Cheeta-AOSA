import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { PublicUser } from "@/lib/auth/users";
import { signToken, verifyToken } from "@/lib/auth/token";
import { env } from "@/server/config/env";
import { getDb, type Executor } from "@/server/db/client";
import { applicationDocuments, files } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError } from "@/server/http/errors";
import { logger } from "@/server/logging/logger";
import { getStorage } from "./driver";

/**
 * Upload, read and delete files, with their metadata in the `files` table.
 *
 * Uploads are checked three ways before anything is stored: the size, the
 * extension against the allowed list for the purpose (or the institution's
 * requirement), and the first bytes of the content against that extension,
 * so a renamed executable can't pass as a PDF.
 *
 * Downloads go through short-lived signed links (`/api/files/:id?t=...`)
 * issued only to someone allowed to see the file, so a link can be put in
 * an <a href> or <img src> without exposing the file to anyone else.
 */

export type FilePurpose = "application-document" | "payment-receipt" | "medical-certificate" | "admission-letter" | "other";

const PURPOSES: Record<FilePurpose, { types: string[]; maxMb?: number }> = {
  "application-document": { types: ["pdf", "jpg", "jpeg", "png"] },
  "payment-receipt": { types: ["pdf", "jpg", "jpeg", "png"], maxMb: 5 },
  "medical-certificate": { types: ["pdf", "jpg", "jpeg", "png"], maxMb: 5 },
  "admission-letter": { types: ["pdf"] },
  other: { types: ["pdf", "jpg", "jpeg", "png"] },
};

export function isFilePurpose(v: string): v is FilePurpose {
  return v in PURPOSES;
}

const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Leading bytes each allowed type must start with. */
const SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

function extensionOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

function matchesSignature(ext: string, bytes: Uint8Array) {
  const sigs = SIGNATURES[ext];
  if (!sigs) return false;
  return sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ()]+/g, "_").slice(-120) || "file";
}

export type StoredFile = typeof files.$inferSelect;

export async function storeUpload(params: {
  owner: PublicUser;
  file: File;
  purpose: FilePurpose;
  institutionId?: string | null;
  /** Narrower rules from an institution's upload requirement. */
  allowedTypes?: string[];
  maxSizeKb?: number;
}): Promise<StoredFile> {
  const { owner, file, purpose } = params;
  const rules = PURPOSES[purpose];
  const allowed = (params.allowedTypes?.length ? params.allowedTypes : rules.types).map((t) => t.toLowerCase().replace(/^\./, ""));
  const limitBytes = Math.min(env.STORAGE_MAX_UPLOAD_MB, rules.maxMb ?? Infinity) * 1024 * 1024;
  const maxBytes = params.maxSizeKb ? Math.min(params.maxSizeKb * 1024, limitBytes) : limitBytes;

  if (file.size === 0) throw new BadRequestError("The file is empty.");
  if (file.size > maxBytes) throw new PayloadTooLargeError(`The file is larger than the ${Math.round((maxBytes / 1024 / 1024) * 10) / 10} MB allowed.`);
  const ext = extensionOf(file.name);
  if (!allowed.includes(ext)) throw new BadRequestError(`Upload a ${allowed.map((t) => t.toUpperCase()).join(", ")} file.`, { field: "file" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(ext, bytes)) throw new BadRequestError(`This file isn't a valid ${ext.toUpperCase()}.`, { field: "file" });

  const id = newId("file");
  const now = new Date();
  const key = `${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${ext}`;
  const storage = getStorage();
  await storage.put(key, bytes, MIME[ext] ?? "application/octet-stream");

  try {
    const [row] = await getDb().transaction(async (tx) => {
      const inserted = await tx
        .insert(files)
        .values({
          id,
          ownerUserId: owner.id,
          institutionId: params.institutionId ?? null,
          purpose,
          originalName: safeName(file.name),
          mimeType: MIME[ext] ?? "application/octet-stream",
          sizeBytes: file.size,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          storageDriver: storage.name,
          storageKey: key,
        })
        .returning();
      await audit(tx, { action: "upload", entityType: "file", entityId: id, institutionId: params.institutionId, meta: { purpose, size: file.size, name: safeName(file.name) } });
      return inserted;
    });
    return row;
  } catch (err) {
    // Don't leave orphaned bytes when the metadata write fails.
    await storage.delete(key).catch((e) => logger.warn("Could not remove orphaned upload", { key, err: e }));
    throw err;
  }
}

export async function getFile(db: Executor, id: string): Promise<StoredFile> {
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("File");
  return row;
}

/**
 * Who may read a file: its owner, any AOSA administrator, and staff of the
 * institution it was uploaded for. Callers that attach files to records
 * (application documents) pass the institution when uploading.
 */
export function canRead(user: PublicUser, file: StoredFile) {
  if (file.ownerUserId === user.id) return true;
  if (user.role === "AOSA_ADMIN") return true;
  return !!file.institutionId && file.institutionId === user.institutionId && (user.role === "INSTITUTION_ADMIN" || user.role === "INSTITUTION_ADMISSION_USER");
}

export async function signedDownloadUrl(user: PublicUser, file: StoredFile): Promise<string> {
  if (!canRead(user, file)) throw new ForbiddenError();
  const token = await signToken({ sub: file.id, purpose: "file_download", exp: Date.now() + env.STORAGE_DOWNLOAD_TTL_SECONDS * 1000 });
  return `/api/files/${encodeURIComponent(file.id)}?t=${encodeURIComponent(token)}`;
}

export async function verifyDownloadToken(fileId: string, token: string | null): Promise<boolean> {
  const payload = await verifyToken<{ sub: string; purpose: string }>(token);
  return !!payload && payload.purpose === "file_download" && payload.sub === fileId;
}

export async function openFile(file: StoredFile) {
  const stream = await getStorage().get(file.storageKey);
  if (!stream) throw new NotFoundError("File content");
  return stream;
}

/** Soft delete, by the owner or an administrator, once no application document uses the file. */
export async function deleteFile(user: PublicUser, id: string) {
  const db = getDb();
  const file = await getFile(db, id);
  if (file.ownerUserId !== user.id && user.role !== "AOSA_ADMIN") throw new ForbiddenError();
  const [inUse] = await db.select({ id: applicationDocuments.id }).from(applicationDocuments).where(eq(applicationDocuments.fileId, id)).limit(1);
  if (inUse) throw new ConflictError("This file is attached to an application. Remove it from the application first.");
  await db.transaction(async (tx) => {
    await tx.update(files).set({ deletedAt: new Date() }).where(eq(files.id, id));
    await audit(tx, { action: "delete", entityType: "file", entityId: id, institutionId: file.institutionId });
  });
}
