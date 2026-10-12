"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Field, FormError, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { AdminStatusBadge, Pager, ToneBadge } from "@/components/admin/ui";
import { Card, TableFrame, Td, Th } from "@/components/ui";
import { ADMIN_STATUS_LABELS, ALL_STATUSES } from "@/lib/admin/status";
import { useInstitutionApplications, type ApplicationFilters, type PaymentCheck } from "@/lib/institution/applications";
import type { ApplicationStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const PAYMENT_CHECK: Record<PaymentCheck, { label: string; tone: "neutral" | "success" | "danger" }> = {
  PENDING: { label: "Payment to verify", tone: "neutral" },
  VERIFIED: { label: "Payment verified", tone: "success" },
  NOT_RECEIVED: { label: "Payment not received", tone: "danger" },
};

const EMPTY: ApplicationFilters = { status: "", q: "", reference: "", from: "", to: "" };

/**
 * Applications to this institution, from /api/institution/applications.
 * The server returns only this institution's, and shows an applicant
 * whose fee isn't approved yet as a masked name only; searching by name
 * can't find them either. `fixedStatus` pins the list to one status (the
 * Acknowledged and Rejected pages).
 */
export default function ApplicationsTable({ fixedStatus }: { fixedStatus?: ApplicationStatus }) {
  const [form, setForm] = useState<ApplicationFilters>({ ...EMPTY, status: fixedStatus ?? "" });
  const [filters, setFilters] = useState<ApplicationFilters>(form);
  const [page, setPage] = useState(1);
  const { rows, counts, total, pages, error } = useInstitutionApplications(filters, page);

  // Typing filters the list a moment after the typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(form);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [form]);

  const set = (k: keyof ApplicationFilters, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Applicant name or email">
            <TextInput value={form.q} onChange={(e) => set("q", e.target.value)} placeholder="Search applicants" />
          </Field>
          <Field label="Application ID or reference">
            <TextInput value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="AOSA-2026-000123" />
          </Field>
          <Field label="Submitted from">
            <TextInput type="date" value={form.from} onChange={(e) => set("from", e.target.value)} />
          </Field>
          <Field label="Submitted to">
            <TextInput type="date" value={form.to} onChange={(e) => set("to", e.target.value)} />
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => set("status", e.target.value)} disabled={!!fixedStatus}>
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ADMIN_STATUS_LABELS[s]} ({counts[s] ?? 0})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-ink-soft)]" aria-live="polite">
            Showing {rows?.length ?? 0} of {total}
            {total !== all ? ` (${all} in all)` : ""} application{total === 1 ? "" : "s"}
          </p>
          <SecondaryButton
            onClick={() => {
              setForm({ ...EMPTY, status: fixedStatus ?? "" });
            }}
          >
            Reset filters
          </SecondaryButton>
        </div>
      </Card>

      {error && <FormError>{error}</FormError>}
      <TableFrame>
        <thead>
          <tr>
            <Th className="w-44">Application</Th>
            <Th>Applicant</Th>
            <Th className="w-28">Submitted</Th>
            <Th className="w-52">Status</Th>
            <Th>Review</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {!rows ? (
            <tr>
              <Td colSpan={6} className="py-10 text-center text-sm text-[var(--color-ink-soft)]">
                {error ? "" : "Loading applications…"}
              </Td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <Td colSpan={6} className="py-10 text-center text-sm text-[var(--color-ink-soft)]">
                {all === 0 ? "No applications yet." : "No applications match these filters."}
              </Td>
            </tr>
          ) : (
            rows.map((a) =>
              a.masked ? (
                <tr key={a.id}>
                  <Td className="text-[var(--color-ink-soft)]">{a.reference}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {a.applicant}
                    </span>
                  </Td>
                  <Td colSpan={4}>
                    <ToneBadge tone="info">Awaiting payment</ToneBadge>
                  </Td>
                </tr>
              ) : (
                <tr key={a.id}>
                  <Td>
                    <p className="text-[var(--color-ink)]">{a.applicationNumber ?? a.reference}</p>
                    {a.applicationNumber && <p className="text-xs text-[var(--color-ink-faint)]">{a.reference}</p>}
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{a.applicant}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{a.programName ?? "No program chosen"}</p>
                  </Td>
                  <Td className="text-[var(--color-ink-soft)]">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</Td>
                  <Td>
                    <AdminStatusBadge status={a.status} />
                  </Td>
                  <Td>
                    {a.documents ? (
                      <div className="space-y-1">
                        <ToneBadge tone={PAYMENT_CHECK[a.paymentVerification].tone}>{PAYMENT_CHECK[a.paymentVerification].label}</ToneBadge>
                        <p className="text-xs text-[var(--color-ink-soft)]">
                          Documents: {a.documents.approved} approved
                          {a.documents.pending ? `, ${a.documents.pending} to review` : ""}
                          {a.documents.rejected ? `, ${a.documents.rejected} rejected` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-soft)]">Not submitted yet</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/institution/applications/${a.id}`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      {a.documents ? "Review" : "View"}
                      <span className="sr-only"> {a.applicant}</span>
                    </Link>
                  </Td>
                </tr>
              )
            )
          )}
        </tbody>
      </TableFrame>
      <Pager page={page} pages={pages} setPage={setPage} />
    </div>
  );
}
