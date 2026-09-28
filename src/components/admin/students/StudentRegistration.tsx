"use client";

import { LocationSelect } from "@/components/location/LocationSelect";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Card, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass, Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, SubNav, STUDENT_NAV, usePaged } from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin/useAdminData";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { studentStore, type AdminStudent, type Gender } from "@/lib/admin/students";
import { groupByFamily, useExamConfiguration } from "@/lib/examination/mockConfig";
import { newId } from "@/lib/admin/store";
import { formatDate } from "@/lib/utils";

export function StudentRegistrationList() {
  const data = useAdminData();
  const [search, setSearch] = useState("");
  const [regionId, setRegionId] = useState("");
  const [gender, setGender] = useState("");
  const [source, setSource] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const inRangeStudents = useMemo(() => data.students.filter((s) => inRange(s.registeredAt, range)), [data.students, range]);
  const filtered = useMemo(
    () =>
      inRangeStudents
        .filter(
          (s) =>
            (!regionId || s.regionId === regionId) &&
            (!gender || s.gender === gender) &&
            (!source || s.source === source) &&
            matchesSearch(search, [s.firstName, s.lastName, s.registrationNo, s.email, s.phone, data.label(s.townId)])
        )
        .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)),
    [inRangeStudents, data, search, regionId, gender, source]
  );
  const { slice, ...pager } = usePaged(filtered, 20);
  const yetToApply = filtered.filter((s) => !data.appsByStudent.get(s.id)?.length).length;

  return (
    <>
      <SubNav items={STUDENT_NAV} current="/admin/students/register" />
      <PageHeading
        title="Student registration"
        description="Everyone who has an applicant account, newest first."
        actions={
          <Link href="/admin/students/register/new" className={ButtonLinkClass("primary")}>
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Register student
          </Link>
        }
      />

      <FilterBar
        active={!!(search || regionId || gender || source || range.from || range.to)}
        onClear={() => {
          setSearch("");
          setRegionId("");
          setGender("");
          setSource("");
          setRange(EMPTY_RANGE);
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Name, registration no., email, phone" />
        <DateRangeFilter value={range} onChange={setRange} label="Registered" />
        <FilterSelect label="Home region" value={regionId} onChange={setRegionId} options={data.options("regions")} />
        <FilterSelect label="Sex" value={gender} onChange={setGender} options={["Female", "Male"].map((g) => ({ value: g, label: g }))} />
        <FilterSelect
          label="How they registered"
          value={source}
          onChange={setSource}
          options={["Self-registered", "Registered by admin"].map((g) => ({ value: g, label: g }))}
        />
      </FilterBar>

      <StatStrip
        stats={[
          { label: "Registered", value: filtered.length },
          { label: "Self-registered", value: filtered.filter((s) => s.source === "Self-registered").length },
          { label: "Registered by an administrator", value: filtered.filter((s) => s.source === "Registered by admin").length },
          { label: "Yet to apply", value: yetToApply },
        ]}
      />

      <div className="mt-6">
        <ResultCount shown={filtered.length} total={data.students.length} noun="students" />
        {filtered.length === 0 ? (
          <EmptyState message="No students match these filters." />
        ) : (
          <>
            <TableFrame>
              <thead>
                <tr>
                  <Th>Registration no.</Th>
                  <Th>Student</Th>
                  <Th>Contact</Th>
                  <Th>Home</Th>
                  <Th>Highest qualification</Th>
                  <Th>Registered</Th>
                  <Th className="text-right">Applications</Th>
                </tr>
              </thead>
              <tbody>
                {slice.map((s) => (
                  <tr key={s.id} className="align-top">
                    <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">{s.registrationNo}</Td>
                    <Td>
                      <Link href={`/admin/students/${s.id}`} className="font-medium text-[var(--color-ink)] hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{s.gender}</p>
                    </Td>
                    <Td>
                      <p className="text-[var(--color-ink)]">{s.email}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{s.phone}</p>
                    </Td>
                    <Td>
                      <p className="text-[var(--color-ink)]">{data.label(s.townId)}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{data.label(s.regionId)}</p>
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">{s.highestQualification}</Td>
                    <Td className="whitespace-nowrap">
                      <p className="text-[var(--color-ink)]">{formatDate(s.registeredAt)}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{s.source}</p>
                    </Td>
                    <Td className="text-right tabular-nums">{data.appsByStudent.get(s.id)?.length ?? 0}</Td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <Pager {...pager} />
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

type Draft = Pick<AdminStudent, "firstName" | "lastName" | "dateOfBirth" | "email" | "phone" | "regionId" | "townId" | "address" | "highestQualification"> & {
  gender: Gender | "";
};

const EMPTY: Draft = { firstName: "", lastName: "", gender: "", dateOfBirth: "", email: "", phone: "", regionId: "", townId: "", address: "", highestQualification: "" };

export function StudentRegisterForm() {
  const router = useRouter();
  const exam = useExamConfiguration();
  const [form, setForm] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setForm((f) => ({ ...f, [k]: v, ...(k === "regionId" ? { townId: "" } : {}) }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function save() {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!form.firstName.trim()) e.firstName = "Enter a first name.";
    if (!form.lastName.trim()) e.lastName = "Enter a last name.";
    if (!form.gender) e.gender = "Choose the student's sex.";
    if (!form.dateOfBirth) e.dateOfBirth = "Enter a date of birth.";
    else if (form.dateOfBirth > new Date().toISOString().slice(0, 10)) e.dateOfBirth = "The date of birth can't be in the future.";
    if (!form.email.trim()) e.email = "Enter an email address. The student signs in with it.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter an email address like name@example.com.";
    else if (studentStore.getAll().some((s) => s.email.toLowerCase() === form.email.trim().toLowerCase())) e.email = "A student with this email is already registered.";
    if (!form.phone.trim()) e.phone = "Enter a phone number.";
    else if (form.phone.replace(/\D/g, "").length < 8) e.phone = "Enter a phone number with at least 8 digits.";
    if (!form.regionId) e.regionId = "Choose a region.";
    if (!form.townId) e.townId = "Choose a town.";
    setErrors(e);
    if (Object.keys(e).length) return;

    const all = studentStore.getAll();
    const now = new Date();
    const seq = all.length + 1;
    const id = newId("stu");
    studentStore.add({
      ...form,
      gender: form.gender as Gender,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      id,
      registrationNo: `CHT-${now.getFullYear()}-${String(seq).padStart(5, "0")}`,
      registeredAt: now.toISOString(),
      source: "Registered by admin",
    });
    router.push(`/admin/students/${id}`);
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/students/register" className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
          Student registration
        </Link>
      </p>
      <PageHeading title="Register a student" description="Create an applicant account on the student's behalf." />
      <form
        noValidate
        className="max-w-3xl space-y-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
      >
        <Card>
          <h2 className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">Personal details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName}>
              <TextInput value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              <TextInput value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Sex" required error={errors.gender}>
              <SelectInput value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
                <option value="">Select…</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </SelectInput>
            </Field>
            <Field label="Date of birth" required error={errors.dateOfBirth}>
              <TextInput type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Highest qualification" hint="Taken from the examination parameters.">
              <SelectInput value={form.highestQualification} onChange={(e) => set("highestQualification", e.target.value)}>
                <option value="">Not known</option>
                {groupByFamily(exam.types).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((t) => (
                      <option key={t.id} value={t.qualification}>
                        {t.qualification}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectInput>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-[var(--font-display)] text-base text-[var(--color-ink)]">Contact and home</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" required error={errors.email} hint="The student signs in with this address.">
              <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <TextInput type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+237 6XX XX XX XX" />
            </Field>
            <LocationSelect
              value={{ regionId: form.regionId, townId: form.townId, leafId: "" }}
              onChange={(next) => {
                setForm((f) => ({ ...f, regionId: next.regionId, townId: next.townId }));
                setErrors((e) => ({ ...e, regionId: undefined, townId: undefined }));
              }}
              required={{ region: true, town: true }}
              errors={{ region: errors.regionId, town: errors.townId }}
            />
            <div className="sm:col-span-2">
              <Field label="Address">
                <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        {errorCount > 0 && <FormError>Fix the {errorCount === 1 ? "field" : `${errorCount} fields`} marked above to register the student.</FormError>}

        <div className="flex items-center gap-3">
          <PrimaryButton type="submit">Register student</PrimaryButton>
          <SecondaryButton type="button" onClick={() => router.back()}>
            Cancel
          </SecondaryButton>
        </div>
      </form>
    </>
  );
}
