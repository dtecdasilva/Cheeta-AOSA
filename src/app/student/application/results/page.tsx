import { Topbar } from "@/components/Topbar";
import { ResultsForm } from "@/components/results/ResultsForm";

export default function ResultsInformationPage() {
  return (
    <>
      <Topbar
        title="Results Information"
        description="Add the subjects and grades you obtained — the result for each is worked out automatically."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ResultsForm />
      </main>
    </>
  );
}
