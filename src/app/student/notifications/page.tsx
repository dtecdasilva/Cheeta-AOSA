import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function StudentNotificationsPage() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Notifications")} description={tr("Updates on your account, applications, payments and admission.")} />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationCentre audience="student" basePath="/student/notifications" />
      </main>
    </>
  );
}
