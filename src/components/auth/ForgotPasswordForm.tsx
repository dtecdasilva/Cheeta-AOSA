"use client";

import { useState } from "react";
import { Field, TextInput, PrimaryButton } from "@/components/Form";

export function ForgotPasswordForm() {
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
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSubmitted(true);
      setDevResetUrl(data.resetUrl ?? null);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <p className="border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2.5 text-sm text-[var(--color-success)]">
          If an account exists for that email, a password reset link has been sent.
        </p>
        {devResetUrl && (
          <div className="border border-[var(--color-line)] bg-white p-4">
            <p className="text-xs font-medium text-[var(--color-ink-soft)]">
              Development mode — no email service is connected yet, so here is the link that would normally be emailed:
            </p>
            <a href={devResetUrl} className="mt-2 block break-all text-sm text-[var(--color-brass-dark)] underline underline-offset-4">
              {devResetUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Email address" htmlFor="email" required hint="We'll send a reset link if an account exists for this address.">
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </Field>

      {error && (
        <p role="alert" className="border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? "Sending…" : "Send reset link"}
      </PrimaryButton>
    </form>
  );
}
