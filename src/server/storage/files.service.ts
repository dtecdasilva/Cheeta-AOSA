import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import type { PublicUser } from "@/lib/auth/users";
import { formatFileSize, normaliseFileType } from "@/lib/institution/uploadRequirements";
import type { ApplicationStatus } from "@/lib/types";
import { env } from "@/server/config/env";
import { getDb, type Executor } from "@/server/db/client";
import { applicationDocuments, applicationInstitutions, feePayments, files } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { BadRequestError, ConflictError, NotFoundError, PayloadTooLargeError } from "@/server/http/errors";
import { logger } from "@/server/logging/logger";
import { getStorage, storageFor } from "./driver";

/**
 * Upload, read and delete files, with their metadata in the `files` table.
 *
 * Uploads are checked three ways before anything is stored: the size, the
 * extension against the allowed list for the purpose (or the institution's
 * requirement), and the first bytes of the content against that extension,
 * so a renamed executable can't pass as a PDF.
 *
 * Reading a file always needs a signed-in account, and the account is
 * checked against what the file is attached to at the moment it is opened
 * (`fileAccess` below). There are no links that work on their own: the
 * address of a file, /api/files/:id, opens nothing for someone who isn't
 * allowed it, so sharing or leaking one gives nothing away, and access
 * ends the moment the reason for it does.
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

const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };

/** Leading bytes each allowed type must start with. */
const SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  jpg: [[0xff, 0xd8, 0xff]],
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
  // "jpeg" and "jpg" are one format: a requirement that accepts JPG accepts a file named either way.
  const allowed = [...new Set((params.allowedTypes?.length ? params.allowedTypes : rules.types).map(normaliseFileType))];
  const limitBytes = Math.min(env.STORAGE_MAX_UPLOAD_MB, rules.maxMb ?? Infinity) * 1024 * 1024;
  const maxBytes = params.maxSizeKb ? Math.min(params.maxSizeKb * 1024, limitBytes) : limitBytes;

  if (file.size === 0) throw new BadRequestError("The file is empty.", { field: "file" });
  if (file.size > maxBytes) throw new PayloadTooLargeError(`The file is larger than the ${formatFileSize(Math.floor(maxBytes / 1024))} allowed.`);
  const ext = normaliseFileType(extensionOf(file.name));
  if (!allowed.includes(ext)) throw new BadRequestError(`Upload a ${allowed.map((t) => t.toUpperCase()).join(", ")} file.`, { field: "file" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(ext, bytes)) throw new BadRequestError(`This file isn't a valid ${ext.toUpperCase()}.`, { field: "file" });

  const id = newId("file");
  const now = new Date();
  // The key is made here and never from anything the uploader sent, so a file name can't steer where the bytes go.
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

// ---------------------------------------------------------------------------
// Who may open a file
// ---------------------------------------------------------------------------

/** Why an account may open a file: it is theirs, it belongs to an application to their institution, or they are Cheeta administration. */
export type FileAccess = "owner" | "institution" | "administration";

const isInstitutionStaff = (user: PublicUser) => user.role === "INSTITUTION_ADMIN" || user.role === "INSTITUTION_ADMISSION_USER";

/**
 * Decides whether `user` may open `file`, and on what grounds; null means
 * no. Asked on every download, against the database as it stands, so it
 * can't be answered from anything the browser holds.
 *
 * An applicant's document (a file attached to an application):
 *
 * - the applicant it belongs to;
 * - staff of the institution that application is to, once the application
 *   has been submitted and its fee approved. This is the same moment the
 *   institution is shown the application at all; before it, the
 *   institution sees only a masked name. Another institution the applicant
 *   also applied to never sees it: each application has its own documents;
 * - Cheeta administration.
 *
 * It is the document record that says whose it is, not the file. A file
 * that was a document and has been replaced or removed is attached to
 * nothing, and opens for nobody.
 *
 * A payment receipt: the applicant who uploaded it, and Cheeta
 * administration, who verify payments. Never an institution.
 *
 * Any other file: its owner, Cheeta administration, and staff of the
 * institution it was uploaded for (admission letters and the like).
 */
export async function fileAccess(db: Executor, user: PublicUser, file: StoredFile): Promise<FileAccess | null> {
  if (user.role === "AOSA_ADMIN") return "administration";

  if (file.purpose === "application-document") {
    const [doc] = await db
      .select({
        applicantId: applicationDocuments.applicantId,
        institutionId: applicationDocuments.institutionId,
        applicationInstitutionId: applicationDocuments.applicationInstitutionId,
        status: applicationInstitutions.status,
      })
      .from(applicationDocuments)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, applicationDocuments.applicationInstitutionId))
      .where(eq(applicationDocuments.fileId, file.id))
      .limit(1);
    if (!doc) return null;
    if (user.role === "STUDENT") return doc.applicantId === user.id ? "owner" : null;
    if (!isInstitutionStaff(user) || !user.institutionId || doc.institutionId !== user.institutionId) return null;
    if (EDITABLE_STATUSES.includes(doc.status as ApplicationStatus)) return null;
    const [approved] = await db
      .select({ id: feePayments.id })
      .from(feePayments)
      .where(and(eq(feePayments.applicationInstitutionId, doc.applicationInstitutionId), eq(feePayments.approval, "APPROVED")))
      .limit(1);
    return approved ? "institution" : null;
  }

  if (file.ownerUserId === user.id) return "owner";
  if (file.purpose === "payment-receipt") return null;
  return isInstitutionStaff(user) && !!file.institutionId && file.institutionId === user.institutionId ? "institution" : null;
}

