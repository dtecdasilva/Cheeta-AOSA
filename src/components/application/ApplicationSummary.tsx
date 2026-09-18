"use client";

import Link from "next/link";
import { Application, Institution, UploadedDocument, PaymentInfo } from "@/lib/types";
import { ReviewStep } from "@/components/steps/ReviewStep";
import { StatusBadge } from "@/components/StatusBadge";

export default function ApplicationSummary({
  application,
  institutions,
  documentStates,
  payments,
}: {
  application: Application;
  institutions: Institution[];
  documentStates: Record<string, { status: string; rejectionReason?: string | null }>;
  payments: Record<string, PaymentInfo | null>;
}) {
  const docsByInstitution: Record<string, UploadedDocument[]> = {};
  application.documents.forEach((d) => {
    docsByInstitution[d.institutionId] ??= [];
    docsByInstitution[d.institutionId].push(d);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <div className="border border-[var(--color-line)] bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 font-[var(--font-display)] text-base text-[var(--color-ink)]">Demographic</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{application.personalInfo ? `${application.personalInfo.firstName} ${application.personalInfo.lastName}` : 'Not provided'}</p>
              </div>
              <Link href="/student/application/demographic" className="text-sm text-[var(--color-ink)] underline">Edit</Link>
            </div>
          </div>

          <div className="border border-[var(--color-line)] bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 font-[var(--font-display)] text-base text-[var(--color-ink)]">Education</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{application.education.length} records</p>
              </div>
              <Link href="/student/application/education" className="text-sm text-[var(--color-ink)] underline">Edit</Link>
            </div>
          </div>

          <div className="border border-[var(--color-line)] bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 font-[var(--font-display)] text-base text-[var(--color-ink)]">Examinations & Results</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{application.examinations.length} records</p>
              </div>
              <Link href="/student/application/examinations" className="text-sm text-[var(--color-ink)] underline">Edit</Link>
            </div>
          </div>

          <div className="border border-[var(--color-line)] bg-white p-5">
            <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Institutions & Program Choices</p>
            <div className="space-y-4">
              {institutions.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">{inst.name}</p>
                    <p className="text-sm text-[var(--color-ink-soft)]">{inst.location}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={application.perInstitutionStatus[inst.id] ?? "INCOMPLETE"} />
                    <Link href="/student/institutions/summary" className="text-sm text-[var(--color-ink)] underline">Edit</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[var(--color-line)] bg-white p-5">
            <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Uploads</p>
            <div className="space-y-3">
              {institutions.map((inst) => {
                const docs = docsByInstitution[inst.id] ?? [];
                const uploaded = docs.filter((d) => d.fileName).length;
                return (
                  <div key={inst.id} className="border-t border-[var(--color-line)] pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--color-ink)]">{inst.name}</p>
                      <p className="text-sm text-[var(--color-ink-soft)]">{uploaded} of {inst.requiredDocuments.length} uploaded</p>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-soft)] pl-4">
                      {inst.requiredDocuments.map((r) => {
                        const doc = docs.find((d) => d.requirementName === r);
                        const state = doc ? documentStates[doc.id]?.status : "NOT_UPLOADED";
                        return (
                          <li key={r} className="flex items-center justify-between">
                            <span>{r}</span>
                            <span className="text-xs">{state}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              <div className="mt-3">
                <Link href="/student/institutions/upload" className="text-sm text-[var(--color-ink)] underline">Manage uploads</Link>
              </div>
            </div>
          </div>

          <div className="border border-[var(--color-line)] bg-white p-5">
            <p className="mb-3 font-[var(--font-display)] text-base text-[var(--color-ink)]">Fees & Payments</p>
            <div className="space-y-2 text-sm text-[var(--color-ink-soft)]">
              {institutions.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-ink)]">{inst.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">Application fee + web fee</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--color-ink)]">{inst.applicationFee + inst.webFee}</p>
                    <p className="text-xs">{payments[inst.id] ? `Paid: ${payments[inst.id]?.reference}` : "Not paid"}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link href="/student/fees/summary" className="text-sm text-[var(--color-ink)] underline">View fees</Link>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="sticky top-20 w-64 border border-[var(--color-line)] bg-white p-5">
            <p className="mb-3 font-[var(--font-display)] text-sm text-[var(--color-ink)]">Quick review</p>
            <ReviewStep application={application} onFinalSubmit={() => alert('Final submit (mock)')} />
          </div>
        </aside>
      </div>
    </div>
  );
}
