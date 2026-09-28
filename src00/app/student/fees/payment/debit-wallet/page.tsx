import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";

export default function Page() {
  return (
    <>
      <Topbar title="Debit Wallet" description="Pay your application fees from a debit wallet." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="wallet" />
      </main>
    </>
  );
}
