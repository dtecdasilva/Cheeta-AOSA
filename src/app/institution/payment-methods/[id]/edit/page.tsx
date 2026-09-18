import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";
import { mockPaymentMethods } from "@/lib/mockData/paymentMethods";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const pm = mockPaymentMethods.find((p) => p.id === params.id && p.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Edit payment method</h1>
        {pm ? (
          // @ts-expect-error client
          <PaymentMethodForm institutionId={user.institutionId ?? "inst-1"} initial={pm} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Payment method not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
