import Link from "next/link";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { platformIntake } from "@/server/modules/institutions/discovery.service";
import { getDb } from "@/server/db/client";
import { getT } from "@/lib/i18n/server";

export default async function AdminDashboardPage() {
  const tr = await getT();
  // No institution can be applied to outside the current academic year's intake: say so where Cheeta looks first.
  const intake = await platformIntake(getDb());
  return (
    <main className={PAGE_MAIN_CLASS}>
      {!intake.open && (
        <div role="alert" className="mb-6 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
          <p className="font-semibold">{tr("Students can't apply to any institution right now.")}</p>
          <p className="mt-1">
            {tr(intake.reason)}{" "}
            {tr("Set the current academic year's opening and closing dates under")}{" "}
            <Link href="/admin/parameters/application/academic-years" className="font-medium underline underline-offset-4">
              {tr("Application parameters → Academic years")}
            </Link>
            .
          </p>
        </div>
      )}
      <AdminDashboard />
    </main>
  );
}
