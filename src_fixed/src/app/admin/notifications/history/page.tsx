import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";

export default async function AdminNotificationHistoryPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Notification history" description="Every notification, including archived ones, with delivery status." />
      <NotificationHistory audience="admin" basePath="/admin/notifications" />
    </main>
  );
}
