"use client";

import Link from "next/link";
import { RecordManager, type Option } from "@/components/admin/RecordManager";
import { institutionStore } from "@/lib/admin/institutions";
import { parameterStore, sortParams } from "@/lib/admin/parameters";
import {
  departmentStore,
  facultyStore,
  programStore,
  LANGUAGE_LABELS,
  STUDY_MODE_LABELS,
  type AdminDepartment,
  type AdminFaculty,
  type AdminProgram,
} from "@/lib/admin/academics";
import { useT } from "@/lib/i18n/client";

/**
 * Faculty / School, Departments and Qualifications / Programs across
 * every institution. The institution portal manages its own slice of the
 * same records; here AOSA sees and corrects all of them.
 */

function useLookups() {
  const institutions = institutionStore.useItems();
  const faculties = facultyStore.useItems();
  const departments = departmentStore.useItems();
  const programs = programStore.useItems();
  const params = parameterStore.useItems();

  const institutionName = (id: string) => institutions.find((i) => i.id === id)?.name ?? "Unknown institution";
  const institutionOptions: Option[] = [...institutions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => ({ value: i.id, label: i.status === "ACTIVE" ? i.name : `${i.name} (inactive)` }));
  const facultyOptions = (institutionId: string): Option[] =>
    faculties
      .filter((f) => f.institutionId === institutionId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ value: f.id, label: f.status === "ACTIVE" ? f.name : `${f.name} (inactive)` }));
  const departmentOptions = (facultyId: string): Option[] =>
    departments
      .filter((d) => d.facultyId === facultyId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ value: d.id, label: d.status === "ACTIVE" ? d.name : `${d.name} (inactive)` }));
  const qualifications = sortParams(params.filter((p) => p.category === "qualification-types"));

  return {
    institutions,
    faculties,
    departments,
    programs,
    institutionName,
    institutionOptions,
    facultyOptions,
    departmentOptions,
    facultyName: (id: string) => faculties.find((f) => f.id === id)?.name ?? "—",
    departmentName: (id: string) => departments.find((d) => d.id === id)?.name ?? "—",
    qualificationOptions: qualifications.map((q) => ({ value: q.id, label: q.status === "ACTIVE" ? q.label : `${q.label} (inactive)` })),
    qualificationName: (id: string) => qualifications.find((q) => q.id === id)?.label ?? "—",
    placeOptions: (category: "regions" | "towns") => sortParams(params.filter((p) => p.category === category)).map((p) => ({ value: p.id, label: p.label })),
    placeName: (id: string | null | undefined) => (id ? params.find((p) => p.id === id)?.label ?? "" : ""),
  };
}

const sameCode = <T extends { id: string; institutionId: string; code: string }>(draft: T, all: T[], editingId: string | null) =>
  all.some((x) => x.id !== editingId && x.institutionId === draft.institutionId && x.code.toLowerCase() === draft.code.toLowerCase());

const muted = (text: string) => <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{text}</p>;

// ---------------------------------------------------------------------------
// Faculty / School
// ---------------------------------------------------------------------------

