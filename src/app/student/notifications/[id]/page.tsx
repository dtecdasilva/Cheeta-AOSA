import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationDetail } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function StudentNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const { id } = await params;
  return (
    <>
      <Topbar title={tr("Notification")} />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationDetail audience="student" basePath="/student/notifications" id={decodeURIComponent(id)} />
      </main>
    </>
  );
}
