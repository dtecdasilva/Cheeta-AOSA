import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AdminDashboard />
    </main>
  );
}
