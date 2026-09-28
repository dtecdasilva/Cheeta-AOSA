"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, FormError, ButtonLinkClass } from "@/components/Form";
import { INSTITUTION_TYPES } from "@/lib/data";
import { validateEmail, validateMobileNumber, validateInstitutionType } from "@/lib/validation";

interface RegisterResponse {
  ok?: boolean;
  error?: string;
  field?: "email" | "mobileNumber" | "institutionType";
  accountExists?: boolean;
  applicant?: { email: string; institutionType: string; mobileNumber: string };
  devEmailPreview?: { to: string; subject: string; body: string };
  devSmsPreview?: { to: string; message: string };
}

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  function validateClientSide(): boolean {
    const errors: Record<string, string> = {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) errors.email = emailCheck.message!;
    const mobileCheck = validateMobileNumber(mobileNumber);
    if (!mobileCheck.valid) errors.mobileNumber = mobileCheck.message!;
    const institutionCheck = validateInstitutionType(institutionType);
    if (!institutionCheck.valid) errors.institutionType = institutionCheck.message!;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAccountExists(false);
    if (!validateClientSide()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, institutionType, mobileNumber }),
      });
      const data: RegisterResponse = await res.json();

      if (!res.ok) {
        if (data.accountExists) {
          setAccountExists(true);
        } else if (data.field) {
          setFieldErrors({ [data.field]: data.error ?? "Invalid value." });
        } else {
          setFormError(data.error ?? "Could not complete registration.");
        }
        return;
      }

      setResult(data);
    } catch {
      setFormError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="space-y-5">
        <div className="border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
            <p className="text-sm text-[var(--color-success)]">
              Congratulations, you have successfully registered on the Cheeta AOSA Platform.
              Please check your email for your login details and return to the platform to
              continue your school application process.
            </p>
          </div>
        </div>

        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-soft)]">
          <p>
            A login code was sent to <span className="font-medium text-[var(--color-ink)]">{result.applicant?.email}</span>,
            and an SMS notification was sent to{" "}
            <span className="font-medium text-[var(--color-ink)]">{result.applicant?.mobileNumber}</span> letting you know
            to check your email.
          </p>
        </div>

        {(result.devEmailPreview || result.devSmsPreview) && (
          <div className="space-y-3 border border-dashed border-[var(--color-line-strong)] p-4">
            <p className="text-xs font-medium text-[var(--color-ink-soft)]">
              Development preview — no email/SMS provider is connected yet, so here is exactly
              what would have been sent:
            </p>
            {result.devEmailPreview && (
              <div className="border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">Email to {result.devEmailPreview.to}</p>
                <p className="mt-1 font-medium text-[var(--color-ink)]">{result.devEmailPreview.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[var(--color-ink-soft)]">{result.devEmailPreview.body}</pre>
              </div>
            )}
            {result.devSmsPreview && (
              <div className="border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">SMS to {result.devSmsPreview.to}</p>
                <p className="mt-1 text-[var(--color-ink-soft)]">{result.devSmsPreview.message}</p>
              </div>
            )}
          </div>
        )}

        <Link
          href="/login"
          className={ButtonLinkClass("primary")}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  if (accountExists) {
    return (
      <div className="space-y-4">
        <p className="border border-[var(--color-amber-soft)] bg-[var(--color-amber-soft)] px-3 py-2.5 text-sm text-[var(--color-amber)]">
          An account already exists for <span className="font-medium">{email}</span>. Sign in
          instead, or use &quot;Forgot your password?&quot; on the sign-in page if you don&apos;t remember your
          login details.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className={ButtonLinkClass("primary")}
          >
            Go to sign in
          </Link>
          <button
            type="button"
            onClick={() => setAccountExists(false)}
            className={ButtonLinkClass("secondary")}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Email address" htmlFor="email" required hint="Your login details will be sent here." error={fieldErrors.email}>
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

      <Field label="Institution type" htmlFor="institutionType" required hint="This determines which application experience you'll see." error={fieldErrors.institutionType}>
        <SelectInput
          id="institutionType"
          value={institutionType}
          onChange={(e) => setInstitutionType(e.target.value)}
          required
        >
          <option value="">Select an institution type…</option>
          {INSTITUTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Mobile telephone number" htmlFor="mobileNumber" required hint="Used for SMS notifications about your application." error={fieldErrors.mobileNumber}>
        <TextInput
          id="mobileNumber"
          type="tel"
          autoComplete="tel"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          placeholder="+237 6XX XXX XXX"
          required
        />
      </Field>

      {formError && <FormError>{formError}</FormError>}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? "Registering…" : "Register"}
      </PrimaryButton>
    </form>
  );
}
