import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";

export default async function InstitutionNotificationsPage() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Notifications" description="Alerts about applications, payments, uploads and verification." />
      <NotificationCentre audience="institution" basePath="/institution/notifications" />
    </main>
  );
}
