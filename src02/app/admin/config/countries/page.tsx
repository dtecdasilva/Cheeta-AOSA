import { PAGE_MAIN_CLASS } from "@/components/ui";
import { CountryManager } from "@/components/admin/system/ReferenceManagers";

export default function AdminConfigCountriesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <CountryManager />
    </main>
  );
}
