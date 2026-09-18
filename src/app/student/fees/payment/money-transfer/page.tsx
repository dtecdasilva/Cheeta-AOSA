import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Add Money Transfer Payment" description="Pay your application fees via a money transfer service." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Add Money Transfer Payment" />
      </main>
    </>
  );
}
