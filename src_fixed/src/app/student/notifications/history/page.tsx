import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationHistory } from "@/components/notifications/NotificationCentre";

export default function StudentNotificationHistoryPage() {
  return (
    <>
      <Topbar title="Notification history" description="Everything we've sent you, including archived notifications and delivery status." />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationHistory audience="student" basePath="/student/notifications" />
      </main>
    </>
  );
}
