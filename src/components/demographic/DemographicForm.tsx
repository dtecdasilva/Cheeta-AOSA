"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { Field, TextInput, SelectInput, PrimaryButton, SecondaryButton } from "@/components/Form";
import { CountrySelect } from "@/components/CountrySelect";
import { DisabilityMediaUploader } from "@/components/demographic/DisabilityMedia";
import { ApplicantPhotoUploader } from "@/components/demographic/ApplicantPhoto";
import { DemographicCompletionPanel } from "@/components/demographic/DemographicCompletion";
import type { DemographicCompletion } from "@/lib/demographic/completion";
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
import { useT } from "@/lib/i18n/client";

type FormState = Partial<Omit<DemographicProfile, "updatedAt">> & { updatedAt?: string };

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{message}</p>;
}

export function DemographicForm() {
  const tr = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{ email: string; telephone: string }>({ email: "", telephone: "" });
  const [form, setForm] = useState<FormState>(EMPTY_DEMOGRAPHIC_PROFILE);
  // The answer as last saved: photos and a video can be added only once "Yes" is saved.
  const [savedDisability, setSavedDisability] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<DemographicFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  // Whether a record is stored yet decides between creating (POST) and updating (PATCH).
  const [exists, setExists] = useState(false);
  const [completion, setCompletion] = useState<DemographicCompletion | null>(null);

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
      setSavedDisability(data.profile.disability);
          setSavedDisability(data.profile.disability);
          setExists(!!data.exists);
          setCompletion(data.completion ?? null);
        } else {
          setFormError(data.error ?? tr("Could not load your demographic information."));
        }
      } catch {
        if (!cancelled) setFormError(tr("Could not load your demographic information. Check your connection."));
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

  // The outcome of a save (the message, the completion status) is shown at the top of
  // the form, and the buttons are at the bottom: bring the top back into view.
  const showOutcome = () => window.scrollTo({ top: 0, behavior: "smooth" });

  async function persist(mode: "save" | "submit") {
    setFormError(null);
    setSuccessMessage(null);

    // Countries come from the database through the pickers, so which ones are valid is the server's call.
    const clientErrors = mode === "submit" ? validateDemographicForSubmit(form, { countries: null }) : validateDemographicForSave(form, { countries: null });
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(tr("Some fields need attention before this can be saved."));
      showOutcome();
      return;
    }

    setSaving(mode);
    try {
      const send = (method: "POST" | "PATCH") =>
        fetch("/api/student/demographic", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, mode }),
        });
      // Create the record the first time, update it afterwards. If this tab's idea of
      // which applies is out of date (saved in another tab, say), use the other one.
      let res = await send(exists ? "PATCH" : "POST");
      if (!exists && res.status === 409) res = await send("PATCH");
      else if (exists && res.status === 404) res = await send("POST");
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? tr("Could not save your information."));
        showOutcome();
        return;
      }

      setForm({ ...EMPTY_DEMOGRAPHIC_PROFILE, ...data.profile });
      setExists(true);
      setCompletion(data.completion ?? null);
      setErrors({});

      if (mode === "submit") {
        router.push("/student/application/summary");
        return;
      }
      setSuccessMessage(tr("Demographic information saved."));
      showOutcome();
    } catch {
      setFormError(tr("Could not save your information. Check your connection and try again."));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your demographic information…")}</p>;
  }

  const divisionOptions = form.regionOfOrigin
    ? DIVISIONS_BY_REGION[form.regionOfOrigin as (typeof CAMEROON_REGIONS)[number]] ?? []
    : [];

  return (
    <div className="max-w-4xl space-y-8">
      {formError && (
        <p role="alert" className="rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-2.5 text-sm text-[var(--color-danger-strong)]">
          {tr(formError)}
        </p>
      )}
      {successMessage && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-2.5 text-sm text-[var(--color-success-strong)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          {tr(successMessage)}
        </p>
      )}

      {completion && <DemographicCompletionPanel completion={completion} />}

      {/* Identity */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Identity")}</h2>
        <div className="mt-4">
          <ApplicantPhotoUploader />
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={tr("Applicant full name as shown on birth certificate")} required>
              <TextInput
                value={form.fullNameOnBirthCertificate ?? ""}
                onChange={(e) => update("fullNameOnBirthCertificate", e.target.value)}
              />
              <ErrorText message={tr(errors.fullNameOnBirthCertificate)} />
            </Field>
          </div>
          <Field label={tr("Date of birth")} required>
            <TextInput type="date" value={form.dateOfBirth ?? ""} onChange={(e) => update("dateOfBirth", e.target.value)} />
            <ErrorText message={tr(errors.dateOfBirth)} />
          </Field>
          <Field label={tr("Place of birth")} required>
            <TextInput value={form.placeOfBirth ?? ""} onChange={(e) => update("placeOfBirth", e.target.value)} />
            <ErrorText message={tr(errors.placeOfBirth)} />
          </Field>
          <CountrySelect
            label={tr("Country of birth")}
            required
            value={form.countryOfBirth ?? ""}
            onChange={(v) => update("countryOfBirth", v)}
            error={errors.countryOfBirth}
          />
          <Field label={tr("Sex")} required>
            <SelectInput value={form.sex ?? ""} onChange={(e) => update("sex", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {SEX_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.sex)} />
          </Field>
          <Field label={tr("Marital status")} required>
            <SelectInput value={form.maritalStatus ?? ""} onChange={(e) => update("maritalStatus", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {MARITAL_STATUS_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.maritalStatus)} />
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Contact")}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={tr("Email")} hint={tr("From your registration — cannot be changed here.")}>
            <div className="relative">
              <TextInput value={account.email} disabled className="pr-9" />
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
            </div>
          </Field>
          <Field label={tr("Telephone")} hint={tr("From your registration — cannot be changed here.")}>
            <div className="relative">
              <TextInput value={account.telephone} disabled className="pr-9" />
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
            </div>
          </Field>
          <Field label={tr("Alternative telephone")}>
            <TextInput
              type="tel"
              value={form.alternativeTelephone ?? ""}
              onChange={(e) => update("alternativeTelephone", e.target.value)}
            />
            <ErrorText message={tr(errors.alternativeTelephone)} />
          </Field>
          <Field label={tr("P.O. Box")}>
            <TextInput value={form.poBox ?? ""} onChange={(e) => update("poBox", e.target.value)} />
            <ErrorText message={tr(errors.poBox)} />
          </Field>
        </div>
      </section>

      {/* Disability */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Disability")}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={tr("Disability")} required>
            <SelectInput value={form.disability ?? ""} onChange={(e) => update("disability", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {YES_NO_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.disability)} />
          </Field>
          {form.disability === "Yes" && (
            <Field label={tr("Disability details")} required>
              <TextInput
                value={form.disabilityDetails ?? ""}
                onChange={(e) => update("disabilityDetails", e.target.value)}
                placeholder={tr("Describe the disability")}
              />
              <ErrorText message={tr(errors.disabilityDetails)} />
            </Field>
          )}
          {form.disability === "Yes" && <DisabilityMediaUploader savedAnswer={savedDisability} />}
        </div>
      </section>

      {/* Origin & residence */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Origin & residence")}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <CountrySelect
            label={tr("Country of residence")}
            purpose="residence"
            required
            value={form.countryOfResidence ?? ""}
            onChange={(v) => update("countryOfResidence", v)}
            error={errors.countryOfResidence}
          />
          <CountrySelect
            label={tr("Nationality")}
            purpose="nationality"
            required
            value={form.nationality ?? ""}
            onChange={(v) => update("nationality", v)}
            error={errors.nationality}
          />
          <Field label={tr("Region of origin")} required>
            <SelectInput value={form.regionOfOrigin ?? ""} onChange={(e) => update("regionOfOrigin", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {CAMEROON_REGIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.regionOfOrigin)} />
          </Field>
          <Field label={tr("Division of origin")} required hint={!form.regionOfOrigin ? tr("Select a region first.") : undefined}>
            <SelectInput
              value={form.divisionOfOrigin ?? ""}
              onChange={(e) => update("divisionOfOrigin", e.target.value)}
              disabled={!form.regionOfOrigin}
            >
              <option value="">{tr("Select…")}</option>
              {divisionOptions.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.divisionOfOrigin)} />
          </Field>
          <Field label={tr("Town of residence")} required>
            <TextInput value={form.townOfResidence ?? ""} onChange={(e) => update("townOfResidence", e.target.value)} />
            <ErrorText message={tr(errors.townOfResidence)} />
          </Field>
        </div>
      </section>

      {/* Personal */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Personal")}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={tr("Religion")} required>
            <SelectInput value={form.religion ?? ""} onChange={(e) => update("religion", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {RELIGION_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.religion)} />
          </Field>
          <Field label={tr("Preferred language / language of instruction")} required>
            <SelectInput value={form.preferredLanguage ?? ""} onChange={(e) => update("preferredLanguage", e.target.value)}>
              <option value="">{tr("Select…")}</option>
              {LANGUAGE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </SelectInput>
            <ErrorText message={tr(errors.preferredLanguage)} />
          </Field>
        </div>
      </section>

      {/* Parents / guardian */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-semibold text-base text-[var(--color-ink)]">{tr("Parent / guardian information")}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={tr("Father's names")} required>
            <TextInput value={form.fathersNames ?? ""} onChange={(e) => update("fathersNames", e.target.value)} />
            <ErrorText message={tr(errors.fathersNames)} />
          </Field>
          <Field label={tr("Mother's names")} required>
            <TextInput value={form.mothersNames ?? ""} onChange={(e) => update("mothersNames", e.target.value)} />
            <ErrorText message={tr(errors.mothersNames)} />
          </Field>
          <CountrySelect
            label={tr("Parent's country")}
            value={form.parentsCountry ?? ""}
            onChange={(v) => update("parentsCountry", v)}
            error={errors.parentsCountry}
          />
          <Field label={tr("Parent's town/city")}>
            <TextInput value={form.parentsTownCity ?? ""} onChange={(e) => update("parentsTownCity", e.target.value)} />
            <ErrorText message={tr(errors.parentsTownCity)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tr("Parent's address")}>
              <TextInput value={form.parentsAddress ?? ""} onChange={(e) => update("parentsAddress", e.target.value)} />
              <ErrorText message={tr(errors.parentsAddress)} />
            </Field>
          </div>
          <Field label={tr("Parent's occupation")}>
            <TextInput value={form.parentsOccupation ?? ""} onChange={(e) => update("parentsOccupation", e.target.value)} />
            <ErrorText message={tr(errors.parentsOccupation)} />
          </Field>
          <Field label={tr("Parent's telephone")}>
            <TextInput
              type="tel"
              value={form.parentsTelephone ?? ""}
              onChange={(e) => update("parentsTelephone", e.target.value)}
            />
            <ErrorText message={tr(errors.parentsTelephone)} />
          </Field>
          <Field label={tr("Parent's email")}>
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
          {saving === "save" ? tr("Saving…") : tr("Save")}
        </SecondaryButton>
        <PrimaryButton type="button" disabled={saving !== null} onClick={() => persist("submit")}>
          {saving === "submit" ? tr("Saving…") : tr("Save & Continue")}
        </PrimaryButton>
        {form.updatedAt && (
          <span className="text-xs text-[var(--color-ink-faint)]">
            {tr("Last saved {value}", { value: new Date(form.updatedAt).toLocaleString() })}
          </span>
        )}
      </div>
    </div>
  );
}
