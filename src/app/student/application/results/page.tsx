import { Topbar } from "@/components/Topbar";
import { ResultsForm } from "@/components/results/ResultsForm";

export default async function ResultsInformationPage({ searchParams }: { searchParams: Promise<{ examination?: string }> }) {
  // The Examinations Information page links here with the examination to start on.
  const { examination } = await searchParams;
  return (
    <>
      <Topbar
        title="Results Information"
        description="Choose one of the examinations you added, then record the subjects and grades you obtained in it. The result for each is worked out automatically."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ResultsForm examination={examination} />
      </main>
    </>
  );
}
