import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function StudentNotificationHistoryPage() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Notification history")} description={tr("Everything we've sent you, including archived notifications and delivery status.")} />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationHistory audience="student" basePath="/student/notifications" />
      </main>
    </>
  );
}
