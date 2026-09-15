import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Add Bank Account Payment" description="Pay your application fees by bank transfer." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Add Bank Account Payment" />
      </main>
    </>
  );
}
