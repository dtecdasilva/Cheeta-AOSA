import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { getT } from "@/lib/i18n/server";

export default async function InstitutionNotificationsPage() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Notifications")} description={tr("Alerts about applications, payments, uploads and verification.")} />
      <NotificationCentre audience="institution" basePath="/institution/notifications" />
    </main>
  );
}
