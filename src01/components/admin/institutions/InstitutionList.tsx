"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass } from "@/components/Form";
import { ActiveBadge, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatusToggle, usePaged } from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin/useAdminData";
import { institutionStore } from "@/lib/admin/institutions";
import { matchesSearch } from "@/lib/admin/filters";
import { formatCurrency } from "@/lib/utils";

export function InstitutionList() {
  const data = useAdminData();
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [bodyId, setBodyId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () =>
      [...data.institutions]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (i) =>
            (!typeId || i.typeId === typeId) &&
            (!bodyId || i.accreditationBodyId === bodyId) &&
            (!regionId || i.regionId === regionId) &&
            (!status || i.status === status) &&
            matchesSearch(search, [i.name, i.accreditationCode, i.contactName, i.email, i.phone, data.label(i.townId), data.label(i.quarterId)])
        ),
    [data, search, typeId, bodyId, regionId, status]
  );
  const { slice, ...pager } = usePaged(filtered, 15);
  const appCount = (id: string) => data.applications.filter((a) => a.institutionId === id).length;

  function setActive(id: string, active: boolean) {
    institutionStore.update(id, { status: active ? "ACTIVE" : "INACTIVE", updatedAt: new Date().toISOString() });
  }

  return (
    <>
      <PageHeading
        title="Institutions"
        description="Every institution on the platform, with its accreditation, location and contact."
        actions={
          <Link href="/admin/institutions/add" className={ButtonLinkClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add institution
          </Link>
        }
      />

      <FilterBar
        active={!!(search || typeId || bodyId || regionId || status)}
        onClear={() => {
          setSearch("");
          setTypeId("");
          setBodyId("");
          setRegionId("");
          setStatus("");
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Name, accreditation code, contact, town" />
        <FilterSelect label="Institution type" value={typeId} onChange={setTypeId} options={data.options("institution-types")} />
        <FilterSelect label="Accredited by" value={bodyId} onChange={setBodyId} options={data.options("accreditation-bodies")} />
        <FilterSelect label="Region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </FilterBar>

      <ResultCount shown={filtered.length} total={data.institutions.length} noun="institutions" />

      {filtered.length === 0 ? (
        <EmptyState
          message="No institutions match these filters. Clear a filter or add the institution."
          action={
            <Link href="/admin/institutions/add" className={ButtonLinkClass("secondary")}>
              Add institution
            </Link>
          }
        />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>Institution</Th>
                <Th>Accreditation</Th>
                <Th>Location</Th>
                <Th>Contact</Th>
                <Th className="text-right">Web fee</Th>
                <Th className="text-right">Applications</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((i) => (
                <tr key={i.id} className="align-top">
                  <Td>
                    <Link href={`/admin/institutions/${i.id}`} className="font-medium text-[var(--color-ink)] hover:underline">
                      {i.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{data.label(i.typeId)}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{data.paramById.get(i.accreditationBodyId)?.code ?? "—"}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{i.accreditationCode}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">
                      {data.label(i.townId)}
                      {i.quarterId ? `, ${data.label(i.quarterId)}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{data.label(i.regionId)}</p>
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{i.contactName}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{i.phone}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(i.webFee)}</Td>
                  <Td className="text-right tabular-nums">
                    <Link href={`/admin/applications?institution=${i.id}`} className="hover:underline">
                      {appCount(i.id)}
                    </Link>
                  </Td>
                  <Td>
                    <ActiveBadge active={i.status === "ACTIVE"} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 whitespace-nowrap">
                      <Link href={`/admin/institutions/${i.id}`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                        View
                      </Link>
                      <Link href={`/admin/institutions/${i.id}/edit`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                        Edit
                      </Link>
                      <StatusToggle active={i.status === "ACTIVE"} name="this institution" onChange={(next) => setActive(i.id, next)} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          <Pager {...pager} />
        </>
      )}
    </>
  );
}
