import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionNotificationHistoryPage() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Notification history")} description={tr("Every notification, including archived ones, with delivery status.")} />
      <NotificationHistory audience="institution" basePath="/institution/notifications" />
    </main>
  );
}
