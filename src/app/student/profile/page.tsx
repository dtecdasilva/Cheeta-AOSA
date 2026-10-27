"use client";

import { useEffect, useState } from "react";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface Registration {
  registrationNo: string | null;
  email: string;
  institutionType: string | null;
  mobileNumber: string | null;
  registrationStatus: string;
  emailVerified: boolean;
  registeredAt: string;
}

type Profile = Record<string, string | null | undefined>;

/** The applicant's account (GET /api/student/registration) and the personal details on file (GET /api/student/demographic). */
export default function ProfilePage() {
  const tr = useT();
  const { user } = useAuth();
  const [reg, setReg] = useState<Registration | null>(null);
  const [personal, setPersonal] = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/student/registration", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setReg(b.data))
      .catch(() => undefined);
    fetch("/api/student/demographic", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.profile && setPersonal(b.profile))
      .catch(() => undefined);
  }, []);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 px-5 py-3">
      <dt className="text-[var(--color-ink-soft)]">{tr(label)}</dt>
      <dd className="text-right text-[var(--color-ink)]">{value || "—"}</dd>
    </div>
  );

  return (
    <>
      <Topbar title={tr("Profile")} description={tr("Your account details.")} />
      <main className={PAGE_MAIN_CLASS}>
        <div className="max-w-xl overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-line)] px-5 py-3.5">
            <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Account")}</p>
          </div>
          <dl className="divide-y divide-[var(--color-line)] text-sm">
            {row("Full name", user?.fullName)}
            {row("Email", reg?.email ?? user?.email)}
            {row("Registration no.", reg?.registrationNo)}
            {row("Account type", user ? tr(ROLE_LABELS[user.role]) : null)}
            {row("Registration status", reg ? tr(reg.emailVerified ? "Email verified" : "Awaiting email verification") : null)}
            {row("Institution type", reg?.institutionType ? tr(reg.institutionType) : null)}
            {row("Mobile telephone number", reg?.mobileNumber)}
            {row("Registered", reg?.registeredAt ? formatDate(reg.registeredAt) : null)}
          </dl>
        </div>

        {personal && (
          <div className="mt-6 max-w-xl overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-line)] px-5 py-3.5">
              <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Personal information on file")}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">{tr("From your demographic information.")}</p>
            </div>
            <dl className="divide-y divide-[var(--color-line)] text-sm">
              {row("Full name as shown on birth certificate", personal.fullNameOnBirthCertificate)}
              {row("Date of birth", personal.dateOfBirth ? formatDate(personal.dateOfBirth) : null)}
              {row("Nationality", personal.nationality ? tr(personal.nationality) : null)}
              {row("Town of residence", personal.townOfResidence)}
            </dl>
          </div>
        )}
      </main>
    </>
  );
}
