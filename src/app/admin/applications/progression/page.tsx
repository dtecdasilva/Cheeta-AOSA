import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ApplicationProgression } from "@/components/admin/applications/ApplicationAnalysis";

export default function AdminApplicationProgressionPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ApplicationProgression />
    </main>
  );
}
