import { PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationDetail } from "@/components/notifications/NotificationCentre";

export default async function AdminNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <NotificationDetail audience="admin" basePath="/admin/notifications" id={decodeURIComponent(id)} />
    </main>
  );
}
