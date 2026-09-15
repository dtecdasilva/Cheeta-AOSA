import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Application Fee Summary" description="A breakdown of application and web/admin fees owed per institution." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Application Fee Summary" />
      </main>
    </>
  );
}
