import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { PaymentSubmitForm } from "@/components/fees/PaymentSubmitForm";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string; account?: string }> }) {
  const { application, account } = await searchParams;
  return (
    <>
      <Topbar title="Submit Money Transfer Payment" description="Record a money transfer you have sent, and upload the receipt." />
      <main className={PAGE_MAIN_CLASS}>
        <PaymentSubmitForm type="money_transfer" application={application} account={account} />
      </main>
    </>
  );
}
