import { useMemo } from "react";
import { applicationStore, studentStore, studentName, type AdminApplication, type AdminStudent } from "./students";
import { institutionStore, type AdminInstitution } from "./institutions";
import { parameterStore, sortParams, type ParamCategory, type ParamItem } from "./parameters";

/**
 * Everything the admin screens read, with id lookups built once. Screens
 * call this instead of wiring four stores together themselves.
 */
export function useAdminData() {
  const students = studentStore.useItems();
  const applications = applicationStore.useItems();
  const institutions = institutionStore.useItems();
  const params = parameterStore.useItems();

  return useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const institutionById = new Map(institutions.map((i) => [i.id, i]));
    const paramById = new Map(params.map((p) => [p.id, p]));
    const appsByStudent = new Map<string, AdminApplication[]>();
    for (const a of applications) {
      const list = appsByStudent.get(a.studentId) ?? [];
      list.push(a);
      appsByStudent.set(a.studentId, list);
    }

    const label = (id: string | undefined) => (id ? paramById.get(id)?.label ?? "Unknown" : "—");
    const category = (c: ParamCategory): ParamItem[] => sortParams(params.filter((p) => p.category === c));
    const options = (c: ParamCategory) => category(c).map((p) => ({ value: p.id, label: p.status === "ACTIVE" ? p.label : `${p.label} (inactive)` }));

    return {
      students,
      applications,
      institutions,
      params,
      studentById,
      institutionById,
      paramById,
      appsByStudent,
      label,
      category,
      options,
      institutionOptions: [...institutions]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ value: i.id, label: i.status === "ACTIVE" ? i.name : `${i.name} (inactive)` })),
      studentLabel: (id: string) => studentName(studentById.get(id)),
      institutionName: (id: string) => institutionById.get(id)?.name ?? "Unknown institution",
    };
  }, [students, applications, institutions, params]);
}

export type AdminData = ReturnType<typeof useAdminData>;
export type { AdminApplication, AdminStudent, AdminInstitution };
