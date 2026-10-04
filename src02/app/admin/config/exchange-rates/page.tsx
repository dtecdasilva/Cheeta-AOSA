import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ExchangeRates } from "@/components/admin/system/ExchangeRates";

export default function AdminConfigExchangeRatesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ExchangeRates />
    </main>
  );
}
