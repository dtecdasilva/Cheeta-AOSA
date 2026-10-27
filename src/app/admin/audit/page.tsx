import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AdminAuditLog } from "@/components/audit/AdminAuditLog";

export default function AdminAuditPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AdminAuditLog />
    </main>
  );
}
