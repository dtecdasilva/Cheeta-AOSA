import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Add Mobile Operator Payment" description="Pay your application fees using mobile money." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Add Mobile Operator Payment" />
      </main>
    </>
  );
}
