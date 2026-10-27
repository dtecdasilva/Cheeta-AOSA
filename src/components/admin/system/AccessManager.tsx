"use client";

import { Check, Minus } from "lucide-react";
import { RecordManager } from "@/components/admin/RecordManager";
import { ToneBadge } from "@/components/admin/ui";
import { SectionHeading, TableFrame, Td, Th } from "@/components/ui";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { accountStore, PERMISSIONS, sendAccountPasswordReset, type PlatformAccount } from "@/lib/admin/access";
import { institutionStore } from "@/lib/admin/institutions";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const isInstitutionRole = (r: Role) => r === "INSTITUTION_ADMIN" || r === "INSTITUTION_ADMISSION_USER";
const ROLE_TONE: Record<Role, "info" | "amber" | "success" | "neutral"> = {
  AOSA_ADMIN: "amber",
  INSTITUTION_ADMIN: "info",
  INSTITUTION_ADMISSION_USER: "info",
  STUDENT: "neutral",
};

export function AccessManager() {
  const tr = useT();
  const institutions = institutionStore.useItems();
  const institutionName = (id: string) => institutions.find((i) => i.id === id)?.name ?? "—";
  const institutionOptions = [...institutions].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({ value: i.id, label: i.name }));

  return (
    <RecordManager<PlatformAccount>
      title={tr("Access management")}
      description={tr("Every account that can sign in to the platform, the portal its role opens, and what each role is allowed to do.")}
      singular={tr("account")}
      plural={tr("accounts")}
      store={accountStore}
      idPrefix="usr"
      nameOf={(a) => a.fullName}
      sort={(a, b) => ROLES.indexOf(b.role) - ROLES.indexOf(a.role) || a.fullName.localeCompare(b.fullName)}
      searchPlaceholder={tr("Name, email or phone")}
      searchText={(a) => [a.fullName, a.email, a.phone, institutionName(a.institutionId)]}
      filters={[
        { key: "role", label: tr("Role"), options: roleOptions, get: (a) => a.role },
        { key: "inst", label: tr("Institution"), options: institutionOptions, get: (a) => a.institutionId },
      ]}
      stats={(items) => [
        { label: tr("Accounts"), value: items.length },
        { label: tr("AOSA administrators"), value: items.filter((a) => a.role === "AOSA_ADMIN").length },
        { label: tr("Institution users"), value: items.filter((a) => isInstitutionRole(a.role)).length },
        { label: tr("Admins without 2-step"), value: items.filter((a) => a.role !== "STUDENT" && a.status === "ACTIVE" && !a.mfa).length, detail: tr("Active staff accounts") },
      ]}
      blank={() => ({
        id: "",
        fullName: "",
        email: "",
        phone: "",
        role: "INSTITUTION_ADMISSION_USER",
        institutionId: "",
        status: "ACTIVE",
        mfa: false,
        lastSignInAt: "",
        createdAt: "",
        updatedAt: "",
      })}
      fields={[
        { key: "fullName", label: tr("Full name"), kind: "text", required: true },
        { key: "email", label: tr("Email"), kind: "email", required: true, hint: tr("Their sign-in. An invitation with a temporary code is sent here.") },
        { key: "phone", label: tr("Mobile number"), kind: "text", placeholder: tr("+237 6XX XXX XXX") },
        { key: "role", label: tr("Role"), kind: "select", required: true, options: roleOptions, resets: ["institutionId"] },
        { key: "institutionId", label: tr("Institution"), kind: "select", required: true, options: institutionOptions, showIf: (a) => isInstitutionRole(a.role) },
        { key: "mfa", label: tr("Two-step sign-in"), kind: "checkbox", checkboxLabel: tr("Require a one-time code at sign-in"), showIf: (a) => a.role !== "STUDENT" },
      ]}
      validate={(a, all, editingId) => ({
        email: all.some((x) => x.id !== editingId && x.email.toLowerCase() === a.email.toLowerCase()) ? tr("Another account already uses this email.") : undefined,
      })}
      beforeSave={(a) => ({ ...a, email: a.email.toLowerCase(), createdAt: a.createdAt || new Date().toISOString() })}
      deactivateBlocker={(a) => {
        const otherAdmins = accountStore.getAll().filter((x) => x.role === "AOSA_ADMIN" && x.status === "ACTIVE" && x.id !== a.id);
        return a.role === "AOSA_ADMIN" && otherAdmins.length === 0 ? tr("The last active administrator can't be deactivated.") : null;
      }}
      rowActions={(a, notify) =>
        a.status === "ACTIVE" && (
          <button type="button" onClick={async () => notify((await sendAccountPasswordReset(a.id)) ?? tr("Password reset link sent to {email}.", { email: a.email }))} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
            {tr("Reset password")}
          </button>
        )
      }
      columns={[
        {
          label: tr("Account"),
          render: (a) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(a.fullName)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{a.email}</p>
            </>
          ),
        },
        {
          label: tr("Role"),
          render: (a) => (
            <>
              <ToneBadge tone={ROLE_TONE[a.role]}>{tr(ROLE_LABELS[a.role])}</ToneBadge>
              {isInstitutionRole(a.role) && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{tr(institutionName(a.institutionId))}</p>}
            </>
          ),
        },
        {
          label: "2-step",
          render: (a) =>
            a.role === "STUDENT" ? <span className="text-[var(--color-ink-faint)]">—</span> : a.mfa ? tr("On") : <span className="text-[var(--color-warning-strong)]">{tr("Off")}</span>,
        },
        { label: tr("Last sign-in"), render: (a) => (a.lastSignInAt ? formatDateTime(a.lastSignInAt) : <span className="text-[var(--color-ink-faint)]">{tr("Never")}</span>) },
      ]}
    >
      <section className="mt-10">
        <SectionHeading title={tr("Roles and permissions")} description={tr("Fixed by the platform. Each role signs in to its own portal and can only reach that portal's pages.")} />
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Permission")}</Th>
              {ROLES.map((r) => (
                <Th key={r} className="text-center">
                  {tr(ROLE_LABELS[r])}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.key}>
                <Td className="text-[var(--color-ink)]">{tr(p.label)}</Td>
                {ROLES.map((r) => (
                  <Td key={r} className="text-center">
                    {p.roles.includes(r) ? (
                      <Check className="mx-auto h-4 w-4 text-[var(--color-success)]" strokeWidth={2.25} aria-label={tr("Allowed")} />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.5} aria-label={tr("Not allowed")} />
                    )}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </section>
    </RecordManager>
  );
}
