import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ApplicationSummary } from "@/components/admin/applications/ApplicationAnalysis";

export default function AdminApplicationSummaryPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ApplicationSummary />
    </main>
  );
}
