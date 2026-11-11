"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput, ButtonLinkClass } from "@/components/Form";
import { institutionStore, type AdminInstitution } from "@/lib/admin/institutions";
import { selectableParams, useParameters, type ParamItem } from "@/lib/admin/parameters";
import { useHydrated } from "@/lib/admin/store";
import { countryStore } from "@/lib/admin/reference";
import { LocationSelect, type LocationValue } from "@/components/location/LocationSelect";
import { useT } from "@/lib/i18n/client";
import { LogoUpload } from "./LogoUpload";
import { DESCRIPTION_MAX_CHARS, DESCRIPTION_MAX_WORDS, MOTTO_MAX_CHARS, descriptionProblem, wordCount } from "@/lib/institution/profile";
import { fromLocalInput, toLocalInput, windowProblems } from "@/lib/institution/applicationWindow";

type Draft = Omit<AdminInstitution, "id" | "createdAt" | "updatedAt" | "webFee"> & { webFee: string };
type Errors = Partial<Record<keyof Draft | "countryId", string>>;

const EMPTY: Draft = {
  typeId: "",
  accreditationBodyId: "",
  accreditationCode: "",
  name: "",
  address: "",
  location: "",
  regionId: "",
  townId: "",
  quarterId: "",
  contactName: "",
  phone: "",
  email: "",
  website: "",
  logoFileId: "",
  motto: "",
  description: "",
  applicationsMode: "OPEN",
  applicationsOpenAt: "",
  applicationsCloseAt: "",
  applicationsMessage: "",
  status: "ACTIVE",
  webFee: "",
};

/** Wrapper: resolves the record (for edit) before mounting the form. */
export function InstitutionFormScreen({ id }: { id?: string }) {
  const tr = useT();
  const hydrated = useHydrated();
  const institutions = institutionStore.useItems();
  if (!id) return <InstitutionForm />;
  const record = institutions.find((i) => i.id === id);
  if (!record) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <EmptyState
        message={tr("This institution doesn't exist. It may have been added in another browser.")}
        action={
          <Link href="/admin/institutions" className={ButtonLinkClass("secondary")}>
            {tr("Back to institutions")}
          </Link>
        }
      />
    );
  }
  return <InstitutionForm initial={record} />;
}

