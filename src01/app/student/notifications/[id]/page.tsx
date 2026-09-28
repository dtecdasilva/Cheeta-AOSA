import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { NotificationDetail } from "@/components/notifications/NotificationCentre";

export default async function StudentNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Topbar title="Notification" />
      <main className={PAGE_MAIN_CLASS}>
        <NotificationDetail audience="student" basePath="/student/notifications" id={decodeURIComponent(id)} />
      </main>
    </>
  );
}
