"use client";

import { useState } from "react";
import { Topbar } from "@/components/Topbar";
import DocumentUploadRow from "@/components/institutions/DocumentUploadRow";
import { mockInstitutions, mockDocuments, mockDocumentStates, mockOptionalDocuments, DocumentReviewState } from "@/lib/mockData/institutions";

export default function Page() {
  const [documents, setDocuments] = useState(mockDocuments);
  const [states, setStates] = useState<Record<string, { status: DocumentReviewState; rejectionReason?: string | null }>>(mockDocumentStates);

  function handleUpdate(
    docIdOrName: string,
    payload: { fileName: string | null; uploadedAt: string | null; state?: { status: DocumentReviewState; rejectionReason?: string | null } }
  ) {
    // allow updates by document id (when existing) or by name for optional docs
    const idx = documents.findIndex((d) => d.id === docIdOrName);
    if (idx >= 0) {
      const next = [...documents];
      next[idx] = { ...next[idx], fileName: payload.fileName, uploadedAt: payload.uploadedAt };
      setDocuments(next);
      if (payload.state) setStates((s) => ({ ...s, [next[idx].id]: payload.state } as Record<string, { status: DocumentReviewState; rejectionReason?: string | null }>));
    } else {
      // optional doc by name: synthesize id and state locally
      const key = `opt-${docIdOrName.replace(/\s+/g, "-").toLowerCase()}`;
      setStates((s) => ({ ...s, [key]: payload.state ?? { status: payload.fileName ? ("PENDING" as DocumentReviewState) : ("NOT_UPLOADED" as DocumentReviewState) } } as Record<string, { status: DocumentReviewState; rejectionReason?: string | null }>));
    }
  }

  return (
    <>
      <Topbar title="Institution Upload" description="Upload the documents each institution requires." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>

          {mockInstitutions.map((inst) => (
            <section key={inst.id} className="mb-6 border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{inst.name}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">Required and optional documents</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Required documents</div>
                <div className="divide-y">
                  {inst.requiredDocuments.map((req) => {
                    const doc = documents.find((d) => d.institutionId === inst.id && d.requirementName === req);
                    const state = doc ? states[doc.id] : undefined;
                    return (
                      <DocumentUploadRow
                        key={req}
                        docName={req}
                        uploadedDocument={doc}
                        initialState={state}
                        onUpdate={(p) => handleUpdate(doc?.id ?? req, p)}
                      />
                    );
                  })}
                </div>

                <div className="text-sm font-medium mt-4 mb-2">Optional documents</div>
                <div className="divide-y">
                  {(mockOptionalDocuments[inst.id] || []).map((opt) => {
                    // no preexisting document id for optional docs
                    const key = `opt-${inst.id}-${opt}`;
                    const state = states[key] || { status: "NOT_UPLOADED" };
                    return (
                      <DocumentUploadRow key={key} docName={opt} uploadedDocument={null} initialState={state} onUpdate={(p) => handleUpdate(key, p)} />
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
