"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import { formatFileSize, formatFileTypes, type UploadRequirement } from "@/lib/institution/uploadRequirements";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";
import { useT } from "@/lib/i18n/client";

/**
 * The documents this institution asks applicants to upload, from
 * /api/institution/upload-requirements. The list is this institution's
 * alone: the server never returns, or lets it change, another's.
 *
 * What is listed here as active is exactly what an applicant to this
 * institution is asked for, with the same file types and size limit
 * enforced when they upload.
 */
export default function UploadRequirementsList() {
  const tr = useT();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus, remove } = useInstitutionList<UploadRequirement>("upload-requirements");

  function confirmRemove(r: UploadRequirement) {
    if (window.confirm(tr("Delete the requirement \"{name}\"? This can't be undone.", { name: r.name }))) void remove(r.id);
  }

  return (
    <InstitutionListShell
      title={tr("Upload requirements")}
      addHref="/institution/uploads/requirements/add"
      addLabel={tr("Add requirement")}
      emptyMessage={tr("No upload requirements configured. Applicants aren't asked for any documents.")}
      canEdit={canEdit}
      loading={!items && !error}
      error={error}
      isEmpty={items?.length === 0}
      note={
        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
          {tr("Applicants are asked for every active requirement. A required document must be uploaded before an application can be submitted; an optional one can be left out.")}
        </p>
      }
    >
      {(items ?? []).map((r) => (
        <Row
          key={r.id}
          title={tr(r.name)}
          subtitle={
            <>
              {tr("{value} · max {value2}", { value: formatFileTypes(r.fileTypes), value2: formatFileSize(r.maxSizeKb) })}
              {r.description && <span className="mt-0.5 block">{tr(r.description)}</span>}
              {r.custom && <span className="mt-0.5 block">{tr("Your own document (not on the platform's list)")}</span>}
              {!r.documentTypeId && !r.custom && canEdit && <span className="mt-0.5 block text-[var(--color-warning-strong)]">{tr("No document type chosen yet. Edit it to choose one.")}</span>}
            </>
          }
          meta={
            <div className="flex items-center gap-2">
              {r.required ? <Pill>{tr("Required")}</Pill> : <Pill tone="muted">{tr("Optional")}</Pill>}
              {r.status === "ACTIVE" ? <Pill tone="success">{tr("Active")}</Pill> : <Pill tone="muted">{tr("Inactive")}</Pill>}
            </div>
          }
          actions={
            <>
              <RowAction href={`/institution/uploads/requirements/${r.id}`}>{tr("View")}</RowAction>
              {canEdit && <RowAction href={`/institution/uploads/requirements/${r.id}/edit`}>{tr("Edit")}</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(r.id, r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {r.status === "ACTIVE" ? tr("Deactivate") : tr("Activate")}
                </RowAction>
              )}
              {canEdit && (
                <RowAction tone="danger" onClick={() => confirmRemove(r)}>
                  {tr("Delete")}
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
