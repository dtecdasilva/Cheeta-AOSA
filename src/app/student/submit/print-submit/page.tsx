import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Print/Submit My Application" description="Review, print, and submit your completed application." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Print/Submit My Application" />
      </main>
    </>
  );
}
