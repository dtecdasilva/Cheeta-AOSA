"use client";

import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default function ProfilePage() {
  const { applications } = useApp();
  const { user } = useAuth();

  const personal = applications.find((a) => a.personalInfo)?.personalInfo;

  return (
    <>
      <Topbar title="Profile" description="Your account details." />
      <main className="px-8 py-8">
        <div className="max-w-xl border border-[var(--color-line)] bg-white">
          <div className="border-b border-[var(--color-line)] px-5 py-3.5">
            <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Account</p>
          </div>
          <dl className="divide-y divide-[var(--color-line)] text-sm">
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Full name</dt>
              <dd className="text-[var(--color-ink)]">{user?.fullName}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Email</dt>
              <dd className="text-[var(--color-ink)]">{user?.email}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Account type</dt>
              <dd className="text-[var(--color-ink)]">{user ? ROLE_LABELS[user.role] : "—"}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Status</dt>
              <dd className="text-[var(--color-ink)]">{user?.status ?? "—"}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Institution type</dt>
              <dd className="text-[var(--color-ink)]">{user?.institutionType ?? "—"}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-[var(--color-ink-soft)]">Mobile number</dt>
              <dd className="text-[var(--color-ink)]">{user?.mobileNumber ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {personal && (
          <div className="mt-6 max-w-xl border border-[var(--color-line)] bg-white">
            <div className="border-b border-[var(--color-line)] px-5 py-3.5">
              <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">
                Personal information on file
              </p>
              <p className="text-xs text-[var(--color-ink-faint)]">Captured from your most recent application</p>
            </div>
            <dl className="grid grid-cols-2 divide-y divide-[var(--color-line)] text-sm">
              <div className="px-5 py-3">
                <dt className="text-[var(--color-ink-soft)]">Date of birth</dt>
                <dd className="text-[var(--color-ink)]">{personal.dateOfBirth || "—"}</dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-[var(--color-ink-soft)]">Nationality</dt>
                <dd className="text-[var(--color-ink)]">{personal.nationality || "—"}</dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-[var(--color-ink-soft)]">Phone</dt>
                <dd className="text-[var(--color-ink)]">{personal.phone || "—"}</dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-[var(--color-ink-soft)]">City</dt>
                <dd className="text-[var(--color-ink)]">{personal.city || "—"}</dd>
              </div>
            </dl>
          </div>
        )}
      </main>
    </>
  );
}
