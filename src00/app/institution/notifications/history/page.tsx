import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";

export default async function InstitutionNotificationHistoryPage() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Notification history" description="Every notification, including archived ones, with delivery status." />
      <NotificationHistory audience="institution" basePath="/institution/notifications" />
    </main>
  );
}
