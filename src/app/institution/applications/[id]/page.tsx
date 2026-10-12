import { requireRole } from "@/lib/auth/guard";
import ApplicationReview from "@/components/institution/ApplicationReview";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  // The server only answers for an application sent to the caller's own institution;
  // any other id reads as not found, so one institution can't open another's.
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Application" description="Verify the payment and documents, then acknowledge or reject the application." />
      <ApplicationReview id={id} />
    </main>
  );
}
