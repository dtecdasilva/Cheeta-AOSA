import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ApplicationList } from "@/components/admin/applications/ApplicationList";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ApplicationList defaults={{ status: one(sp.status), institution: one(sp.institution), payment: one(sp.payment) }} />
    </main>
  );
}
