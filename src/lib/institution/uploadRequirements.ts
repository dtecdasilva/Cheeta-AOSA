/**
 * An institution's upload requirements: the documents it asks applicants
 * for, and the rules each must meet.
 *
 * A requirement is for one document type from the platform's "Upload
 * types" list (Cheeta administration, Application parameters). The type
 * sets the outer limits (which formats it may be uploaded in and its
 * largest size) and the institution chooses within them. Both the form
 * and the API apply the rules below, so they can't disagree.
 */

/** The formats an upload can be checked to really be, by its content. Anything else is refused whatever a list says. */
export const UPLOAD_FILE_TYPES = ["pdf", "jpg", "png"] as const;
export type UploadFileType = (typeof UPLOAD_FILE_TYPES)[number];

export const UPLOAD_FILE_TYPE_LABELS: Record<UploadFileType, string> = { pdf: "PDF", jpg: "JPG", png: "PNG" };

/** The smallest limit an institution can set; below this nothing legible fits. */
export const MIN_UPLOAD_SIZE_KB = 50;

export interface UploadRequirement {
  id: string;
  institutionId: string;
  /** Null only on a requirement entered before document types were chosen from the list. */
  documentTypeId: string | null;
  /** The document type's name, as applicants see it. */
  name: string;
  description: string;
  required: boolean;
  fileTypes: string[];
  maxSizeKb: number;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

/** A document type an institution can ask for, with the limits it sets. */
export interface DocumentTypeOption {
  id: string;
  label: string;
  /** Formats the type may be uploaded in, limited to those the platform can check. */
  fileTypes: UploadFileType[];
  /** The type's largest size, never more than the platform's own upload limit. */
  maxSizeKb: number;
  /** A certified copy is expected. */
  certified: boolean;
  /** Already on this institution's list (a type is asked for once). */
  inUse: boolean;
}

/** "JPEG" and ".jpg" are the same format as "jpg". */
export function normaliseFileType(value: string): string {
  const v = value.trim().toLowerCase().replace(/^\./, "");
  return v === "jpeg" ? "jpg" : v;
}

/** The formats in a list (as an administrator typed them) that uploads can be checked against, each once. */
export function supportedFileTypes(formats: unknown): UploadFileType[] {
  const wanted = new Set((Array.isArray(formats) ? formats : []).map((f) => normaliseFileType(String(f))));
  return UPLOAD_FILE_TYPES.filter((t) => wanted.has(t));
}

/** A document type's size limit in KB, capped by the platform's. */
export function documentTypeMaxKb(maxSizeMb: unknown, platformMaxKb: number): number {
  const mb = Number(maxSizeMb);
  return Number.isFinite(mb) && mb > 0 ? Math.min(Math.round(mb * 1024), platformMaxKb) : platformMaxKb;
}

/** Checks an institution's choices against the document type's limits. Returns a message per field that is wrong. */
export function validateRequirementLimits(input: { fileTypes: string[]; maxSizeKb: number }, type: Pick<DocumentTypeOption, "label" | "fileTypes" | "maxSizeKb">): Partial<Record<"fileTypes" | "maxSizeKb", string>> {
  const errors: Partial<Record<"fileTypes" | "maxSizeKb", string>> = {};
  const chosen = input.fileTypes.map(normaliseFileType);
  const refused = chosen.filter((t) => !(type.fileTypes as string[]).includes(t));
  if (chosen.length === 0) errors.fileTypes = "Choose at least one file type.";
  else if (refused.length) errors.fileTypes = `${type.label} can be uploaded as ${type.fileTypes.map((t) => UPLOAD_FILE_TYPE_LABELS[t]).join(", ")} only.`;
  if (!Number.isInteger(input.maxSizeKb) || input.maxSizeKb < MIN_UPLOAD_SIZE_KB) errors.maxSizeKb = `Enter a size of at least ${MIN_UPLOAD_SIZE_KB} KB.`;
  else if (input.maxSizeKb > type.maxSizeKb) errors.maxSizeKb = `The largest size allowed for this document is ${formatFileSize(type.maxSizeKb)}.`;
  return errors;
}

/** 2048 → "2 MB", 1536 → "1.5 MB", 500 → "500 KB". */
export function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export function formatFileTypes(types: string[]): string {
  return types.map((t) => t.toUpperCase()).join(", ");
}
