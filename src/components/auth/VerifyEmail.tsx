"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { ButtonLinkClass } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

type State = { kind: "working" } | { kind: "done"; email: string; alreadyVerified: boolean } | { kind: "failed"; message: string };

/**
 * Landing screen for the link in the verification email: hands the token
 * to POST /api/auth/verify-email and reports what happened.
 */
export function VerifyEmail() {
  const tr = useT();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>({ kind: "working" });
  // React runs effects twice in development; the link should only be submitted once.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ kind: "failed", message: tr("This verification link is incomplete. Open it again from the email, or ask for a new one.") });
      return;
    }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setState({ kind: "done", email: data.email, alreadyVerified: !!data.alreadyVerified });
        else setState({ kind: "failed", message: data.error ?? tr("This verification link could not be used.") });
      })
      .catch(() => setState({ kind: "failed", message: tr("Something went wrong. Check your connection and open the link again.") }));
  }, [token]);

  if (state.kind === "working") {
    return (
      <p role="status" className="text-sm text-[var(--color-ink-soft)]">
        {tr("Confirming your email address…")}
      </p>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-[var(--color-danger-soft)] px-4 py-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" strokeWidth={1.75} />
          <p className="text-sm text-[var(--color-danger-strong)]">{tr(state.message)}</p>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {tr("Signing in with the login code from your registration email also confirms your address.")}
        </p>
        <a href="/login" className={ButtonLinkClass("primary")}>
          {tr("Go to sign in")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl bg-[var(--color-success-soft)] px-4 py-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
        <p className="text-sm text-[var(--color-success-strong)]">
          {state.alreadyVerified ? (
            <>
              <span className="font-medium">{state.email}</span>{" "}{tr("was already confirmed. There is nothing more to do.")}
            </>
          ) : (
            <>
              <span className="font-medium">{state.email}</span>{" "}{tr("is confirmed. Sign in with the login code from your registration email to continue your application.")}
            </>
          )}
        </p>
      </div>
      <a href="/login" className={ButtonLinkClass("primary")}>
        {tr("Go to sign in")}
      </a>
    </div>
  );
}
