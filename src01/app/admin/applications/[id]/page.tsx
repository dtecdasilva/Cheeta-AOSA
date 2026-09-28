import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ApplicationDetail } from "@/components/admin/applications/ApplicationList";

export default async function AdminApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ApplicationDetail id={decodeURIComponent(id)} />
    </main>
  );
}
