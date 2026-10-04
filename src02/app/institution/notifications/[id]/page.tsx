import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationDetail } from "@/components/notifications/NotificationCentre";

export default async function InstitutionNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <NotificationDetail audience="institution" basePath="/institution/notifications" id={decodeURIComponent(id)} />
    </main>
  );
}
