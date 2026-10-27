"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, TextInput, PrimaryButton, FormError } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

const ACCOUNT_INACTIVE_MESSAGE = "This account has been deactivated. Contact your administrator.";

/**
 * Only same-origin paths are accepted as a post-login destination.
 * Checking `startsWith("/")` alone was not enough: "//evil.com" and
 * "/\\evil.com" both begin with a slash and are read by browsers as
 * protocol-relative URLs, which turned the `next` parameter into an open
 * redirect an attacker could use to bounce a freshly-authenticated user
 * off-site.
 */
function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export function LoginForm() {
  const tr = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "account_inactive" ? ACCOUNT_INACTIVE_MESSAGE : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // An answer that isn't JSON means the server failed before it could reply properly.
      const data = await res.json().catch(() => null);
      if (!data) {
        setError(tr("The server couldn't sign you in (error {status}). Please try again in a moment.", { status: res.status }));
        return;
      }
      if (!res.ok) {
        setError(data.error ?? tr("Could not sign in."));
        return;
      }
      router.push(safeNext(next) ?? data.redirectTo);
      router.refresh();
    } catch {
      // The request never got an answer: the server isn't reachable.
      setError(tr("Couldn't reach the server. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label={tr("Email address")} htmlFor="email" required>
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
      <Field label={tr("Password")} htmlFor="password" required>
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </Field>

      <div className="flex justify-end">
        <a href="/forgot-password" className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          {tr("Forgot your password?")}
        </a>
      </div>

      {error && <FormError>{tr(error)}</FormError>}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? tr("Signing in…") : tr("Sign in")}
      </PrimaryButton>
    </form>
  );
}
