import { PAGE_MAIN_CLASS } from "@/components/ui";
import { PaymentConfig } from "@/components/admin/payments/PaymentConfig";

export default function AdminPaymentConfigPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PaymentConfig />
    </main>
  );
}
