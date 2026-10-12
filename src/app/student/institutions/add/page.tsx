import { Topbar } from "@/components/Topbar";
import { InstitutionDiscovery } from "@/components/institutions/InstitutionDiscovery";

export default async function AddInstitutionPage({ searchParams }: { searchParams: Promise<{ institution?: string; view?: string }> }) {
  // The Institution Summary links here to open one institution's details or its program choices.
  const { institution, view } = await searchParams;
  return (
    <>
      <Topbar
        title="Add Institution"
        description="Browse, search, and filter institutions — view programs and available spaces, then select the ones you want to apply to."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <InstitutionDiscovery institution={institution} view={view} />
      </main>
    </>
  );
}
