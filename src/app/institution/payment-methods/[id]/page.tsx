import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import PaymentMethodView from "@/components/institution/PaymentMethodView";
import { mockPaymentMethods } from "@/lib/mockData/paymentMethods";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const pm = mockPaymentMethods.find((p) => p.id === params.id && p.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {pm ? (
          // @ts-expect-error client
          <PaymentMethodView method={pm} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Payment method not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