function InstitutionForm({ initial }: { initial?: AdminInstitution }) {
  const tr = useT();
  const router = useRouter();
  const types = useParameters("institution-types");
  const bodies = useParameters("accreditation-bodies");
  const regions = useParameters("regions");
  // Accrediting bodies belong to countries, and the dropdown says which after each name.
  const countryNames = new Map(countryStore.useItems().map((c) => [c.id, c.name]));

  const [form, setForm] = useState<Draft>(() => (initial ? { ...initial, webFee: initial.webFee === null ? "" : String(initial.webFee) } : EMPTY));
  // The country isn't saved with the institution: its region belongs to one. It is only chosen first, to narrow the regions.
  const [pickedCountry, setPickedCountry] = useState("");
  const countryId = pickedCountry || regions.find((r) => r.id === form.regionId)?.countryId || "";
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // Country → region → town → quarter; LocationSelect clears levels that no longer fit.
  function setLocation(next: LocationValue) {
    setPickedCountry(next.countryId ?? "");
    setForm((f) => ({ ...f, regionId: next.regionId, townId: next.townId, quarterId: next.leafId }));
    setErrors((e) => ({ ...e, countryId: undefined, regionId: undefined, townId: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    const required: [keyof Draft, string][] = [
      ["typeId", tr("Choose an institution type.")],
      ["name", tr("Enter the institution's name.")],
      ["accreditationBodyId", tr("Choose who accredited the institution.")],
      ["accreditationCode", tr("Enter the accreditation code.")],
      ["address", tr("Enter the postal or street address.")],
      ["regionId", tr("Choose a region.")],
      ["townId", tr("Choose a town.")],
      ["contactName", tr("Enter a contact name.")],
      ["phone", tr("Enter a phone number.")],
      ["email", tr("Enter an email address.")],
    ];
    for (const [k, msg] of required) if (!String(form[k]).trim()) e[k] = msg;
    // A region already implies its country; the country is only missing when neither is chosen.
    if (!countryId && !form.regionId) e.countryId = tr("Choose a country.");

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = tr("Enter an email address like admissions@school.cm.");
    if (form.phone && form.phone.replace(/\D/g, "").length < 8) e.phone = tr("Enter a phone number with at least 8 digits.");
    if (form.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(form.website.trim())) e.website = tr("Enter a full address starting with https://.");
    if (form.webFee.trim()) {
      const fee = Number(form.webFee);
      if (!Number.isFinite(fee) || fee < 0) e.webFee = tr("Enter an amount of 0 or more.");
    }
    if (descriptionProblem(form.description)) e.description = tr("Keep the description to {max} words or fewer (it is {words}).", { max: DESCRIPTION_MAX_WORDS, words: wordCount(form.description) });
    // The application dates, when they are being set or changed (an old closing date must not block saving other changes).
    const windowChanged = !initial || form.applicationsMode !== initial.applicationsMode || form.applicationsOpenAt !== initial.applicationsOpenAt || form.applicationsCloseAt !== initial.applicationsCloseAt;
    if (windowChanged) {
      const problems = windowProblems({ mode: form.applicationsMode, opensAt: form.applicationsOpenAt || null, closesAt: form.applicationsCloseAt || null });
      if (problems.opensAt) e.applicationsOpenAt = tr(problems.opensAt);
      if (problems.closesAt) e.applicationsCloseAt = tr(problems.closesAt);
    }
    const code = form.accreditationCode.trim().toLowerCase();
    if (code && institutionStore.getAll().some((i) => i.id !== initial?.id && i.accreditationCode.trim().toLowerCase() === code)) {
      e.accreditationCode = tr("Another institution already uses this accreditation code.");
    }
    return e;
  }

  // Institutions are stored in the database, so saving waits for the server:
  // it assigns a new institution's id, and it has the last word on what is valid.
  async function save() {
    const e = validate();
    setErrors(e);
    setSaveError(null);
    if (Object.keys(e).length || saving) return;

    const clean = {
      ...form,
      name: form.name.trim(),
      accreditationCode: form.accreditationCode.trim(),
      email: form.email.trim(),
      website: form.website.trim(),
      motto: form.motto.trim(),
      description: form.description.trim(),
      applicationsMessage: form.applicationsMessage.trim(),
      // Left empty, the institution uses the platform web fee.
      webFee: form.webFee.trim() ? Math.round(Number(form.webFee)) : null,
    };
    setSaving(true);
    const result = await institutionStore.save!(clean, initial?.id);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors as Errors);
      setSaveError(result.error);
      return;
    }
    router.push(`/admin/institutions/${result.item.id}`);
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form
      className="max-w-3xl space-y-6"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
    >
      <Section title={tr("Institution")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("Institution type")} required error={errors.typeId}>
            <ParamSelect items={selectableParams(types, form.typeId)} value={form.typeId} onChange={(v) => set("typeId", v)} />
          </Field>
          <Field label={tr("Institution name")} required error={errors.name}>
            <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={tr("Accredited by")} required error={errors.accreditationBodyId}>
            <ParamSelect
              items={selectableParams(bodies, form.accreditationBodyId)}
              value={form.accreditationBodyId}
              onChange={(v) => set("accreditationBodyId", v)}
              render={(p) => `${p.code} — ${p.label}${p.countryId && countryNames.get(p.countryId) ? ` (${countryNames.get(p.countryId)})` : ""}`}
            />
          </Field>
          <Field label={tr("Accreditation code")} required error={errors.accreditationCode} hint={tr("As printed on the accreditation certificate.")}>
            <TextInput value={form.accreditationCode} onChange={(e) => set("accreditationCode", e.target.value)} placeholder={tr("e.g. MINESUP/UNI/2009/014")} />
          </Field>
        </div>
      </Section>

      <Section title={tr("Profile")}>
        <div className="space-y-5">
          <Field label={tr("Logo")} error={errors.logoFileId} hint={tr("PNG or JPG, up to 1 MB. A square image works best. Applicants see it beside the institution's name.")}>
            <LogoUpload value={form.logoFileId} onChange={(id) => set("logoFileId", id)} />
          </Field>
          <Field label={tr("Motto")} error={errors.motto}>
            <TextInput value={form.motto} maxLength={MOTTO_MAX_CHARS} onChange={(e) => set("motto", e.target.value)} placeholder={tr("e.g. Knowledge, Discipline, Service")} />
          </Field>
          <Field label={tr("About the institution")} error={errors.description} hint={tr("A brief description for applicants: what it is, what it is known for.")}>
            <TextArea rows={6} maxLength={DESCRIPTION_MAX_CHARS} value={form.description} onChange={(e) => set("description", e.target.value)} />
            <p className={`mt-1 text-xs ${wordCount(form.description) > DESCRIPTION_MAX_WORDS ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-ink-faint)]"}`} aria-live="polite">
              {tr("{words} of {max} words", { words: wordCount(form.description), max: DESCRIPTION_MAX_WORDS })}
            </p>
          </Field>
        </div>
      </Section>

      <Section title={tr("Address and location")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={tr("Address")} required error={errors.address}>
              <TextArea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={tr("BP 1024, Route de Mont Fébé")} />
            </Field>
          </div>
          <LocationSelect
            country
            leaf="quarters"
            value={{ countryId, regionId: form.regionId, townId: form.townId, leafId: form.quarterId }}
            onChange={setLocation}
            required={{ country: true, region: true, town: true }}
            errors={{ country: errors.countryId, region: errors.regionId, town: errors.townId }}
          />
          <Field label={tr("Location")} hint={tr("GPS coordinates or a landmark.")}>
            <TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="3.8912° N, 11.4987° E" />
          </Field>
        </div>
      </Section>

      <Section title={tr("Contact")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("Contact name")} required error={errors.contactName}>
            <TextInput value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Field>
          <Field label={tr("Phone")} required error={errors.phone}>
            <TextInput type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+237 222 20 14 00" />
          </Field>
          <Field label={tr("Email")} required error={errors.email}>
            <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={tr("Website")} error={errors.website}>
            <TextInput type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder={tr("https://")} />
          </Field>
        </div>
      </Section>

      <Section title={tr("Applications")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("Applications")}>
            <SelectInput value={form.applicationsMode} onChange={(e) => set("applicationsMode", e.target.value as Draft["applicationsMode"])}>
              <option value="OPEN">{tr("Open now")}</option>
              <option value="SCHEDULED">{tr("Open between two dates")}</option>
              <option value="CLOSED">{tr("Closed")}</option>
            </SelectInput>
          </Field>
          {form.applicationsMode === "SCHEDULED" && (
            <Field label={tr("Opens")} required error={errors.applicationsOpenAt}>
              <TextInput type="datetime-local" value={toLocalInput(form.applicationsOpenAt)} onChange={(e) => set("applicationsOpenAt", fromLocalInput(e.target.value) ?? "")} />
            </Field>
          )}
          {form.applicationsMode !== "CLOSED" && (
            <Field label={form.applicationsMode === "OPEN" ? tr("Closes (optional)") : tr("Closes")} required={form.applicationsMode === "SCHEDULED"} error={errors.applicationsCloseAt}>
              <TextInput type="datetime-local" value={toLocalInput(form.applicationsCloseAt)} onChange={(e) => set("applicationsCloseAt", fromLocalInput(e.target.value) ?? "")} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label={tr("Message to applicants while closed (optional)")} error={errors.applicationsMessage}>
              <TextInput value={form.applicationsMessage} maxLength={300} onChange={(e) => set("applicationsMessage", e.target.value)} placeholder={tr("e.g. Applications for the 2027 intake open in March.")} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={tr("Platform settings")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("Web fee (XAF)")} error={errors.webFee} hint={tr("Leave empty to use the platform web fee from Payment configuration. Charged on every application to this institution, on top of its own fee.")}>
            <TextInput inputMode="numeric" value={form.webFee} onChange={(e) => set("webFee", e.target.value)} placeholder="2500" />
          </Field>
          <Field label={tr("Status")}>
            <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
              <option value="ACTIVE">{tr("Active")}</option>
              <option value="INACTIVE">{tr("Inactive")}</option>
            </SelectInput>
          </Field>
        </div>
      </Section>

      {errorCount > 0 && <FormError>{tr("Fix the")}{" "}{errorCount === 1 ? "field" : `${errorCount} fields`}{" "}{tr("marked above to save.")}</FormError>}
      {saveError && errorCount === 0 && <FormError>{tr("Not saved. {saveError}", { saveError })}</FormError>}

      <div className="flex items-center gap-3">
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? tr("Saving…") : initial ? tr("Save changes") : tr("Add institution")}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => router.back()}>
          {tr("Cancel")}
        </SecondaryButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold text-base text-[var(--color-ink)]">{title}</h2>
      {children}
    </Card>
  );
}

function ParamSelect({
  items,
  value,
  onChange,
  disabled,
  placeholder = "Select…",
  render = (p) => p.label,
  id,
}: {
  items: ParamItem[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  render?: (p: ParamItem) => string;
  id?: string;
}) {
  const tr = useT();
  placeholder = tr(placeholder);
  return (
    <SelectInput id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{tr(placeholder)}</option>
      {items.map((p) => (
        <option key={p.id} value={p.id}>
          {render(p)}
          {p.status === "INACTIVE" ? " (inactive)" : ""}
        </option>
      ))}
    </SelectInput>
  );
}
