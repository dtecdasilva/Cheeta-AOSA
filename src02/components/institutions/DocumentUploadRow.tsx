"use client";

import { useState } from "react";
import { UploadedDocument } from "@/lib/types";
import type { DocumentReviewState } from "@/lib/mockData/institutions";

export default function DocumentUploadRow({
  docName,
  uploadedDocument,
  initialState,
  onUpdate,
}: {
  docName: string;
  uploadedDocument?: UploadedDocument | null;
  initialState: { status: DocumentReviewState; rejectionReason?: string | null } | undefined;
  onUpdate?: (updated: { fileName: string | null; uploadedAt: string | null; state?: { status: DocumentReviewState; rejectionReason?: string | null } }) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(uploadedDocument?.fileName ?? null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(uploadedDocument?.uploadedAt ?? null);
  const [status, setStatus] = useState<DocumentReviewState>(initialState?.status ?? (fileName ? ("PENDING" as DocumentReviewState) : ("NOT_UPLOADED" as DocumentReviewState)));
  const [reason, setReason] = useState<string | null>(initialState?.rejectionReason ?? null);
  const [uploading, setUploading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    // simulate upload
    setTimeout(() => {
      const now = new Date().toISOString();
      setFileName(f.name);
      setUploadedAt(now);
      setStatus("PENDING");
      setReason(null);
      setUploading(false);
      onUpdate?.({ fileName: f.name, uploadedAt: now, state: { status: "PENDING" } });
    }, 700);
  }

  function handleReplace() {
    // trigger file input click
    const input = document.getElementById(`file-input-${docName}`) as HTMLInputElement | null;
    input?.click();
  }

  function handleRemove() {
    setFileName(null);
    setUploadedAt(null);
    setStatus("NOT_UPLOADED");
    setReason(null);
    onUpdate?.({ fileName: null, uploadedAt: null, state: { status: "NOT_UPLOADED" } });
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-dashed last:border-b-0">
      <div>
        <div className="font-medium">{docName}</div>
        <div className="text-xs text-[var(--color-ink-soft)]">
          {status === "APPROVED" && <span className="text-[var(--color-success)]">Approved</span>}
          {status === "PENDING" && <span className="text-[var(--color-amber)]">Pending review</span>}
          {status === "REJECTED" && <span className="text-[var(--color-danger)]">Rejected</span>}
          {status === "NOT_UPLOADED" && <span className="text-[var(--color-ink-soft)]">Not uploaded</span>}
          {reason ? <span className="ml-2 text-xs text-[var(--color-danger)]">Reason: {reason}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {fileName ? (
          <>
            <button className="text-sm text-[var(--color-ink-soft)]" onClick={() => alert(`Viewing ${fileName}`)}>View</button>
            <button className="text-sm text-[var(--color-ink-soft)]" onClick={handleReplace}>Replace</button>
            <button className="text-sm text-[var(--color-danger)]" onClick={handleRemove}>Remove</button>
          </>
        ) : (
          <label className="inline-flex items-center gap-2">
            <input id={`file-input-${docName}`} type="file" className="hidden" onChange={handleFile} />
            <span className="text-sm text-[var(--color-info)] cursor-pointer">Upload</span>
          </label>
        )}

        {uploading && <div className="text-xs text-[var(--color-ink-soft)]">Uploading…</div>}
      </div>
    </div>
  );
}
