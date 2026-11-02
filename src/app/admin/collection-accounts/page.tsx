import { PAGE_MAIN_CLASS } from "@/components/ui";
import { CollectionAccountManager } from "@/components/admin/payments/CollectionAccountManager";

export default function CollectionAccountsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <CollectionAccountManager />
    </main>
  );
}
