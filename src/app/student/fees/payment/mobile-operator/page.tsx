import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const { application } = await searchParams;
  return (
    <>
      <Topbar title="Mobile Operator Transfer" description="Pay your application fees using mobile money." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="mobile" application={application} />
      </main>
    </>
  );
}
