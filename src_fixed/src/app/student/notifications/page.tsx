import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";

export default function StudentNotificationsPage() {
  return (
    <>
      <Topbar title="Notifications" description="Updates on your account, applications, payments and admission." />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationCentre audience="student" basePath="/student/notifications" />
      </main>
    </>
  );
}
