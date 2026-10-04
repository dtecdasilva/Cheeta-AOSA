import { PAGE_MAIN_CLASS } from "@/components/ui";
import { PaymentMethodManager } from "@/components/admin/payments/PaymentMethodManager";

export default function AdminPaymentMethodsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PaymentMethodManager />
    </main>
  );
}
