import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AdminPayouts } from "@/components/admin/payouts/AdminPayouts";

export default function AdminPayoutsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AdminPayouts />
    </main>
  );
}
