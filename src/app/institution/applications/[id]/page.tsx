import { requireRole } from "@/lib/auth/guard";
import ApplicationReview from "@/components/institution/ApplicationReview";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // The server only answers for an application sent to the caller's own institution;
  // any other id reads as not found, so one institution can't open another's.
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Application")} description={tr("Verify the payment and documents, then acknowledge or reject the application.")} />
      <ApplicationReview id={id} />
    </main>
  );
}
