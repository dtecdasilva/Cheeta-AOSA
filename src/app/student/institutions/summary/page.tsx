import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Institution Summary" description="Every institution you've added to your application, at a glance." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Institution Summary" />
      </main>
    </>
  );
}
