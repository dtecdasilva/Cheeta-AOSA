import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function AdminNotificationsPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Notifications")} description={tr("Alerts about applications, payments, uploads and verification.")} />
      <NotificationCentre audience="admin" basePath="/admin/notifications" />
    </main>
  );
}
