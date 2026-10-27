import { Topbar } from "@/components/Topbar";
import { PaymentOptions } from "@/components/fees/PaymentOptions";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("View Payment Options")} description={tr("Choose how you'd like to pay your application fees.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PaymentOptions />
      </main>
    </>
  );
}
