"use client";

import { useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { UploadedDocument } from "@/lib/types";
import { PrimaryButton, SecondaryButton } from "@/components/Form";
import { institutions } from "@/lib/data";
import { uid } from "@/lib/utils";

export function DocumentsStep({
  institutionIds,
  documents,
  editable,
  onSave,
  onSubmit,
}: {
  institutionIds: string[];
  documents: UploadedDocument[];
  editable: boolean;
  onSave: (documents: UploadedDocument[]) => void;
  onSubmit: () => void;
}) {
  const required: UploadedDocument[] = institutionIds.flatMap((instId) => {
    const inst = institutions.find((i) => i.id === instId);
    if (!inst) return [];
    return inst.requiredDocuments.map((name) => {
      const existing = documents.find((d) => d.institutionId === instId && d.requirementName === name);
      return existing ?? { id: uid("doc"), institutionId: instId, requirementName: name, fileName: null, uploadedAt: null };
    });
  });

  const [rows, setRows] = useState<UploadedDocument[]>(required);
  const [saved, setSaved] = useState(false);

  function attach(id: string, fileName: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, fileName, uploadedAt: new Date().toISOString() } : r)));
    setSaved(false);
  }

  const isComplete = rows.every((r) => r.fileName);

  return (
    <div className="space-y-6">
      {institutionIds.map((instId) => {
        const inst = institutions.find((i) => i.id === instId);
        if (!inst) return null;
        const rowsForInst = rows.filter((r) => r.institutionId === instId);
        return (
          <div key={instId} className="border border-[var(--color-line)] bg-white">
            <div className="border-b border-[var(--color-line)] px-5 py-3.5">
              <p className="font-medium text-[var(--color-ink)]">{inst.name}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">Institution-specific requirements</p>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {rowsForInst.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {doc.fileName ? (
                      <FileCheck2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
                    ) : (
                      <UploadCloud className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
                    )}
                    <div>
                      <p className="text-sm text-[var(--color-ink)]">{doc.requirementName}</p>
                      {doc.fileName && <p className="text-xs text-[var(--color-ink-faint)]">{doc.fileName}</p>}
                    </div>
                  </div>
                  {editable && (
                    <label className="cursor-pointer border border-[var(--color-line-strong)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]">
                      {doc.fileName ? "Replace" : "Upload"}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) attach(doc.id, file.name);
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {editable && (
        <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <SecondaryButton
            type="button"
            onClick={() => {
              onSave(rows);
              setSaved(true);
            }}
          >
            Save progress
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!isComplete}
            onClick={() => {
              onSave(rows);
              onSubmit();
            }}
          >
            Submit and continue
          </PrimaryButton>
          {saved && <span className="text-xs text-[var(--color-success)]">Saved</span>}
        </div>
      )}
    </div>
  );
}
