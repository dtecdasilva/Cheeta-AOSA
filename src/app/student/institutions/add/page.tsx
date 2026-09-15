import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Add Institution" description="Search for and add an institution to apply to." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Add Institution" />
      </main>
    </>
  );
}
