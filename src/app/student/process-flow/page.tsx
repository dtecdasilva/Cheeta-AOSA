import { Topbar } from "@/components/Topbar";
import { ProcessProgress } from "@/components/ProcessProgress";
import { getMockDashboardData } from "@/lib/mockDashboard";

export default function ProcessFlowPage() {
  const { progress } = getMockDashboardData();

  return (
    <>
      <Topbar
        title="The Process Flow"
        description="Every application on Cheeta AOSA follows the same five steps, from your first details to tracking a decision."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-3xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
          <ProcessProgress progress={progress} variant="detailed" />
        </div>

        <div className="mt-6 max-w-3xl border border-dashed border-[var(--color-line-strong)] px-5 py-4 text-sm text-[var(--color-ink-soft)]">
          Tap any task above to go straight to it. Tasks without a finished module yet will say so
          rather than take you somewhere broken — they&apos;re placed here now so the full structure is
          in place ahead of those modules being built.
        </div>
      </main>
    </>
  );
}
