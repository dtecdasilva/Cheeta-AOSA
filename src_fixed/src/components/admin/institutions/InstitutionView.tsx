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

export function InstitutionView({ id }: { id: string }) {
  const data = useAdminData();
  const hydrated = useHydrated();
  const inst = data.institutionById.get(id);

  if (!inst) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <>
        <PageHeading title="Institution" />
        <EmptyState
          message="This institution doesn't exist. It may have been added in another browser."
          action={
            <Link href="/admin/institutions" className={ButtonLinkClass("secondary")}>
              Back to institutions
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
          Institutions
        </Link>
      </p>
      <PageHeading
        title={inst.name}
        description={`${data.label(inst.typeId)} in ${data.label(inst.townId)}, ${data.label(inst.regionId)}`}
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
              Edit
            </Link>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: "Applications", value: apps.length, href: `/admin/applications?institution=${inst.id}` },
          { label: "Submitted", value: reached("SUBMITTED") },
          { label: "Accepted", value: reached("ACCEPTED") },
          { label: "Fees received", value: formatCurrency(collected) },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <CardHeader title="Institution" />
          <DescriptionList
            items={[
              { label: "Institution type", value: data.label(inst.typeId) },
              { label: "Institution name", value: inst.name },
              { label: "Accredited by", value: body ? `${body.label} (${body.code})` : "—" },
              { label: "Accreditation code", value: inst.accreditationCode },
              { label: "Status", value: active ? "Active" : "Inactive" },
              { label: "Web fee", value: formatCurrency(inst.webFee) },
            ]}
          />
        </Card>
        <Card padded={false}>
          <CardHeader title="Address and location" />
          <DescriptionList
            items={[
              { label: "Address", value: inst.address },
              { label: "Location", value: inst.location || "—" },
              { label: "Region", value: data.label(inst.regionId) },
              { label: "Town", value: data.label(inst.townId) },
              { label: "Quarter", value: inst.quarterId ? data.label(inst.quarterId) : "—" },
            ]}
          />
        </Card>
        <Card padded={false}>
          <CardHeader title="Contact" />
          <DescriptionList
            items={[
              { label: "Contact name", value: inst.contactName },
              { label: "Phone", value: <a href={`tel:${inst.phone.replace(/\s/g, "")}`} className="hover:underline">{inst.phone}</a> },
              { label: "Email", value: <a href={`mailto:${inst.email}`} className="hover:underline">{inst.email}</a> },
              {
                label: "Website",
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
          <CardHeader title="Record" />
          <DescriptionList
            items={[
              { label: "Added", value: formatDate(inst.createdAt) },
              { label: "Last changed", value: formatDateTime(inst.updatedAt) },
            ]}
          />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-[var(--font-display)] text-xl text-[var(--color-ink)]">Latest applications</h2>
      {recent.length === 0 ? (
        <EmptyState message="No one has applied to this institution yet." />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Student</Th>
              <Th>Program</Th>
              <Th>Last update</Th>
              <Th>Status</Th>
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
