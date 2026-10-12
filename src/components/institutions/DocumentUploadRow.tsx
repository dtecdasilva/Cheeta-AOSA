"use client";

import { useRef, useState } from "react";
import type { DocumentView, Outcome } from "@/lib/applications/api";
import type { DocumentRequirement } from "@/lib/institutionDiscovery/data";
import { formatDate } from "@/lib/utils";

/** "PDF, JPG or PNG, up to 2 MB": what the institution accepts for a requirement. */
export function acceptedFiles(requirement: Pick<DocumentRequirement, "fileTypes" | "maxSizeKb">): string {
  const types = requirement.fileTypes.map((t) => t.toUpperCase());
  const list = types.length > 1 ? `${types.slice(0, -1).join(", ")} or ${types[types.length - 1]}` : (types[0] ?? "Any file");
  const mb = requirement.maxSizeKb / 1024;
  return `${list}, up to ${mb >= 1 ? `${Math.round(mb * 10) / 10} MB` : `${requirement.maxSizeKb} KB`}`;
}

/**
 * One document an institution asks for, and the applicant's upload for
 * it: its review status, and the actions the application's state allows.
 * A file is sent to the server as soon as it is chosen; the row then
 * shows what the server stored, or why it refused the file.
 */
export default function DocumentUploadRow({
  requirement,
  document,
  canChange,
  onUpload,
  onRemove,
}: {
  requirement: DocumentRequirement;
  /** The applicant's upload for this requirement, if there is one. */
  document?: DocumentView;
  /** Whether this document can be uploaded, replaced or removed now. */
  canChange: boolean;
  onUpload: (file: File) => Promise<Outcome>;
  onRemove: () => Promise<Outcome>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared so choosing the same file again (after fixing it) is still a change.
    e.target.value = "";
    if (!file || working) return;
    setError(null);
    setWorking("upload");
    const result = await onUpload(file);
    setWorking(null);
    if (!result.ok) setError(result.error);
  }

  async function handleRemove() {
    if (working) return;
    setError(null);
    setWorking("remove");
    const result = await onRemove();
    setWorking(null);
    if (!result.ok) setError(result.error);
  }

  const status = document?.reviewStatus;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[var(--color-ink)]">{requirement.name}</div>
        {requirement.description && <div className="text-xs text-[var(--color-ink-soft)]">{requirement.description}</div>}
        <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
          {!document && <span>Not uploaded</span>}
          {status === "APPROVED" && <span className="text-[var(--color-success-strong)]">Approved</span>}
          {status === "PENDING" && <span className="text-[var(--color-warning-strong)]">Pending review</span>}
          {status === "REJECTED" && <span className="text-[var(--color-danger)]">Rejected{document?.rejectionReason ? `: ${document.rejectionReason}` : ""}</span>}
          {document?.file && (
            <span className="text-[var(--color-ink-faint)]">
              {" "}
              · {document.file.name} · uploaded {formatDate(document.uploadedAt)}
            </span>
          )}
          {!document && <span className="text-[var(--color-ink-faint)]"> · {acceptedFiles(requirement)}</span>}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <input ref={input} type="file" className="hidden" accept={requirement.fileTypes.map((t) => (t === "jpg" ? ".jpg,.jpeg" : `.${t}`)).join(",")} onChange={handleFile} aria-label={`File for ${requirement.name}`} />
        {working ? (
          <span className="text-xs text-[var(--color-ink-soft)]">{working === "upload" ? "Uploading…" : "Removing…"}</span>
        ) : (
          <>
            {document?.file && (
              <a href={document.file.url} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                View
              </a>
            )}
            {canChange && (
              <button type="button" onClick={() => input.current?.click()} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
                {document ? "Replace" : "Upload"}
              </button>
            )}
            {canChange && document && (
              <button type="button" onClick={handleRemove} className="font-medium text-[var(--color-danger)] underline underline-offset-4">
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
