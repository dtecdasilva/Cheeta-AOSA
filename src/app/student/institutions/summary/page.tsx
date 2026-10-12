import { Topbar } from "@/components/Topbar";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionSummary } from "@/components/institutions/InstitutionSummary";

export default function Page() {
  return (
    <>
      <Topbar title="Institution Summary" description="Every institution you've added to your application, at a glance." />
      <main className={PAGE_MAIN_CLASS}>
        <InstitutionSummary />
      </main>
    </>
  );
}
