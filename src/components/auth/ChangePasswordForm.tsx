"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, TextInput, PrimaryButton, FormError } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

/** Choosing a new password: after signing in with an emailed temporary code (`required`), or any time from a portal. */
export function ChangePasswordForm({ required, home }: { required: boolean; home: string }) {
  const tr = useT();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (password.length < 8) return setErrors({ password: tr("Password must be at least 8 characters.") });
    if (password !== confirm) return setErrors({ confirm: tr("Passwords do not match.") });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: required ? undefined : current, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) setErrors(Object.fromEntries(Object.entries(data.fieldErrors as Record<string, string>).map(([k, m]) => [k, tr(m)])));
        else setError(data.error ?? tr("Your password could not be changed."));
        return;
      }
      // A full load, so every part of the portal starts from the new session.
      window.location.assign(data.redirectTo ?? home);
    } catch {
      setError(tr("Something went wrong. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {!required && (
        <Field label={tr("Current password")} htmlFor="current" required error={errors.currentPassword}>
          <TextInput id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
      )}
      <Field label={tr("New password")} htmlFor="password" required hint={tr("At least 8 characters.")} error={errors.password}>
        <TextInput id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field label={tr("Confirm new password")} htmlFor="confirm" required error={errors.confirm}>
        <TextInput id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error && <FormError>{tr(error)}</FormError>}
      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? tr("Saving…") : tr("Save password")}
      </PrimaryButton>
      {!required && (
        <p className="text-center text-sm">
          <Link href={home} className="text-[var(--color-ink-soft)] underline underline-offset-4">
            {tr("Back")}
          </Link>
        </p>
      )}
    </form>
  );
}
