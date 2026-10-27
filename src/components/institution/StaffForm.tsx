"use client";

import { useState } from "react";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { STAFF_PERMISSIONS, STAFF_PERMISSION_INFO, STAFF_ROLE_LABELS, STAFF_ROLES, type StaffMember, type StaffPermission, type StaffRole } from "@/lib/institution/staff";
import { useRecordForm } from "./useRecordForm";
import { useT } from "@/lib/i18n/client";

/**
 * Adds an institution user or edits one, through /api/institution/staff.
 * A new user is sent their sign-in details by email. Permissions are only
 * chosen for an Admission User: an administrator has them all.
 */
export default function StaffForm({ initial }: { initial?: StaffMember }) {
  const tr = useT();
  const { form, set, errors, formError, saving, save, back } = useRecordForm(
    "staff",
    "/institution/staff",
    {
      fullName: initial?.fullName ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      staffNo: initial?.staffNo ?? "",
      position: initial?.position ?? "",
      title: initial?.title ?? "",
      platformTitle: initial?.platformTitle ?? "",
      roleDescription: initial?.roleDescription ?? "",
      role: (initial?.role ?? "INSTITUTION_ADMISSION_USER") as StaffRole,
      status: initial?.status ?? "ACTIVE",
      permissions: (initial?.role === "INSTITUTION_ADMISSION_USER" ? initial.permissions : []) as StaffPermission[],
    },
    initial?.id
  );
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const self = !!initial?.isSelf;

  function toggle(p: StaffPermission, on: boolean) {
    set("permissions", on ? [...form.permissions, p] : form.permissions.filter((x) => x !== p));
  }

  function submit() {
    if (form.role === "INSTITUTION_ADMIN" && initial?.role !== "INSTITUTION_ADMIN" && !confirmAdmin) return setConfirmAdmin(true);
    const { email, status, permissions, ...rest } = form;
    const body = {
      ...rest,
      phone: rest.phone.trim() || null,
      title: rest.title.trim() || null,
      ...(initial ? { status } : { email }),
      ...(form.role === "INSTITUTION_ADMISSION_USER" ? { permissions } : {}),
    };
    // The email is the sign-in name and is fixed once the account exists.
    if (initial) delete (body as Record<string, unknown>).email;
    void save({ fullName: "Enter the person's name.", ...(initial ? {} : { email: "Enter their email address." }), staffNo: "Enter a staff ID.", position: "Enter their position." }, body);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label={tr("Title")} error={errors.title}>
          <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={tr("Dr.")} maxLength={40} />
        </Field>
        <Field label={tr("Full name")} required error={errors.fullName}>
          <TextInput value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={200} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("Email")} required={!initial} error={errors.email} hint={initial ? tr("Their sign-in name; it can't be changed.") : tr("Their sign-in details are sent here.")}>
          <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!!initial} />
        </Field>
        <Field label={tr("Phone")} error={errors.phone}>
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
        </Field>
        <Field label={tr("Staff ID")} required error={errors.staffNo}>
          <TextInput value={form.staffNo} onChange={(e) => set("staffNo", e.target.value)} placeholder={tr("STAFF-004")} maxLength={40} />
        </Field>
        <Field label={tr("Position")} required error={errors.position}>
          <TextInput value={form.position} onChange={(e) => set("position", e.target.value)} placeholder={tr("Admissions Officer")} maxLength={120} />
        </Field>
        <Field label={tr("User platform title")} error={errors.platformTitle} hint={tr("Their role on this platform.")}>
          <TextInput value={form.platformTitle} onChange={(e) => set("platformTitle", e.target.value)} placeholder={tr("Payment & Upload Agent")} maxLength={120} />
        </Field>
      </div>
      <Field label={tr("User role description")} error={errors.roleDescription}>
        <TextArea rows={2} value={form.roleDescription} onChange={(e) => set("roleDescription", e.target.value)} placeholder={tr("Verifies the payment and upload status of all submitted applications.")} maxLength={500} />
      </Field>

      <Field label={tr("Role")} required error={errors.role} hint={self ? tr("You can't change your own role.") : form.role === "INSTITUTION_ADMIN" ? tr("Can do everything, including managing staff.") : tr("Can only do what is ticked below.")}>
        <SelectInput value={form.role} onChange={(e) => (set("role", e.target.value as StaffRole), setConfirmAdmin(false))} disabled={self}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(STAFF_ROLE_LABELS[r])}
            </option>
          ))}
        </SelectInput>
      </Field>

      {form.role === "INSTITUTION_ADMISSION_USER" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-[var(--color-ink)]">{tr("Permissions")}</legend>
          <div className="space-y-2">
            {STAFF_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={form.permissions.includes(p)} onChange={(e) => toggle(p, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                <span>
                  <span className="text-[var(--color-ink)]">{tr(STAFF_PERMISSION_INFO[p].label)}</span>
                  <span className="block text-xs text-[var(--color-ink-soft)]">{tr(STAFF_PERMISSION_INFO[p].grants)}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.permissions && <p className="mt-1 text-xs text-[var(--color-danger)]">{tr(errors.permissions)}</p>}
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">{tr("With none ticked, they can view applications awaiting review and add comments.")}</p>
        </fieldset>
      )}

      {initial && !self && (
        <Field label={tr("Status")} error={errors.status} hint={tr("An inactive account is signed out and can't sign in.")}>
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as "ACTIVE" | "INACTIVE")}>
            <option value="ACTIVE">{tr("Active")}</option>
            <option value="INACTIVE">{tr("Inactive")}</option>
          </SelectInput>
        </Field>
      )}

      {confirmAdmin && <FormError>{tr("An institution administrator can do everything, including adding and removing staff. Save again to confirm.")}</FormError>}
      {formError && <FormError>{tr(formError)}</FormError>}
      <div className="flex items-center gap-2">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? tr("Saving…") : initial ? tr("Save") : tr("Add and send sign-in details")}
        </PrimaryButton>
        <SecondaryButton onClick={back}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
