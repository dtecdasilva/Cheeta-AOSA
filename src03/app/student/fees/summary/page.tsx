import { Topbar } from "@/components/Topbar";
import { FeeSummary } from "@/components/fees/FeeSummary";

export default function ApplicationFeeSummaryPage() {
  return (
    <>
      <Topbar
        title="Application Fee Summary"
        description="A breakdown of application and web/admin fees owed per institution — view them in a currency of your choice."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <FeeSummary />
      </main>
    </>
  );
}
