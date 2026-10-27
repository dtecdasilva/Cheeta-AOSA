"use client";

import { institutionStore } from "@/lib/admin/institutions";
import { AuditLog } from "./AuditLog";

/** Cheeta administration's audit trail, with every institution to filter by. */
export function AdminAuditLog() {
  const institutions = institutionStore.useItems();
  return <AuditLog scope="admin" institutions={[...institutions].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({ value: i.id, label: i.name }))} />;
}
