"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInstitutionList } from "@/lib/institution/api";
import { ADMISSION_STATUS_LABELS, type AdmissionStatus } from "@/lib/admissions/letter";
import type { AdmissionListItem } from "@/lib/admissions/list";
import { formatDate } from "@/lib/utils";
import { TableFrame, Th, Td, Card, Pill } from "@/components/ui";
import { Field, TextInput, SelectInput, SecondaryButton, FormError } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

const STATUS_OPTIONS = ["ALL", "OFFERED", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
const TONE: Record<AdmissionStatus, "neutral" | "success" | "muted" | "warning" | "danger"> = { PENDING: "muted", OFFERED: "warning", ACCEPTED: "success", REJECTED: "muted", WITHDRAWN: "danger" };

/**
 * The institution's Admission List, from /api/institution/admissions: the
 * applicants its published deliberation runs admitted. Needs the
 * "Deliberation List" permission; the server refuses anyone without it.
 */
export default function AdmissionsTable({ initialStatus }: { initialStatus?: string } = {}) {
  const tr = useT();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>((STATUS_OPTIONS as readonly string[]).includes(initialStatus ?? "") ? (initialStatus as (typeof STATUS_OPTIONS)[number]) : "ALL");
  const [type, setType] = useState<"ALL" | "FULL" | "PROVISIONAL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Search waits for typing to pause, so each key press isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "ALL") params.set("status", status);
  if (type !== "ALL") params.set("type", type);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const { items, extra, error } = useInstitutionList<AdmissionListItem, { counts?: Partial<Record<AdmissionStatus, number>> }>("admissions", params.toString());
  const counts = extra?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  function reset() {
    setQuery("");
    setFrom("");
    setTo("");
    setStatus("ALL");
    setType("ALL");
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={tr("Applicant, Application ID or admission No.")}>
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Search")} />
          </Field>
          <Field label={tr("Admitted from")}>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={tr("Admitted to")}>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={tr("Status")}>
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? tr("All") : tr(ADMISSION_STATUS_LABELS[s])}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={tr("Type")}>
            <SelectInput value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="ALL">{tr("All")}</option>
              <option value="FULL">{tr("Full")}</option>
              <option value="PROVISIONAL">{tr("Provisional")}</option>
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-ink-soft)]">
            {items ? tr("Showing {count} of {total} admissions", { count: items.length, total }) : tr("Loading…")} · {counts.OFFERED ?? 0} offered, {counts.ACCEPTED ?? 0}{" "}{tr("taken up,")}{" "}{counts.REJECTED ?? 0} declined{counts.WITHDRAWN ? tr(", {WITHDRAWN} withdrawn", { WITHDRAWN: counts.WITHDRAWN }) : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/institution/admissions/provisional" className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
              {tr("Make a provisional offer")}
            </Link>
            <SecondaryButton onClick={reset}>{tr("Reset filters")}</SecondaryButton>
          </div>
        </div>
      </Card>

      {error && <FormError>{tr(error)}</FormError>}

      <TableFrame>
        <thead>
          <tr>
            <Th>{tr("Admission No.")}</Th>
            <Th>{tr("Applicant")}</Th>
            <Th>{tr("Application ID")}</Th>
            <Th>{tr("Study program")}</Th>
            <Th>{tr("Choice")}</Th>
            <Th>{tr("Admitted")}</Th>
            <Th>{tr("Status")}</Th>
            <Th className="w-32" />
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((r) => (
            <tr key={r.id}>
              <Td className="font-medium">{r.admissionNumber}</Td>
              <Td>{r.applicant.name}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.application.applicationNumber}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.program.name}</Td>
              <Td className="text-[var(--color-ink-soft)]">{r.choice}</Td>
              <Td className="text-[var(--color-ink-soft)]">{formatDate(r.admissionDate)}</Td>
              <Td>
                <Pill tone={TONE[r.status]}>{tr(ADMISSION_STATUS_LABELS[r.status])}</Pill>
                {r.type === "PROVISIONAL" && (
                  <span className="ml-1">
                    <Pill tone="neutral">{tr("Provisional")}</Pill>
                  </span>
                )}
                {r.provisional?.status === "MET" && <span className="ml-1 text-xs text-[var(--color-ink-soft)]">{tr("conditions met")}</span>}
              </Td>
              <Td className="text-right">
                <Link href={`/institution/admissions/${r.id}`} className="text-sm text-[var(--color-ink)] underline">
                  {tr("View")}
                </Link>{" "}
                <Link href={`/institution/admissions/${r.id}/letter`} className="ml-2 text-sm text-[var(--color-ink)] underline">
                  {tr("Letter")}
                </Link>
              </Td>
            </tr>
          ))}

          {items?.length === 0 && (
            <tr>
              <Td colSpan={8} className="py-10 text-center text-sm text-[var(--color-ink-soft)]">
                {total === 0 ? tr("No admissions yet. They are made when a deliberation run is published.") : tr("No admissions match these filters.")}
              </Td>
            </tr>
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}
