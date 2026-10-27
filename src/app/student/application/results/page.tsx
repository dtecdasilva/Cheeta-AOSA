import { Topbar } from "@/components/Topbar";
import { ResultsForm } from "@/components/results/ResultsForm";
import { getT } from "@/lib/i18n/server";

export default async function ResultsInformationPage({ searchParams }: { searchParams: Promise<{ examination?: string }> }) {
  const tr = await getT();
  // The Examinations Information page links here with the examination to start on.
  const { examination } = await searchParams;
  return (
    <>
      <Topbar
        title={tr("Results Information")}
        description={tr("Choose one of the examinations you added, then record the subjects and grades you obtained in it. The result for each is worked out automatically.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ResultsForm examination={examination} />
      </main>
    </>
  );
}
