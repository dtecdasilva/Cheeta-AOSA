import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";
import { id, ts } from "./_shared";
import { users } from "./identity";
import { institutions } from "./institutions";

/**
 * Metadata for every stored file. The bytes live in the storage driver
 * (src/server/storage) under `storage_key`; nothing else in the database
 * points at storage directly. Rows are soft-deleted so documents already
 * attached to a submitted application stay traceable.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    /** Set when the file belongs to an institution (admission letters, logos). */
    institutionId: text("institution_id").references(() => institutions.id),
    /** application-document, payment-receipt, medical-certificate, admission-letter, ... */
    purpose: text("purpose").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** Hex SHA-256 of the content, for integrity checks and duplicate detection. */
    sha256: text("sha256").notNull(),
    storageDriver: text("storage_driver").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("files_owner_idx").on(t.ownerUserId, t.purpose)]
);
