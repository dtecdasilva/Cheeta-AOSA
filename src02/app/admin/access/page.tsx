import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AccessManager } from "@/components/admin/system/AccessManager";

export default function AdminAccessPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AccessManager />
    </main>
  );
}
