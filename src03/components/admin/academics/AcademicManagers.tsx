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
  };
}

const sameCode = <T extends { id: string; institutionId: string; code: string }>(draft: T, all: T[], editingId: string | null) =>
  all.some((x) => x.id !== editingId && x.institutionId === draft.institutionId && x.code.toLowerCase() === draft.code.toLowerCase());

const muted = (text: string) => <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{text}</p>;

// ---------------------------------------------------------------------------
// Faculty / School
// ---------------------------------------------------------------------------

export function FacultyManager() {
  const l = useLookups();
  return (
    <RecordManager<AdminFaculty>
      title="Faculty / School"
      description="The faculties and schools every institution is organised into. Departments and programs sit under them."
      singular="faculty"
      plural="faculties"
      store={facultyStore}
      idPrefix="fac"
      nameOf={(f) => f.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder="Name, code, dean, email"
      searchText={(f) => [f.name, f.code, f.dean, f.email, l.institutionName(f.institutionId)]}
      filters={[{ key: "inst", label: "Institution", options: l.institutionOptions, get: (f) => f.institutionId }]}
      stats={(items) => [
        { label: "Faculties", value: items.length },
        { label: "Active", value: items.filter((f) => f.status === "ACTIVE").length },
        { label: "Institutions covered", value: new Set(items.map((f) => f.institutionId)).size, detail: `of ${l.institutions.length}` },
        { label: "Departments", value: l.departments.length, href: "/admin/departments" },
      ]}
      blank={() => ({ id: "", institutionId: "", name: "", code: "", dean: "", email: "", phone: "", address: "", status: "ACTIVE", updatedAt: "" })}
      fields={[
        { key: "institutionId", label: "Institution", kind: "select", required: true, options: l.institutionOptions, lockedOnEdit: true, wide: true },
        { key: "name", label: "Name", kind: "text", required: true, placeholder: "Faculty of Science" },
        { key: "code", label: "Code", kind: "text", required: true, uppercase: true, placeholder: "SCI", hint: "Short code, unique within the institution." },
        { key: "dean", label: "Dean or director", kind: "text", required: true },
        { key: "email", label: "Email", kind: "email" },
        { key: "phone", label: "Phone", kind: "text" },
        { key: "address", label: "Address", kind: "text" },
      ]}
      validate={(d, all, editingId) => ({ code: sameCode(d, all, editingId) ? "Another faculty at this institution already uses this code." : undefined })}
      deactivateBlocker={(f) =>
        l.departments.some((d) => d.facultyId === f.id && d.status === "ACTIVE") ? "Deactivate this faculty's departments first." : null
      }
      columns={[
        {
          label: "Faculty",
          render: (f) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{f.name}</p>
              {muted(f.code)}
            </>
          ),
        },
        {
          label: "Institution",
          render: (f) => (
            <Link href={`/admin/institutions/${f.institutionId}`} className="text-[var(--color-ink)] hover:underline">
              {l.institutionName(f.institutionId)}
            </Link>
          ),
        },
        {
          label: "Dean",
          render: (f) => (
            <>
              <p className="text-[var(--color-ink)]">{f.dean}</p>
              {f.email && muted(f.email)}
            </>
          ),
        },
        { label: "Departments", align: "right", render: (f) => l.departments.filter((d) => d.facultyId === f.id).length },
        { label: "Programs", align: "right", render: (f) => l.programs.filter((p) => p.facultyId === f.id).length },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export function DepartmentManager() {
  const l = useLookups();
  const allFacultyOptions = l.faculties.map((f) => ({ value: f.id, label: `${f.name} — ${l.institutionName(f.institutionId)}` }));
  return (
    <RecordManager<AdminDepartment>
      title="Departments"
      description="Departments within each faculty. Study programs are attached to a department."
      singular="department"
      plural="departments"
      store={departmentStore}
      idPrefix="dep"
      nameOf={(d) => d.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder="Name, code, head of department"
      searchText={(d) => [d.name, d.code, d.head, d.email, l.facultyName(d.facultyId), l.institutionName(d.institutionId)]}
      filters={[
        { key: "inst", label: "Institution", options: l.institutionOptions, get: (d) => d.institutionId },
        { key: "fac", label: "Faculty", options: allFacultyOptions, get: (d) => d.facultyId },
      ]}
      stats={(items) => [
        { label: "Departments", value: items.length },
        { label: "Active", value: items.filter((d) => d.status === "ACTIVE").length },
        { label: "Faculties", value: l.faculties.length, href: "/admin/faculty" },
        { label: "Programs", value: l.programs.length, href: "/admin/programs" },
      ]}
      blank={() => ({ id: "", institutionId: "", facultyId: "", name: "", code: "", head: "", email: "", phone: "", status: "ACTIVE", updatedAt: "" })}
      fields={[
        { key: "institutionId", label: "Institution", kind: "select", required: true, options: l.institutionOptions, resets: ["facultyId"], lockedOnEdit: true },
        {
          key: "facultyId",
          label: "Faculty",
          kind: "select",
          required: true,
          options: (d) => l.facultyOptions(d.institutionId),
          hint: "Choose the institution first.",
        },
        { key: "name", label: "Name", kind: "text", required: true, placeholder: "Department of Computer Science" },
        { key: "code", label: "Code", kind: "text", required: true, uppercase: true, placeholder: "CS" },
        { key: "head", label: "Head of department", kind: "text", required: true },
        { key: "email", label: "Email", kind: "email" },
        { key: "phone", label: "Phone", kind: "text" },
      ]}
      validate={(d, all, editingId) => ({ code: sameCode(d, all, editingId) ? "Another department at this institution already uses this code." : undefined })}
      deactivateBlocker={(d) => (l.programs.some((p) => p.departmentId === d.id && p.status === "ACTIVE") ? "Deactivate this department's programs first." : null)}
      columns={[
        {
          label: "Department",
          render: (d) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{d.name}</p>
              {muted(d.code)}
            </>
          ),
        },
        {
          label: "Faculty",
          render: (d) => (
            <>
              <p className="text-[var(--color-ink)]">{l.facultyName(d.facultyId)}</p>
              {muted(l.institutionName(d.institutionId))}
            </>
          ),
        },
        {
          label: "Head",
          render: (d) => (
            <>
              <p className="text-[var(--color-ink)]">{d.head}</p>
              {d.email && muted(d.email)}
            </>
          ),
        },
        { label: "Programs", align: "right", render: (d) => l.programs.filter((p) => p.departmentId === d.id).length },
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
  const l = useLookups();
  return (
    <RecordManager<AdminProgram>
      title="Qualifications / Study Programs"
      description="Every study program applicants can choose, with the qualification it leads to and the places on offer."
      singular="program"
      plural="programs"
      store={programStore}
      idPrefix="prog"
      nameOf={(p) => p.name}
      sort={(a, b) => l.institutionName(a.institutionId).localeCompare(l.institutionName(b.institutionId)) || a.name.localeCompare(b.name)}
      searchPlaceholder="Program name or code"
      searchText={(p) => [p.name, p.code, l.departmentName(p.departmentId), l.facultyName(p.facultyId), l.institutionName(p.institutionId)]}
      filters={[
        { key: "inst", label: "Institution", options: l.institutionOptions, get: (p) => p.institutionId },
        { key: "qual", label: "Qualification", options: l.qualificationOptions, get: (p) => p.qualificationId },
      ]}
      stats={(items) => {
        const active = items.filter((p) => p.status === "ACTIVE");
        return [
          { label: "Programs", value: items.length },
          { label: "Active", value: active.length },
          { label: "Places on offer", value: active.reduce((s, p) => s + (p.availableSpaces || 0), 0).toLocaleString("en-GB"), detail: "Across active programs" },
          { label: "Qualification types", value: l.qualificationOptions.length, href: "/admin/parameters/application/qualification-types" },
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
        { key: "institutionId", label: "Institution", kind: "select", required: true, options: l.institutionOptions, resets: ["facultyId", "departmentId"], lockedOnEdit: true, wide: true },
        { key: "facultyId", label: "Faculty", kind: "select", required: true, options: (p) => l.facultyOptions(p.institutionId), resets: ["departmentId"] },
        { key: "departmentId", label: "Department", kind: "select", required: true, options: (p) => l.departmentOptions(p.facultyId) },
        { key: "name", label: "Program name", kind: "text", required: true, placeholder: "BSc Computer Science" },
        { key: "code", label: "Program code", kind: "text", required: true, uppercase: true, placeholder: "SCI-CS-001" },
        {
          key: "qualificationId",
          label: "Qualification",
          kind: "select",
          required: true,
          options: l.qualificationOptions,
          hint: "Managed under Application parameters → Qualification types.",
        },
        { key: "durationYears", label: "Duration (years)", kind: "number", required: true, min: 0.5, max: 8, step: 0.5 },
        { key: "studyMode", label: "Study mode", kind: "select", required: true, options: modeOptions },
        { key: "language", label: "Teaching language", kind: "select", required: true, options: languageOptions },
        { key: "availableSpaces", label: "Places available", kind: "number", required: true, min: 0, max: 100000, hint: "For the current intake." },
      ]}
      validate={(p, all, editingId) => ({ code: sameCode(p, all, editingId) ? "Another program at this institution already uses this code." : undefined })}
      columns={[
        {
          label: "Program",
          render: (p) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{p.name}</p>
              {muted(`${p.code} · ${STUDY_MODE_LABELS[p.studyMode]} · ${LANGUAGE_LABELS[p.language]}`)}
            </>
          ),
        },
        {
          label: "Institution",
          render: (p) => (
            <>
              <p className="text-[var(--color-ink)]">{l.institutionName(p.institutionId)}</p>
              {muted(`${l.facultyName(p.facultyId)} · ${l.departmentName(p.departmentId)}`)}
            </>
          ),
        },
        {
          label: "Qualification",
          render: (p) => (
            <>
              <p className="text-[var(--color-ink)]">{l.qualificationName(p.qualificationId)}</p>
              {muted(`${p.durationYears} ${p.durationYears === 1 ? "year" : "years"}`)}
            </>
          ),
        },
        { label: "Places", align: "right", render: (p) => p.availableSpaces.toLocaleString("en-GB") },
      ]}
    />
  );
}
