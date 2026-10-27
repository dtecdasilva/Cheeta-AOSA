import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const tr = await getT();
  const { application } = await searchParams;
  return (
    <>
      <Topbar title={tr("Mobile Operator Transfer")} description={tr("Pay your application fees using mobile money.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="mobile" application={application} />
      </main>
    </>
  );
}
