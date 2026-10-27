import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { PaymentSubmitForm } from "@/components/fees/PaymentSubmitForm";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string; account?: string }> }) {
  const tr = await getT();
  const { application, account } = await searchParams;
  return (
    <>
      <Topbar title={tr("Submit Debit Wallet Payment")} description={tr("Record a payment you have made from a debit wallet.")} />
      <main className={PAGE_MAIN_CLASS}>
        <PaymentSubmitForm type="debit_wallet" application={application} account={account} />
      </main>
    </>
  );
}
