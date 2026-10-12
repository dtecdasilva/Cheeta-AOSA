import { bigint, customType, index, pgTable, text } from "drizzle-orm/pg-core";
import { id, ts } from "./_shared";
import { users } from "./identity";
import { institutions } from "./institutions";

/**
 * Metadata for every stored file. The bytes live in the storage driver
 * (src/server/storage) under `storage_key`; nothing else in the database
 * points at storage directly.
 *
 * A file is never served by its storage key or from a public folder:
 * every read goes through /api/files/:id, which checks the signed-in
 * account against what the file is attached to
 * (src/server/storage/files.service.ts). Rows are soft-deleted, so the
 * audit trail's references to a file keep meaning something after the
 * file itself is gone.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    /** The institution the file was uploaded for or by. Recorded for reference; it grants no access on its own to an applicant's documents. */
    institutionId: text("institution_id").references(() => institutions.id),
    /** application-document, payment-receipt, medical-certificate, admission-letter, ... */
    purpose: text("purpose").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** Hex SHA-256 of the content, for integrity checks and duplicate detection. */
    sha256: text("sha256").notNull(),
    /** Which driver holds the bytes ("local", "database"), so files stored under one keep opening after the setting changes. */
    storageDriver: text("storage_driver").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("files_owner_idx").on(t.ownerUserId, t.purpose)]
);

/** PostgreSQL `bytea`. node-postgres returns a Buffer and PGlite a Uint8Array; both are handed on as a Uint8Array. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

/**
 * File bytes, for the "database" storage driver: the content of a file
 * kept in the database itself, beside its metadata. This is what makes
 * uploads last on hosting with no disk of its own (Vercel and other
 * serverless platforms), with nothing else to set up. Only the storage
 * driver reads or writes this table.
 */
export const fileContents = pgTable("file_contents", {
  storageKey: text("storage_key").primaryKey(),
  data: bytea("data").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
