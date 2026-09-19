"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { CountrySelect } from "@/components/CountrySelect";
import { DemographicProfile, EMPTY_DEMOGRAPHIC_PROFILE } from "@/lib/demographic/types";
import { DemographicFieldErrors, validateDemographicForSave, validateDemographicForSubmit } from "@/lib/demographic/validation";
import {
  SEX_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  YES_NO_OPTIONS,
  RELIGION_OPTIONS,
  LANGUAGE_OPTIONS,
  CAMEROON_REGIONS,
  DIVISIONS_BY_REGION,
} from "@/lib/demographic/options";

type FormState = Partial<Omit<DemographicProfile, "updatedAt">> & { updatedAt?: string };

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{message}</p>;
}

export function DemographicForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{ email: string; telephone: string }>({ email: "", telephone: "" });
  const [form, setForm] = useState<FormState>(EMPTY_DEMOGRAPHIC_PROFILE);
  const [errors, setErrors] = useState<DemographicFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/demographic", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setAccount(data.account);
          setForm({ ...EMPTY_DEMOGRAPHIC_PROFILE, ...data.profile });
        } else {
          setFormError(data.error ?? "Could not load your demographic information.");
        }
      } catch {
        if (!cancelled) setFormError("Could not load your demographic information. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "regionOfOrigin") {
        const validDivisions = DIVISIONS_BY_REGION[value as (typeof CAMEROON_REGIONS)[number]] ?? [];
        if (!validDivisions.includes(next.divisionOfOrigin ?? "")) {
          next.divisionOfOrigin = "";
        }
      }
      if (key === "disability" && value !== "Yes") {
        next.disabilityDetails = "";
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSuccessMessage(null);
  }

  async function persist(mode: "save" | "submit") {
    setFormError(null);
    setSuccessMessage(null);

    const clientErrors = mode === "submit" ? validateDemographicForSubmit(form) : validateDemographicForSave(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError("Some fields need attention before this can be saved.");
      return;
    }

    setSaving(mode);
    try {
      const res = await fetch("/api/student/demographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, mode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "Could not save your information.");
        return;
      }

      setForm({ ...EMPTY_DEMOGRAPHIC_PROFILE, ...data.profile });
      setErrors({});

      if (mode === "submit") {
        router.push("/student/application/summary");
        return;
      }
      setSuccessMessage("Demographic information saved.");
    } catch {
      setFormError("Could not save your information. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Loading your demographic information…</p>;
  }

  const divisionOptions = form.regionOfOrigin
    ? DIVISIONS_BY_REGION[form.regionOfOrigin as (typeof CAMEROON_REGIONS)[number]] ?? []
    : [];

  return (
    <div className="max-w-4xl space-y-8">
      {formError && (
        <p role="alert" className="border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}
      {successMessage && (
        <p className="flex items-center gap-2 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-2.5 text-sm text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          {successMessage}
        </p>
      )}

      {/* Identity */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Identity</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Applicant full name as shown on birth certificate" required>
              <TextInput
                value={form.fullNameOnBirthCertificate ?? ""}
                onChange={(e) => update("fullNameOnBirthCertificate", e.target.value)}
              />
              <ErrorText message={errors.fullNameOnBirthCertificate} />
            </Field>
          </div>
          <Field label="Date of birth" required>
            <TextInput type="date" value={form.dateOfBirth ?? ""} onChange={(e) => update("dateOfBirth", e.target.value)} />
            <ErrorText message={errors.dateOfBirth} />
          </Field>
          <Field label="Place of birth" required>
            <TextInput value={form.placeOfBirth ?? ""} onChange={(e) => update("placeOfBirth", e.target.value)} />
            <ErrorText message={errors.placeOfBirth} />
          </Field>
          <CountrySelect
            label="Country of birth"
            required
            value={form.countryOfBirth ?? ""}
            onChange={(v) => update("countryOfBirth", v)}
            error={errors.countryOfBirth}
          />
          <Field label="Sex" required>
            <SelectInput value={form.sex ?? ""} onChange={(e) => update("sex", e.target.value)}>
              <option value="">Select…</option>
              {SEX_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.sex} />
          </Field>
          <Field label="Marital status" required>
            <SelectInput value={form.maritalStatus ?? ""} onChange={(e) => update("maritalStatus", e.target.value)}>
              <option value="">Select…</option>
              {MARITAL_STATUS_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.maritalStatus} />
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Contact</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Email" hint="From your registration — cannot be changed here.">
            <div className="relative">
              <TextInput value={account.email} disabled className="pr-9" />
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
            </div>
          </Field>
          <Field label="Telephone" hint="From your registration — cannot be changed here.">
            <div className="relative">
              <TextInput value={account.telephone} disabled className="pr-9" />
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
            </div>
          </Field>
          <Field label="Alternative telephone">
            <TextInput
              type="tel"
              value={form.alternativeTelephone ?? ""}
              onChange={(e) => update("alternativeTelephone", e.target.value)}
            />
            <ErrorText message={errors.alternativeTelephone} />
          </Field>
          <Field label="P.O. Box">
            <TextInput value={form.poBox ?? ""} onChange={(e) => update("poBox", e.target.value)} />
            <ErrorText message={errors.poBox} />
          </Field>
        </div>
      </section>

      {/* Disability */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Disability</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Disability" required>
            <SelectInput value={form.disability ?? ""} onChange={(e) => update("disability", e.target.value)}>
              <option value="">Select…</option>
              {YES_NO_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.disability} />
          </Field>
          {form.disability === "Yes" && (
            <Field label="Disability details" required>
              <TextInput
                value={form.disabilityDetails ?? ""}
                onChange={(e) => update("disabilityDetails", e.target.value)}
                placeholder="Describe the disability"
              />
              <ErrorText message={errors.disabilityDetails} />
            </Field>
          )}
        </div>
      </section>

      {/* Origin & residence */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Origin &amp; residence</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <CountrySelect
            label="Country of residence"
            required
            value={form.countryOfResidence ?? ""}
            onChange={(v) => update("countryOfResidence", v)}
            error={errors.countryOfResidence}
          />
          <CountrySelect
            label="Nationality"
            required
            value={form.nationality ?? ""}
            onChange={(v) => update("nationality", v)}
            error={errors.nationality}
          />
          <Field label="Region of origin" required>
            <SelectInput value={form.regionOfOrigin ?? ""} onChange={(e) => update("regionOfOrigin", e.target.value)}>
              <option value="">Select…</option>
              {CAMEROON_REGIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.regionOfOrigin} />
          </Field>
          <Field label="Division of origin" required hint={!form.regionOfOrigin ? "Select a region first." : undefined}>
            <SelectInput
              value={form.divisionOfOrigin ?? ""}
              onChange={(e) => update("divisionOfOrigin", e.target.value)}
              disabled={!form.regionOfOrigin}
            >
              <option value="">Select…</option>
              {divisionOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.divisionOfOrigin} />
          </Field>
          <Field label="Town of residence" required>
            <TextInput value={form.townOfResidence ?? ""} onChange={(e) => update("townOfResidence", e.target.value)} />
            <ErrorText message={errors.townOfResidence} />
          </Field>
        </div>
      </section>

      {/* Personal */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Personal</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Religion" required>
            <SelectInput value={form.religion ?? ""} onChange={(e) => update("religion", e.target.value)}>
              <option value="">Select…</option>
              {RELIGION_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.religion} />
          </Field>
          <Field label="Preferred language / language of instruction" required>
            <SelectInput value={form.preferredLanguage ?? ""} onChange={(e) => update("preferredLanguage", e.target.value)}>
              <option value="">Select…</option>
              {LANGUAGE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={errors.preferredLanguage} />
          </Field>
        </div>
      </section>

      {/* Parents / guardian */}
      <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Parent / guardian information</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Father's names" required>
            <TextInput value={form.fathersNames ?? ""} onChange={(e) => update("fathersNames", e.target.value)} />
            <ErrorText message={errors.fathersNames} />
          </Field>
          <Field label="Mother's names" required>
            <TextInput value={form.mothersNames ?? ""} onChange={(e) => update("mothersNames", e.target.value)} />
            <ErrorText message={errors.mothersNames} />
          </Field>
          <CountrySelect
            label="Parent's country"
            value={form.parentsCountry ?? ""}
            onChange={(v) => update("parentsCountry", v)}
            error={errors.parentsCountry}
          />
          <Field label="Parent's town/city">
            <TextInput value={form.parentsTownCity ?? ""} onChange={(e) => update("parentsTownCity", e.target.value)} />
            <ErrorText message={errors.parentsTownCity} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Parent's address">
              <TextInput value={form.parentsAddress ?? ""} onChange={(e) => update("parentsAddress", e.target.value)} />
              <ErrorText message={errors.parentsAddress} />
            </Field>
          </div>
          <Field label="Parent's occupation">
            <TextInput value={form.parentsOccupation ?? ""} onChange={(e) => update("parentsOccupation", e.target.value)} />
            <ErrorText message={errors.parentsOccupation} />
          </Field>
          <Field label="Parent's telephone">
            <TextInput
              type="tel"
              value={form.parentsTelephone ?? ""}
              onChange={(e) => update("parentsTelephone", e.target.value)}
            />
            <ErrorText message={errors.parentsTelephone} />
          </Field>
          <Field label="Parent's email">
            <TextInput
              type="email"
              value={form.parentsEmail ?? ""}
              onChange={(e) => update("parentsEmail", e.target.value)}
            />
            <ErrorText message={errors.parentsEmail} />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-6">
        <SecondaryButton type="button" disabled={saving !== null} onClick={() => persist("save")}>
          {saving === "save" ? "Saving…" : "Save"}
        </SecondaryButton>
        <PrimaryButton type="button" disabled={saving !== null} onClick={() => persist("submit")}>
          {saving === "submit" ? "Saving…" : "Save & Continue"}
        </PrimaryButton>
        {form.updatedAt && (
          <span className="text-xs text-[var(--color-ink-faint)]">
            Last saved {new Date(form.updatedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
