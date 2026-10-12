import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { PaymentSubmitForm } from "@/components/fees/PaymentSubmitForm";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string; account?: string }> }) {
  const { application, account } = await searchParams;
  return (
    <>
      <Topbar title="Submit Debit Wallet Payment" description="Record a payment you have made from a debit wallet." />
      <main className={PAGE_MAIN_CLASS}>
        <PaymentSubmitForm type="debit_wallet" application={application} account={account} />
      </main>
    </>
  );
}
