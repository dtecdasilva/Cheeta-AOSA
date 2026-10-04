import { PAGE_MAIN_CLASS } from "@/components/ui";
import { SystemConfig } from "@/components/admin/system/SystemConfig";

export default function AdminConfigPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <SystemConfig />
    </main>
  );
}
