"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MailCheck, MailWarning } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton, FormError, ButtonLinkClass } from "@/components/Form";
import { INSTITUTION_TYPES } from "@/lib/data";
import { validateEmail, validateMobileNumber, validateInstitutionType } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

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
  const tr = useT();
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
      if (!res.ok) setNote(data.error ?? tr("Could not send the email. Try again in a few minutes."));
      else {
        setNote(tr("If the address still needs confirming, a new verification email is on its way."));
        setDevPreview(data.devEmailPreview ?? null);
      }
    } catch {
      setNote(tr("Something went wrong. Check your connection and try again."));
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
      if (!res.ok) setNote(data.error ?? tr("Could not check the status."));
      else {
        setStatus(data.registrationStatus);
        if (data.registrationStatus !== "VERIFIED") setNote(tr("Not verified yet. Open the link in the email, or sign in with the code it contains."));
      }
    } catch {
      setNote(tr("Something went wrong. Check your connection and try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[var(--color-ink)]">{tr("Registration status")}</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            verified ? "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]"
          }`}
        >
          {verified ? <MailCheck className="h-3.5 w-3.5" strokeWidth={2} /> : <MailWarning className="h-3.5 w-3.5" strokeWidth={2} />}
          {verified ? tr("Email verified") : tr("Awaiting email verification")}
        </span>
      </div>
      {registrationNo && (
        <p className="mt-2 text-[var(--color-ink-soft)]">
          {tr("Registration number:")}{" "}<span className="font-medium text-[var(--color-ink)]">{tr(registrationNo)}</span>
        </p>
      )}
      {!verified && (
        <>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            {tr("Open the link in the email we sent to confirm your address. Signing in with the login code from that email confirms it too.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={resend} disabled={busy !== null}>
              {busy === "resend" ? tr("Sending…") : tr("Resend verification email")}
            </SecondaryButton>
            {statusToken && (
              <SecondaryButton type="button" onClick={check} disabled={busy !== null}>
                {busy === "check" ? tr("Checking…") : tr("Check status")}
              </SecondaryButton>
            )}
          </div>
        </>
      )}
      {note && (
        <p role="status" className="mt-3 text-xs text-[var(--color-ink-soft)]">
          {tr(note)}
        </p>
      )}
      {devPreview && (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] p-3 text-xs">
          <p className="text-[var(--color-ink-faint)]">{tr("Development preview — email to {to}", { to: devPreview.to })}</p>
          <p className="mt-1 font-medium text-[var(--color-ink)]">{tr(devPreview.subject)}</p>
          <pre className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-[var(--color-ink-soft)]">{devPreview.body}</pre>
        </div>
      )}
    </div>
  );
}

export function RegisterForm() {
  const tr = useT();
  const [email, setEmail] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  // The types offered come from the platform's parameters (GET /api/reference/institution-types); the built-in list until they arrive.
  const [types, setTypes] = useState<string[]>(INSTITUTION_TYPES);
  useEffect(() => {
    fetch("/api/reference/institution-types")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.data?.length && setTypes(b.data))
      .catch(() => undefined);
  }, []);
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
      // An answer that isn't JSON means the server failed before it could reply properly
      // (it is restarting, or hit an error of its own). That is not a connection problem.
      const data: RegisterResponse | null = await res.json().catch(() => null);
      if (!data) {
        setFormError(tr("The server couldn't complete your registration (error {status}). Please try again in a moment.", { status: res.status }));
        return;
      }

      if (!res.ok) {
        if (data.accountExists) {
          setAccountExists(true);
        } else if (data.field) {
          setFieldErrors({ [data.field]: data.error ?? tr("Invalid value.") });
        } else {
          setFormError(data.error ?? tr("Could not complete registration."));
        }
        return;
      }

      setResult(data);
    } catch {
      // The request never got an answer: the server isn't reachable.
      setFormError(tr("Couldn't reach the server. Check your connection and try again."));
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
              {tr("Congratulations, you have successfully registered on the Cheeta AOSA Platform. Please check your email for your login details and return to the platform to continue your school application process.")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-soft)]">
          <p>
            {tr("A login code was sent to")}{" "}<span className="font-medium text-[var(--color-ink)]">{result.applicant?.email}</span>{tr(", and an SMS notification was sent to")}{" "}
            <span className="font-medium text-[var(--color-ink)]">{result.applicant?.mobileNumber}</span>{" "}{tr("letting you know to check your email.")}
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
              {tr("Development preview — no email/SMS provider is connected yet, so here is exactly what would have been sent:")}
            </p>
            {result.devEmailPreview && (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">{tr("Email to {to}", { to: result.devEmailPreview.to })}</p>
                <p className="mt-1 font-medium text-[var(--color-ink)]">{tr(result.devEmailPreview.subject)}</p>
                <pre className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-[var(--color-ink-soft)]">{result.devEmailPreview.body}</pre>
              </div>
            )}
            {result.devSmsPreview && (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs">
                <p className="text-[var(--color-ink-faint)]">{tr("SMS to {to}", { to: result.devSmsPreview.to })}</p>
                <p className="mt-1 text-[var(--color-ink-soft)]">{tr(result.devSmsPreview.message)}</p>
              </div>
            )}
          </div>
        )}

        <a
          href="/login"
          className={ButtonLinkClass("primary")}
        >
          {tr("Go to sign in")}
        </a>
      </div>
    );
  }

  if (accountExists) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-2.5 text-sm text-[var(--color-warning-strong)]">
          {tr("An account already exists for")}{" "}<span className="font-medium">{email}</span>. Sign in
          instead, or use &quot;Forgot your password?&quot; on the sign-in page if you don&apos;t remember your
          login details.
        </p>
        <div className="flex gap-3">
          <a
            href="/login"
            className={ButtonLinkClass("primary")}
          >
            {tr("Go to sign in")}
          </a>
          <button
            type="button"
            onClick={() => setAccountExists(false)}
            className={ButtonLinkClass("secondary")}
          >
            {tr("Use a different email")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label={tr("Email address")} htmlFor="email" required hint={tr("Your login details will be sent here.")} error={fieldErrors.email}>
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

      <Field label={tr("Institution type")} htmlFor="institutionType" required hint={tr("This determines which application experience you'll see.")} error={fieldErrors.institutionType}>
        <SelectInput
          id="institutionType"
          value={institutionType}
          onChange={(e) => setInstitutionType(e.target.value)}
          required
        >
          <option value="">{tr("Select an institution type…")}</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {tr(type)}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={tr("Mobile telephone number")} htmlFor="mobileNumber" required hint={tr("Used for SMS notifications about your application.")} error={fieldErrors.mobileNumber}>
        <TextInput
          id="mobileNumber"
          type="tel"
          autoComplete="tel"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          placeholder={tr("+237 6XX XXX XXX")}
          required
        />
      </Field>

      {formError && <FormError>{tr(formError)}</FormError>}

      <PrimaryButton type="submit" disabled={loading} className="w-full">
        {loading ? tr("Registering…") : tr("Register")}
      </PrimaryButton>
    </form>
  );
}
