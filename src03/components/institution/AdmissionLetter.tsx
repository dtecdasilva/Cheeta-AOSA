"use client";

import React, { useRef } from "react";
import { AdmissionRecord } from "@/lib/mockData/admissions";
import { Application, PersonalInfo } from "@/lib/types";

export default function AdmissionLetter({ admission, application, institution }: { admission: AdmissionRecord; application?: Application | null; institution?: { name?: string; location?: string } }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onPrint() {
    window.print();
  }

  function onDownload() {
    if (!ref.current) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Admission-${admission.applicationId}</title><style>body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial; color:#050505; padding:24px} .letter{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;padding:24px} h1{font-weight:700;letter-spacing:-.01em;} .meta{font-size:13px;color:#6b7280;margin-bottom:12px}</style></head><body>${ref.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admission-${admission.applicationId}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const p: PersonalInfo | null | undefined = application?.personalInfo ?? null;

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-4">
        <button onClick={onDownload} className="text-sm underline">Download</button>
        <button onClick={onPrint} className="text-sm underline">Print</button>
      </div>

      <div ref={ref} className="letter bg-white">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold tracking-tight text-2xl">{institution?.name ?? "Institution"}</h1>
              <div className="meta">{institution?.location ?? "Location"}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">Admission Office</div>
              <div className="meta">Date: {admission.admissionDate ? new Date(admission.admissionDate).toLocaleDateString() : "—"}</div>
            </div>
          </div>
        </header>

        <section className="mb-6">
          <p className="text-sm">Dear {p ? `${p.firstName} ${p.lastName}` : "Applicant"},</p>
          <p className="mt-4 text-sm">We are pleased to inform you of the outcome of your application to {institution?.name ?? "our institution"}.</p>
        </section>

        <section className="mb-6">
          <div className="border-t border-b py-3">
            <div className="flex justify-between text-sm">
              <div>
                <div className="text-xs text-[var(--color-ink-soft)]">Application ID</div>
                <div className="font-medium">{admission.applicationId}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-ink-soft)]">Decision</div>
                <div className="font-medium">{admission.status}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-ink-soft)]">Program</div>
                <div className="font-medium">{admission.programId}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-ink-soft)]">Choice</div>
                <div className="font-medium">{admission.choice}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-medium">Instructions</h2>
          <ol className="mt-2 text-sm list-decimal list-inside text-[var(--color-ink-soft)]">
            <li>Follow the instructions on your applicant dashboard to accept the offer.</li>
            <li>Pay the required fees within the stated deadline.</li>
            <li>Submit any outstanding documents before enrollment.</li>
          </ol>
        </section>

        <footer className="mt-8 text-sm text-[var(--color-ink-soft)]">
          <div>Sincerely,</div>
          <div className="mt-2 font-medium">Admissions Office</div>
          <div className="text-xs">{institution?.name ?? "Institution"}</div>
        </footer>
      </div>
    </div>
  );
}
