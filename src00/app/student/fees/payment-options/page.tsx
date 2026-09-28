import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="View Payment Options" description="Choose how you'd like to pay your application fees." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="View Payment Options" />
      </main>
    </>
  );
}
