import { Topbar } from "@/components/Topbar";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function Page() {
  return (
    <>
      <Topbar title="Add Debit Wallet Payment" description="Pay your application fees from a debit wallet." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ComingSoonPanel title="Add Debit Wallet Payment" />
      </main>
    </>
  );
}
