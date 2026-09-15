import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Institution Upload" description="Upload the documents each institution requires." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Institution Upload" />
      </main>
    </>
  );
}
