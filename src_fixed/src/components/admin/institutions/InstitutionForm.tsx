"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput, ButtonLinkClass } from "@/components/Form";
import { institutionStore, type AdminInstitution } from "@/lib/admin/institutions";
import { selectableParams, useParameters, type ParamItem } from "@/lib/admin/parameters";
import { newId, useHydrated } from "@/lib/admin/store";
import { LocationSelect, type LocationValue } from "@/components/location/LocationSelect";

type Draft = Omit<AdminInstitution, "id" | "createdAt" | "updatedAt" | "webFee"> & { webFee: string };
type Errors = Partial<Record<keyof Draft, string>>;

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
  status: "ACTIVE",
  webFee: "",
};

/** Wrapper: resolves the record (for edit) before mounting the form. */
export function InstitutionFormScreen({ id }: { id?: string }) {
  const hydrated = useHydrated();
  const institutions = institutionStore.useItems();
  if (!id) return <InstitutionForm />;
  const record = institutions.find((i) => i.id === id);
  if (!record) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <EmptyState
        message="This institution doesn't exist. It may have been added in another browser."
        action={
          <Link href="/admin/institutions" className={ButtonLinkClass("secondary")}>
            Back to institutions
          </Link>
        }
      />
    );
  }
  return <InstitutionForm initial={record} />;
}

function InstitutionForm({ initial }: { initial?: AdminInstitution }) {
  const router = useRouter();
  const types = useParameters("institution-types");
  const bodies = useParameters("accreditation-bodies");

  const [form, setForm] = useState<Draft>(() => (initial ? { ...initial, webFee: String(initial.webFee) } : EMPTY));
  const [errors, setErrors] = useState<Errors>({});

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // Region → town → quarter; LocationSelect clears levels that no longer fit.
  function setLocation(next: LocationValue) {
    setForm((f) => ({ ...f, regionId: next.regionId, townId: next.townId, quarterId: next.leafId }));
    setErrors((e) => ({ ...e, regionId: undefined, townId: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    const required: [keyof Draft, string][] = [
      ["typeId", "Choose an institution type."],
      ["name", "Enter the institution's name."],
      ["accreditationBodyId", "Choose who accredited the institution."],
      ["accreditationCode", "Enter the accreditation code."],
      ["address", "Enter the postal or street address."],
      ["regionId", "Choose a region."],
      ["townId", "Choose a town."],
      ["contactName", "Enter a contact name."],
      ["phone", "Enter a phone number."],
      ["email", "Enter an email address."],
      ["webFee", "Enter the web fee, or 0 for none."],
    ];
    for (const [k, msg] of required) if (!String(form[k]).trim()) e[k] = msg;

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter an email address like admissions@school.cm.";
    if (form.phone && form.phone.replace(/\D/g, "").length < 8) e.phone = "Enter a phone number with at least 8 digits.";
    if (form.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(form.website.trim())) e.website = "Enter a full address starting with https://.";
    if (form.webFee.trim()) {
      const fee = Number(form.webFee);
      if (!Number.isFinite(fee) || fee < 0) e.webFee = "Enter an amount of 0 or more.";
    }
    const code = form.accreditationCode.trim().toLowerCase();
    if (code && institutionStore.getAll().some((i) => i.id !== initial?.id && i.accreditationCode.trim().toLowerCase() === code)) {
      e.accreditationCode = "Another institution already uses this accreditation code.";
    }
    return e;
  }

  function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const now = new Date().toISOString();
    const clean = {
      ...form,
      name: form.name.trim(),
      accreditationCode: form.accreditationCode.trim(),
      email: form.email.trim(),
      website: form.website.trim(),
      webFee: Math.round(Number(form.webFee)),
    };
    if (initial) {
      institutionStore.update(initial.id, { ...clean, updatedAt: now });
      router.push(`/admin/institutions/${initial.id}`);
    } else {
      const id = newId("inst");
      institutionStore.add({ ...clean, id, createdAt: now, updatedAt: now });
      router.push(`/admin/institutions/${id}`);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form
      className="max-w-3xl space-y-6"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
    >
      <Section title="Institution">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Institution type" required error={errors.typeId}>
            <ParamSelect items={selectableParams(types, form.typeId)} value={form.typeId} onChange={(v) => set("typeId", v)} />
          </Field>
          <Field label="Institution name" required error={errors.name}>
            <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Accredited by" required error={errors.accreditationBodyId}>
            <ParamSelect
              items={selectableParams(bodies, form.accreditationBodyId)}
              value={form.accreditationBodyId}
              onChange={(v) => set("accreditationBodyId", v)}
              render={(p) => `${p.code} — ${p.label}`}
            />
          </Field>
          <Field label="Accreditation code" required error={errors.accreditationCode} hint="As printed on the accreditation certificate.">
            <TextInput value={form.accreditationCode} onChange={(e) => set("accreditationCode", e.target.value)} placeholder="e.g. MINESUP/UNI/2009/014" />
          </Field>
        </div>
      </Section>

      <Section title="Address and location">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address" required error={errors.address}>
              <TextArea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="BP 1024, Route de Mont Fébé" />
            </Field>
          </div>
          <LocationSelect
            leaf="quarters"
            value={{ regionId: form.regionId, townId: form.townId, leafId: form.quarterId }}
            onChange={setLocation}
            required={{ region: true, town: true }}
            errors={{ region: errors.regionId, town: errors.townId }}
          />
          <Field label="Location" hint="GPS coordinates or a landmark.">
            <TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="3.8912° N, 11.4987° E" />
          </Field>
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact name" required error={errors.contactName}>
            <TextInput value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <TextInput type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+237 222 20 14 00" />
          </Field>
          <Field label="Email" required error={errors.email}>
            <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Website" error={errors.website}>
            <TextInput type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </Section>

      <Section title="Platform settings">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Web fee (XAF)" required error={errors.webFee} hint="Charged on every application to this institution, on top of its own fee.">
            <TextInput inputMode="numeric" value={form.webFee} onChange={(e) => set("webFee", e.target.value)} placeholder="2500" />
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectInput>
          </Field>
        </div>
      </Section>

      {errorCount > 0 && <FormError>Fix the {errorCount === 1 ? "field" : `${errorCount} fields`} marked above to save.</FormError>}

      <div className="flex items-center gap-3">
        <PrimaryButton type="submit">{initial ? "Save changes" : "Add institution"}</PrimaryButton>
        <SecondaryButton type="button" onClick={() => router.back()}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">{title}</h2>
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
  return (
    <SelectInput id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {items.map((p) => (
        <option key={p.id} value={p.id}>
          {render(p)}
          {p.status === "INACTIVE" ? " (inactive)" : ""}
        </option>
      ))}
    </SelectInput>
  );
}