export function FacultyManager() {
  const tr = useT();
  const l = useLookups();
  return (
    <RecordManager<AdminFaculty>
      title={tr("Faculty / School")}
      description={tr("The faculties and schools every institution is organised into. Each institution manages its own; here you can view them and switch them on or off.")}
      singular={tr("faculty")}
      plural={tr("faculties")}
      store={facultyStore}
      idPrefix="fac"
      nameOf={(f) => f.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder={tr("Name, code, dean, email")}
      searchText={(f) => [f.name, f.code, f.dean, f.email, l.institutionName(f.institutionId)]}
      filters={[{ key: "inst", label: tr("Institution"), options: l.institutionOptions, get: (f) => f.institutionId }]}
      stats={(items) => [
        { label: tr("Faculties"), value: items.length },
        { label: tr("Active"), value: items.filter((f) => f.status === "ACTIVE").length },
        { label: tr("Institutions covered"), value: new Set(items.map((f) => f.institutionId)).size, detail: `of ${l.institutions.length}` },
        { label: tr("Departments"), value: l.departments.length, href: "/admin/departments" },
      ]}
      blank={() => ({ id: "", institutionId: "", name: "", code: "", dean: "", email: "", phone: "", address: "", status: "ACTIVE", updatedAt: "" })}
      fields={[
        { key: "institutionId", label: tr("Institution"), kind: "select", required: true, options: l.institutionOptions, lockedOnEdit: true, wide: true },
        { key: "name", label: tr("Name"), kind: "text", required: true, placeholder: tr("Faculty of Science") },
        { key: "code", label: tr("Code"), kind: "text", required: true, uppercase: true, placeholder: "SCI", hint: tr("Short code, unique within the institution.") },
        { key: "dean", label: tr("Dean or director"), kind: "text", required: true },
        { key: "email", label: tr("Email"), kind: "email" },
        { key: "phone", label: tr("Phone"), kind: "text" },
        { key: "address", label: tr("Address"), kind: "text" },
        { key: "location", label: tr("Location"), kind: "text" },
        { key: "regionId", label: tr("Region"), kind: "select", options: l.placeOptions("regions") },
        { key: "townId", label: tr("Town"), kind: "select", options: l.placeOptions("towns") },
      ]}
      statusOnly
      validate={(d, all, editingId) => ({ code: sameCode(d, all, editingId) ? tr("Another faculty at this institution already uses this code.") : undefined })}
      deactivateBlocker={(f) =>
        l.departments.some((d) => d.facultyId === f.id && d.status === "ACTIVE") ? tr("Deactivate this faculty's departments first.") : null
      }
      columns={[
        {
          label: tr("Faculty"),
          render: (f) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(f.name)}</p>
              {muted(f.code)}
            </>
          ),
        },
        {
          label: tr("Institution"),
          render: (f) => (
            <Link href={`/admin/institutions/${f.institutionId}`} className="text-[var(--color-ink)] hover:underline">
              {l.institutionName(f.institutionId)}
            </Link>
          ),
        },
        {
          label: tr("Dean"),
          render: (f) => (
            <>
              <p className="text-[var(--color-ink)]">{tr(f.dean)}</p>
              {f.email && muted(f.email)}
            </>
          ),
        },
        { label: tr("Town"), render: (f) => l.placeName(f.townId) || "—" },
        { label: tr("Departments"), align: "right", render: (f) => l.departments.filter((d) => d.facultyId === f.id).length },
        { label: tr("Programs"), align: "right", render: (f) => l.programs.filter((p) => p.facultyId === f.id).length },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export function DepartmentManager() {
  const tr = useT();
  const l = useLookups();
  const allFacultyOptions = l.faculties.map((f) => ({ value: f.id, label: `${f.name} — ${l.institutionName(f.institutionId)}` }));
  return (
    <RecordManager<AdminDepartment>
      title={tr("Departments")}
      description={tr("Departments within each faculty. Each institution manages its own; here you can view them and switch them on or off.")}
      singular={tr("department")}
      plural={tr("departments")}
      store={departmentStore}
      idPrefix="dep"
      nameOf={(d) => d.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder={tr("Name, code, head of department")}
      searchText={(d) => [d.name, d.code, d.head, d.email, l.facultyName(d.facultyId), l.institutionName(d.institutionId)]}
      filters={[
        { key: "inst", label: tr("Institution"), options: l.institutionOptions, get: (d) => d.institutionId },
        { key: "fac", label: tr("Faculty"), options: allFacultyOptions, get: (d) => d.facultyId },
      ]}
      stats={(items) => [
        { label: tr("Departments"), value: items.length },
        { label: tr("Active"), value: items.filter((d) => d.status === "ACTIVE").length },
        { label: tr("Faculties"), value: l.faculties.length, href: "/admin/faculty" },
        { label: tr("Programs"), value: l.programs.length, href: "/admin/programs" },
      ]}
      blank={() => ({ id: "", institutionId: "", facultyId: "", name: "", code: "", head: "", email: "", phone: "", status: "ACTIVE", updatedAt: "" })}
      fields={[
        { key: "institutionId", label: tr("Institution"), kind: "select", required: true, options: l.institutionOptions, resets: ["facultyId"], lockedOnEdit: true },
        {
          key: "facultyId",
          label: tr("Faculty"),
          kind: "select",
          required: true,
          options: (d) => l.facultyOptions(d.institutionId),
          hint: tr("Choose the institution first."),
        },
        { key: "name", label: tr("Name"), kind: "text", required: true, placeholder: tr("Department of Computer Science") },
        { key: "code", label: tr("Code"), kind: "text", required: true, uppercase: true, placeholder: "CS" },
        { key: "head", label: tr("Head of department"), kind: "text", required: true },
        { key: "email", label: tr("Email"), kind: "email" },
        { key: "phone", label: tr("Phone"), kind: "text" },
        { key: "address", label: tr("Address"), kind: "text" },
        { key: "location", label: tr("Location"), kind: "text" },
        { key: "regionId", label: tr("Region"), kind: "select", options: l.placeOptions("regions") },
        { key: "townId", label: tr("Town"), kind: "select", options: l.placeOptions("towns") },
      ]}
      statusOnly
      validate={(d, all, editingId) => ({ code: sameCode(d, all, editingId) ? tr("Another department at this institution already uses this code.") : undefined })}
      deactivateBlocker={(d) => (l.programs.some((p) => p.departmentId === d.id && p.status === "ACTIVE") ? tr("Deactivate this department's programs first.") : null)}
      columns={[
        {
          label: tr("Department"),
          render: (d) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(d.name)}</p>
              {muted(d.code)}
            </>
          ),
        },
        {
          label: tr("Faculty"),
          render: (d) => (
            <>
              <p className="text-[var(--color-ink)]">{l.facultyName(d.facultyId)}</p>
              {muted(l.institutionName(d.institutionId))}
            </>
          ),
        },
        {
          label: tr("Head"),
          render: (d) => (
            <>
              <p className="text-[var(--color-ink)]">{tr(d.head)}</p>
              {d.email && muted(d.email)}
            </>
          ),
        },
        { label: tr("Town"), render: (d) => l.placeName(d.townId) || "—" },
        { label: tr("Programs"), align: "right", render: (d) => l.programs.filter((p) => p.departmentId === d.id).length },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Qualifications / Programs
// ---------------------------------------------------------------------------

const modeOptions = Object.entries(STUDY_MODE_LABELS).map(([value, label]) => ({ value, label }));
const languageOptions = Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value, label }));

export function ProgramManager() {
  const tr = useT();
  const l = useLookups();
  return (
    <RecordManager<AdminProgram>
      title={tr("Qualifications / Study Programs")}
      description={tr("Every study program applicants can choose, with the qualification it leads to and the places on offer.")}
      singular={tr("program")}
      plural={tr("programs")}
      store={programStore}
      idPrefix="prog"
      nameOf={(p) => p.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder={tr("Program name or code")}
      searchText={(p) => [p.name, p.code, l.departmentName(p.departmentId), l.facultyName(p.facultyId), l.institutionName(p.institutionId)]}
      filters={[
        { key: "inst", label: tr("Institution"), options: l.institutionOptions, get: (p) => p.institutionId },
        { key: "qual", label: tr("Qualification"), options: l.qualificationOptions, get: (p) => p.qualificationId },
      ]}
      stats={(items) => {
        const active = items.filter((p) => p.status === "ACTIVE");
        return [
          { label: tr("Programs"), value: items.length },
          { label: tr("Active"), value: active.length },
          { label: tr("Places on offer"), value: active.reduce((s, p) => s + (p.availableSpaces || 0), 0).toLocaleString("en-GB"), detail: tr("Across active programs") },
          { label: tr("Qualification types"), value: l.qualificationOptions.length, href: "/admin/parameters/application/qualification-types" },
        ];
      }}
      blank={() => ({
        id: "",
        institutionId: "",
        facultyId: "",
        departmentId: "",
        code: "",
        name: "",
        qualificationId: "",
        durationYears: 3,
        studyMode: "FULL_TIME",
        language: "BILINGUAL",
        availableSpaces: 0,
        status: "ACTIVE",
        updatedAt: "",
      })}
      fields={[
        { key: "institutionId", label: tr("Institution"), kind: "select", required: true, options: l.institutionOptions, resets: ["facultyId", "departmentId"], lockedOnEdit: true, wide: true },
        { key: "facultyId", label: tr("Faculty"), kind: "select", required: true, options: (p) => l.facultyOptions(p.institutionId), resets: ["departmentId"] },
        { key: "departmentId", label: tr("Department"), kind: "select", required: true, options: (p) => l.departmentOptions(p.facultyId) },
        { key: "name", label: tr("Program name"), kind: "text", required: true, placeholder: tr("BSc Computer Science") },
        { key: "code", label: tr("Program code"), kind: "text", required: true, uppercase: true, placeholder: "SCI-CS-001" },
        {
          key: "qualificationId",
          label: tr("Qualification"),
          kind: "select",
          required: true,
          options: l.qualificationOptions,
          hint: tr("One of the institution's Anticipated Qualifications, which it chooses in its portal."),
        },
        { key: "durationYears", label: tr("Duration (years)"), kind: "number", required: true, min: 0.5, max: 8, step: 0.5 },
        { key: "studyMode", label: tr("Study mode"), kind: "select", required: true, options: modeOptions },
        { key: "language", label: tr("Teaching language"), kind: "select", required: true, options: languageOptions },
        { key: "availableSpaces", label: tr("Places available"), kind: "number", required: true, min: 0, max: 100000, hint: tr("For the current intake.") },
      ]}
      validate={(p, all, editingId) => ({ code: sameCode(p, all, editingId) ? tr("Another program at this institution already uses this code.") : undefined })}
      columns={[
        {
          label: tr("Program"),
          render: (p) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(p.name)}</p>
              {muted(`${p.code} · ${tr(STUDY_MODE_LABELS[p.studyMode])} · ${tr(LANGUAGE_LABELS[p.language])}`)}
            </>
          ),
        },
        {
          label: tr("Institution"),
          render: (p) => (
            <>
              <p className="text-[var(--color-ink)]">{l.institutionName(p.institutionId)}</p>
              {muted(`${l.facultyName(p.facultyId)} · ${l.departmentName(p.departmentId)}`)}
            </>
          ),
        },
        {
          label: tr("Qualification"),
          render: (p) => (
            <>
              <p className="text-[var(--color-ink)]">{l.qualificationName(p.qualificationId)}</p>
              {muted(`${p.durationYears} ${p.durationYears === 1 ? "year" : "years"}`)}
            </>
          ),
        },
        { label: tr("Places"), align: "right", render: (p) => p.availableSpaces.toLocaleString("en-GB") },
      ]}
    />
  );
}
