"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, TextInput, PrimaryButton } from "@/components/Form";

const ACCOUNT_INACTIVE_MESSAGE = "This account has been deactivated. Contact your administrator.";

export function LoginForm() {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.push(next && next.startsWith("/") ? next : data.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Email address" htmlFor="email" required>
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
      <Field label="Password" htmlFor="password" required>
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
          Forgot your password?
        </a>
      </div>

      {error && (
        <p role="alert" className="border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in…" : "Sign in"}
      </PrimaryButton>
    </form>
  );
}
