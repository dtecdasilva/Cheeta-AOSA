import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";

export default async function AdminNotificationsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Notifications" description="Alerts about applications, payments, uploads and verification." />
      <NotificationCentre audience="admin" basePath="/admin/notifications" />
    </main>
  );
}
