import { Topbar } from "@/components/Topbar";
import PaymentInstructions from "@/components/fees/PaymentInstructions";

export default function Page() {
  return (
    <>
      <Topbar title="Money Transfer" description="Pay your application fees via a money transfer service." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentInstructions method="money" />
      </main>
    </>
  );
}
