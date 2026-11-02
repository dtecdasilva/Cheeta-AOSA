import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StatementView } from "@/components/payouts/StatementView";

export default async function AdminPayoutStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StatementView url={`/api/admin/payouts/institutions/${encodeURIComponent(id)}`} admin />
    </main>
  );
}
