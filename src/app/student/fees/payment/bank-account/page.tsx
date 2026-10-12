import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const { application } = await searchParams;
  return (
    <>
      <Topbar title="Bank Account Deposit" description="Pay your application fees by bank transfer." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="bank" application={application} />
      </main>
    </>
  );
}