/**
 * The address a file is opened at. It carries no permission: the request
 * must come with a session that passes `fileAccess`.
 */
export function fileUrl(file: Pick<StoredFile, "id">): string {
  return `/api/files/${encodeURIComponent(file.id)}`;
}

/**
 * Opens a file for `user` after checking they may read it, and records the
 * read in the audit trail when it is someone other than the owner (an
 * institution or an administrator looking at an applicant's document).
 */
export async function openFileFor(user: PublicUser, id: string) {
  const db = getDb();
  const file = await getFile(db, id);
  const access = await fileAccess(db, user, file);
  if (!access) {
    // An applicant or institution asking for a file that isn't theirs learns nothing about it, not even that it exists.
    throw new NotFoundError("File");
  }
  const stream = await storageFor(file.storageDriver)?.get(file.storageKey);
  if (!stream) throw new NotFoundError("File content");
  if (access !== "owner") await audit(db, { action: "download", entityType: "file", entityId: file.id, institutionId: file.institutionId, meta: { purpose: file.purpose, as: access } });
  return { file, stream };
}

// ---------------------------------------------------------------------------
// Removing files
// ---------------------------------------------------------------------------

/**
 * Marks files as deleted, inside the caller's transaction, and returns
 * what to hand to `discardBytes` once that transaction has committed.
 * From this point the files open for nobody.
 */
export async function markFilesDeleted(tx: Executor, ids: (string | null | undefined)[]): Promise<StoredFile[]> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (!wanted.length) return [];
  return tx
    .update(files)
    .set({ deletedAt: new Date() })
    .where(and(inArray(files.id, wanted), isNull(files.deletedAt)))
    .returning();
}

/**
 * Removes the content of files already marked deleted. Called after the
 * transaction that marked them has committed, so a rolled-back change
 * never loses a file. A failure here leaves bytes nobody can reach, which
 * is logged and harmless.
 */
export async function discardBytes(removed: StoredFile[]) {
  for (const file of removed) {
    await storageFor(file.storageDriver)
      ?.delete(file.storageKey)
      .catch((err) => logger.warn("Could not remove the content of a deleted file", { fileId: file.id, err }));
  }
}

/** Deletes a file its owner uploaded and no longer wants, provided no record depends on it. */
export async function deleteFile(user: PublicUser, id: string) {
  const db = getDb();
  const file = await getFile(db, id);
  if (file.ownerUserId !== user.id && user.role !== "AOSA_ADMIN") throw new NotFoundError("File");
  const [document] = await db.select({ id: applicationDocuments.id }).from(applicationDocuments).where(eq(applicationDocuments.fileId, id)).limit(1);
  if (document) throw new ConflictError("This file is attached to an application. Remove it from the application first.");
  // A receipt is the evidence for a payment record; it stays as long as the payment does.
  const [receipt] = await db.select({ id: feePayments.id }).from(feePayments).where(eq(feePayments.receiptFileId, id)).limit(1);
  if (receipt) throw new ConflictError("This file is the receipt for a recorded payment, so it can't be deleted.");
  const removed = await db.transaction(async (tx) => {
    const marked = await markFilesDeleted(tx, [id]);
    await audit(tx, { action: "delete", entityType: "file", entityId: id, institutionId: file.institutionId });
    return marked;
  });
  await discardBytes(removed);
}
