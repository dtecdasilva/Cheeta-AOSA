"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import { STAFF_PERMISSION_INFO, STAFF_ROLE_LABELS, type StaffMember } from "@/lib/institution/staff";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";

/**
 * The institution's users, from /api/institution/staff. Only an
 * institution administrator can add, change or deactivate them; the
 * server refuses anyone else.
 */
export default function StaffList() {
  const tr = useT();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus } = useInstitutionList<StaffMember>("staff");

  function toggle(s: StaffMember) {
    const next = s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (next === "INACTIVE" && !window.confirm(tr("Deactivate {fullName}? They will be signed out and can't sign in until reactivated.", { fullName: s.fullName }))) return;
    void setStatus(s.id, next);
  }

  return (
    <InstitutionListShell
      title={tr("Manage Users")}
      addHref="/institution/staff/add"
      addLabel={tr("Add staff member")}
      emptyMessage={tr("No staff members yet.")}
      canEdit={canEdit}
      loading={!items && !error}
      error={error}
      isEmpty={items?.length === 0}
      note={
        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
          {tr("Institution administrators can do everything, including managing staff. Admission users can only do what is ticked for them; an institution can have up to 10 active admission users.")}
        </p>
      }
    >
      {(items ?? []).map((s) => (
        <Row
          key={s.id}
          title={`${s.title ? `${s.title} ` : ""}${s.fullName}${s.isSelf ? " (you)" : ""}`}
          subtitle={
            <>
              {tr(s.staffNo)} · {tr(s.position)}
              {s.platformTitle ? ` · ${s.platformTitle}` : ""} · {s.email}
              {s.roleDescription && <span className="mt-0.5 block">{s.roleDescription}</span>}
              <span className="mt-0.5 block">{s.role === "INSTITUTION_ADMIN" ? tr("All permissions") : s.permissions.length ? s.permissions.map((p) => STAFF_PERMISSION_INFO[p].label).join(", ") : tr("No permissions yet: can view and comment on applications only")}</span>
            </>
          }
          meta={
            <div className="flex items-center gap-2">
              <Pill tone={s.role === "INSTITUTION_ADMIN" ? "neutral" : "muted"}>{tr(STAFF_ROLE_LABELS[s.role])}</Pill>
              {s.status === "ACTIVE" ? <Pill tone="success">{tr("Active")}</Pill> : <Pill tone="muted">{tr("Inactive")}</Pill>}
            </div>
          }
          actions={
            <>
              <RowAction href={`/institution/staff/${s.id}`}>{tr("View")}</RowAction>
              {canEdit && <RowAction href={`/institution/staff/${s.id}/edit`}>{tr("Edit")}</RowAction>}
              {canEdit && !s.isSelf && (
                <RowAction tone="muted" onClick={() => toggle(s)}>
                  {s.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
