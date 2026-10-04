import { PAGE_MAIN_CLASS } from "@/components/ui";
import { CurrencyManager } from "@/components/admin/system/ReferenceManagers";

export default function AdminConfigCurrenciesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <CurrencyManager />
    </main>
  );
}
