"use client";

import { useState } from "react";
import { Field, TextInput, SelectInput, TextArea } from "@/components/Form";
import { PrimaryButton, SecondaryButton } from "@/components/Form";
import { addStaff, updateStaff, StaffMember } from "@/lib/mockData/staff";

export default function StaffForm({ institutionId, initial }: { institutionId: string; initial?: StaffMember }) {
  const [staffId, setStaffId] = useState(initial?.staffId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [position, setPosition] = useState(initial?.position ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [role, setRole] = useState<"INSTITUTION_ADMIN" | "INSTITUTION_ADMISSION_USER">(
    (initial?.role as "INSTITUTION_ADMIN" | "INSTITUTION_ADMISSION_USER") ?? "INSTITUTION_ADMISSION_USER"
  );
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">((initial?.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE");
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions ?? []);

  function togglePerm(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function submit() {
    if (initial) {
      updateStaff(initial.id, { staffId, name, position, title, role: role as any, status: status as any, permissions: permissions as any });
      alert("Staff updated (mock)");
    } else {
      const id = `s-${Math.floor(Math.random() * 10000)}`;
      addStaff({ id, institutionId, staffId, name, position, title, role: role as any, status: status as any, permissions: permissions as any });
      alert("Staff added (mock)");
      setStaffId("");
      setName("");
      setPosition("");
      setTitle("");
      setRole("INSTITUTION_ADMISSION_USER");
      setPermissions([]);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Staff ID">
        <TextInput value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="STAFF-001" />
      </Field>
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Position">
        <TextInput value={position} onChange={(e) => setPosition(e.target.value)} />
      </Field>
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Role">
        <SelectInput value={role} onChange={(e) => setRole(e.target.value as "INSTITUTION_ADMIN" | "INSTITUTION_ADMISSION_USER") }>
          <option value="INSTITUTION_ADMISSION_USER">Admission User</option>
          <option value="INSTITUTION_ADMIN">Administrator</option>
        </SelectInput>
      </Field>
      <Field label="Status">
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE") }>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectInput>
      </Field>

      <div>
        <p className="mb-2 text-sm text-[var(--color-ink-soft)]">Permissions</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={permissions.includes("PAYMENTS_UPLOADS")} onChange={() => togglePerm("PAYMENTS_UPLOADS")} />
            <span className="text-sm">Student Payments & Uploads</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={permissions.includes("ACKNOWLEDGED_APPS")} onChange={() => togglePerm("ACKNOWLEDGED_APPS")} />
            <span className="text-sm">Acknowledged Applications</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={permissions.includes("REJECTED_APPS")} onChange={() => togglePerm("REJECTED_APPS")} />
            <span className="text-sm">Rejected Applications</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={permissions.includes("DELIBERATION")} onChange={() => togglePerm("DELIBERATION")} />
            <span className="text-sm">Deliberation List</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <PrimaryButton onClick={submit}>{initial ? "Save" : "Create"}</PrimaryButton>
        <SecondaryButton onClick={() => window.history.back()}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
