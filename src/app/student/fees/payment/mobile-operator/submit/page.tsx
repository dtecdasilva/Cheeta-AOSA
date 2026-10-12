import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { PaymentSubmitForm } from "@/components/fees/PaymentSubmitForm";

export default async function Page({ searchParams }: { searchParams: Promise<{ application?: string; account?: string }> }) {
  const { application, account } = await searchParams;
  return (
    <>
      <Topbar title="Submit Mobile Operator Transfer" description="Record a mobile money transfer you have made." />
      <main className={PAGE_MAIN_CLASS}>
        <PaymentSubmitForm type="mobile_operator" application={application} account={account} />
      </main>
    </>
  );
}
