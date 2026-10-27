import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const tr = await getT();
  const { application } = await searchParams;
  return (
    <>
      <Topbar title={tr("Bank Account Deposit")} description={tr("Pay your application fees by bank transfer.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="bank" application={application} />
      </main>
    </>
  );
}
