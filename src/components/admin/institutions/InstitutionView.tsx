"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass } from "@/components/Form";
import { ActiveBadge, AdminStatusBadge, StatStrip, StatusToggle } from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin/useAdminData";
import { institutionStore } from "@/lib/admin/institutions";
import { useHydrated } from "@/lib/admin/store";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export function InstitutionView({ id }: { id: string }) {
  const tr = useT();
  const data = useAdminData();
  const hydrated = useHydrated();
  const inst = data.institutionById.get(id);

  if (!inst) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <>
        <PageHeading title={tr("Institution")} />
        <EmptyState
          message={tr("This institution doesn't exist. It may have been added in another browser.")}
          action={
            <Link href="/admin/institutions" className={ButtonLinkClass("secondary")}>
              {tr("Back to institutions")}
            </Link>
          }
        />
      </>
    );
  }

  const apps = data.applications.filter((a) => a.institutionId === id);
  const reached = (s: string) => apps.filter((a) => a.history.some((h) => h.status === s)).length;
  const collected = apps.filter((a) => a.payment?.status === "PAID").reduce((s, a) => s + a.payment!.amount, 0);
  const recent = [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const body = data.paramById.get(inst.accreditationBodyId);
  const active = inst.status === "ACTIVE";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/institutions" className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
          {tr("Institutions")}
        </Link>
      </p>
      <PageHeading
        title={tr(inst.name)}
        description={tr("{value} in {value2}, {value3}", { value: data.label(inst.typeId), value2: data.label(inst.townId), value3: data.label(inst.regionId) })}
        actions={
          <>
            <ActiveBadge active={active} />
            <StatusToggle
              active={active}
              name="this institution"
              onChange={(next) => institutionStore.update(inst.id, { status: next ? "ACTIVE" : "INACTIVE", updatedAt: new Date().toISOString() })}
            />
            <Link href={`/admin/institutions/${inst.id}/edit`} className={ButtonLinkClass("primary")}>
              <Pencil className="h-4 w-4" strokeWidth={2} />
              {tr("Edit")}
            </Link>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: tr("Applications"), value: apps.length, href: `/admin/applications?institution=${inst.id}` },
          { label: tr("Submitted"), value: reached("SUBMITTED") },
          { label: tr("Accepted"), value: reached("ACCEPTED") },
          { label: tr("Fees received"), value: formatCurrency(collected) },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <CardHeader title={tr("Institution")} />
          <DescriptionList
            items={[
              { label: tr("Institution type"), value: data.label(inst.typeId) },
              { label: tr("Institution name"), value: inst.name },
              { label: tr("Accredited by"), value: body ? `${body.label} (${body.code})` : "—" },
              { label: tr("Accreditation code"), value: inst.accreditationCode },
              { label: tr("Status"), value: active ? tr("Active") : tr("Inactive") },
              { label: tr("Web fee"), value: inst.webFee === null ? tr("Platform web fee") : formatCurrency(inst.webFee) },
            ]}
          />
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Address and location")} />
          <DescriptionList
            items={[
              { label: tr("Address"), value: inst.address },
              { label: tr("Location"), value: inst.location || "—" },
              { label: tr("Region"), value: data.label(inst.regionId) },
              { label: tr("Town"), value: data.label(inst.townId) },
              { label: tr("Quarter"), value: inst.quarterId ? data.label(inst.quarterId) : "—" },
            ]}
          />
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Contact")} />
          <DescriptionList
            items={[
              { label: tr("Contact name"), value: inst.contactName },
              { label: tr("Phone"), value: <a href={`tel:${inst.phone.replace(/\s/g, "")}`} className="hover:underline">{inst.phone}</a> },
              { label: tr("Email"), value: <a href={`mailto:${inst.email}`} className="hover:underline">{inst.email}</a> },
              {
                label: tr("Website"),
                value: inst.website ? (
                  <a href={inst.website} target="_blank" rel="noreferrer" className="hover:underline">
                    {inst.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                ),
              },
            ]}
          />
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Record")} />
          <DescriptionList
            items={[
              { label: tr("Added"), value: formatDate(inst.createdAt) },
              { label: tr("Last changed"), value: formatDateTime(inst.updatedAt) },
            ]}
          />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Latest applications")}</h2>
      {recent.length === 0 ? (
        <EmptyState message={tr("No one has applied to this institution yet.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Reference")}</Th>
              <Th>{tr("Student")}</Th>
              <Th>{tr("Program")}</Th>
              <Th>{tr("Last update")}</Th>
              <Th>{tr("Status")}</Th>
            </tr>
          </thead>
          <tbody>
            {recent.map((a) => (
              <tr key={a.id}>
                <Td>
                  <Link href={`/admin/applications/${a.id}`} className="text-[var(--color-ink)] underline underline-offset-4">
                    {a.reference}
                  </Link>
                </Td>
                <Td>{data.studentLabel(a.studentId)}</Td>
                <Td className="text-[var(--color-ink-soft)]">{a.programName}</Td>
                <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{formatDate(a.updatedAt)}</Td>
                <Td>
                  <AdminStatusBadge status={a.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </>
  );
}
