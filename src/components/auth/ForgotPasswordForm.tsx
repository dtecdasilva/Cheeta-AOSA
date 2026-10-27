"use client";

import { useState } from "react";
import { Field, TextInput, PrimaryButton, FormError } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

export function ForgotPasswordForm() {
  const tr = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tr("Something went wrong."));
        return;
      }
      setSubmitted(true);
      setDevResetUrl(data.resetUrl ?? null);
    } catch {
      setError(tr("Something went wrong. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2.5 text-sm text-[var(--color-success-strong)]">
          {tr("If an account exists for that email, a password reset link has been sent.")}
        </p>
        {devResetUrl && (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium text-[var(--color-ink-soft)]">
              {tr("Development mode — no email service is connected yet, so here is the link that would normally be emailed:")}
            </p>
            <a href={devResetUrl} className="mt-2 block break-all text-sm text-[var(--color-brand-strong)] underline underline-offset-4">
              {devResetUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label={tr("Email address")} htmlFor="email" required hint={tr("We'll send a reset link if an account exists for this address.")}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tr("you@example.com")}
          required
        />
      </Field>

      {error && <FormError>{tr(error)}</FormError>}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? tr("Sending…") : tr("Send reset link")}
      </PrimaryButton>
    </form>
  );
}
