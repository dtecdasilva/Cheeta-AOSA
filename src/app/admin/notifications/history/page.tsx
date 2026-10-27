import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function AdminNotificationHistoryPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Notification history")} description={tr("Every notification, including archived ones, with delivery status.")} />
      <NotificationHistory audience="admin" basePath="/admin/notifications" />
    </main>
  );
}
