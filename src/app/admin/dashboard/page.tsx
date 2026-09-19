import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export default function AdminDashboardPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Dashboard" description="Platform-wide administration." />
      <ComingSoonPanel
        title="Administration portal — coming next"
        note="You're signed in and authorized for this portal. Institutions, parameters, student registration and summary, payment configuration and access management will be built as their own module."
      />
    </main>
  );
}
