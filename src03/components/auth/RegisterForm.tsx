"use client";

import { useState } from "react";
import { CheckCircle2, MailCheck, MailWarning } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton, FormError, ButtonLinkClass } from "@/components/Form";
import { INSTITUTION_TYPES } from "@/lib/data";
import { validateEmail, validateMobileNumber, validateInstitutionType } from "@/lib/validation";

interface RegisterResponse {
  ok?: boolean;
  error?: string;
  field?: "email" | "mobileNumber" | "institutionType";
  accountExists?: boolean;
  applicant?: { email: string; institutionType: string; mobileNumber: string; registrationNo?: string };
  registrationStatus?: RegistrationStatus;
  /** Lets this screen ask how verification is going without being signed in. */
  statusToken?: string;
  devEmailPreview?: { to: string; subject: string; body: string };
  devSmsPreview?: { to: string; message: string };
}

type RegistrationStatus = "PENDING_VERIFICATION" | "VERIFIED" | "DEACTIVATED";

/**
 * Where the new registration stands, with the two things an applicant can
 * do about it from here: ask again for the verification email, and check
 * whether the link they opened (perhaps on their phone) has registered.
 */
function RegistrationStatusPanel({ email, registrationNo, initial, statusToken }: { email: string; registrationNo?: string; initial: RegistrationStatus; statusToken?: string }) {
  const [status, setStatus] = useState<RegistrationStatus>(initial);
  const [busy, setBusy] = useState<"resend" | "check" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [devPreview, setDevPreview] = useState<{ to: string; subject: string; body: string } | null>(null);
  const verified = status === "VERIFIED";

  async function resend() {
    setBusy("resend");
    setNote(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) setNote(data.error ?? "Could not send the email. Try again in a few minutes.");
      else {
        setNote("If the address still needs confirming, a new verification email is on its way.");
        setDevPreview(data.devEmailPreview ?? null);
      }
    } catch {
      setNote("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (!statusToken) return;
    setBusy("check");
    setNote(null);
    try {
      const res = await fetch(`/api/auth/register/status?token=${encodeURIComponent(statusToken)}`);
      const data = await res.json();
      if (!res.ok) setNote(data.error ?? "Could not check the status.");
      else {
        setStatus(data.registrationStatus);
        if (data.registrationStatus !== "VERIFIED") setNote("Not verified yet. Open the link in the email, or sign in with the code it contains.");
      }
    } catch {
      setNote("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[var(--color-ink)]">Registration status</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            verified ? "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]"
          }`}
        >
          {verified ? <MailCheck className="h-3.5 w-3.5" strokeWidth={2} /> : <MailWarning className="h-3.5 w-3.5" strokeWidth={2} />}
          {verified ? "Email verified" : "Awaiting email verification"}
        </span>
      </div>
      {registrationNo && (
        <p className="mt-2 text-[var(--color-ink-soft)]">
          Registration number: <span className="font-medium text-[var(--color-ink)]">{registrationNo}</span>
        </p>
      )}
      {!verified && (
        <>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            Open the link in the email we sent to confirm your address. Signing in with the login code from that email confirms it too.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={resend} disabled={busy !== null}>
              {busy === "resend" ? "Sending…" : "Resend verification email"}
            </SecondaryButton>
            {statusToken && (
              <SecondaryButton type="button" onClick={check} disabled={busy !== null}>
                {busy === "check" ? "Checking…" : "Check status"}
              </SecondaryButton>
            )}
          </div>
        </>
      )}
      {note && (
        <p role="status" className="mt-3 text-xs text-[var(--color-ink-soft)]">
          {note}
        </p>
      )}
      {devPreview && (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] p-3 text-xs">
          <p className="text-[var(--color-ink-faint)]">Development preview — email to {devPreview.to}</p>
          <p className="mt-1 font-medium text-[var(--color-ink)]">{devPreview.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-[var(--color-ink-soft)]">{devPreview.body}</pre>
        </div>
      )}
    </div>
  );
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
        <div className="rounded-xl border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
            <p className="text-sm text-[var(--color-success-strong)]">
              Congratulations, you have successfully registered on the Cheeta AOSA Platform.
              Please check your email for your login details and return to the platform to
              continue your school application process.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-soft)]">
          <p>
            A login code was sent to <span className="font-medium text-[var(--color-ink)]">{result.applicant?.email}</span>,
            and an SMS notification was sent to{" "}
            <span className="font-medium text-[var(--color-ink)]">{result.applicant?.mobileNumber}</span> letting you know
            to check your email.
          </p>
        </div>

        <RegistrationStatusPanel
          email={result.applicant?.email ?? email}
          registrationNo={result.applicant?.registrationNo}
          initial={result.registrationStatus ?? "PENDING_VERIFICATION"}
          statusToken={result.statusToken}
        />

        {(result.devEmailPreview || result.devSmsPreview) && (
          <div className="space-y-3 rounded-xl border border-dashed border-[var(--color-line-strong)] p-4">
            <p className="text-xs font-medium text-[var(--color-ink-soft)]">
              Development preview — no email/SMS provider is connected yet, so here is exactly
              what would have been sent:
            </p>
            {result.devEmailPreview && (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">Email to {result.devEmailPreview.to}</p>
                <p className="mt-1 font-medium text-[var(--color-ink)]">{result.devEmailPreview.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-[var(--color-ink-soft)]">{result.devEmailPreview.body}</pre>
              </div>
            )}
            {result.devSmsPreview && (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">SMS to {result.devSmsPreview.to}</p>
                <p className="mt-1 text-[var(--color-ink-soft)]">{result.devSmsPreview.message}</p>
              </div>
            )}
          </div>
        )}

        <a
          href="/login"
          className={ButtonLinkClass("primary")}
        >
          Go to sign in
        </a>
      </div>
    );
  }

  if (accountExists) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-2.5 text-sm text-[var(--color-warning-strong)]">
          An account already exists for <span className="font-medium">{email}</span>. Sign in
          instead, or use &quot;Forgot your password?&quot; on the sign-in page if you don&apos;t remember your
          login details.
        </p>
        <div className="flex gap-3">
          <a
            href="/login"
            className={ButtonLinkClass("primary")}
          >
            Go to sign in
          </a>
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
