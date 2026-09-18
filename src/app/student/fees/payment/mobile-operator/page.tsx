import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";

export default function Page() {
  return (
    <>
      <Topbar title="Mobile Operator Transfer" description="Pay your application fees using mobile money." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="mobile" />
      </main>
    </>
  );
}
