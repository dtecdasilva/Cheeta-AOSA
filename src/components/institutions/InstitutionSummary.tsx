"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FormError } from "@/components/Form";
import { EmptyState, SectionHeading } from "@/components/ui";
import { useMyApplications, type MyApplication } from "@/lib/applications/api";
import { useMyFees } from "@/lib/fees/api";
import type { InstitutionListing } from "@/lib/institutionDiscovery/data";
import { buttonClass } from "@/lib/ui/button";
import InstitutionSummaryCard from "./InstitutionSummaryCard";
import { useT } from "@/lib/i18n/client";

/**
 * Every institution on the applicant's application, at a glance, from
 * /api/student/applications. The fee and payment state on each card come
 * from /api/student/fees, and the type and location from the public
 * institution list.
 */
export function InstitutionSummary() {
  const tr = useT();
  const mine = useMyApplications();
  const { fees, reload: reloadFees } = useMyFees();
  const [listings, setListings] = useState<InstitutionListing[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reference/institutions", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { data: InstitutionListing[] }).data : []))
      .then((data) => !cancelled && setListings(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(application: MyApplication) {
    if (busyId) return;
    if (!window.confirm(tr("Remove {name} from your application? Its program choices and uploaded documents will be removed too.", { name: tr(application.institution.name) }))) return;
    setProblem(null);
    setBusyId(application.id);
    const result = await mine.remove(application.id);
    setBusyId(null);
    if (!result.ok) setProblem(result.error);
    else void reloadFees();
  }

  if (!mine.applications) return mine.error ? <FormError>{tr(mine.error)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your institutions…")}</p>;

  return (
    <div className="max-w-4xl">
      <SectionHeading
        title={tr("My institutions")}
        actions={
          <Link href="/student/institutions/add" className={buttonClass("primary")}>
            {tr("Add institution")}
          </Link>
        }
      />
      {problem && (
        <div className="mb-4">
          <FormError>{tr(problem)}</FormError>
        </div>
      )}
      {mine.applications.length === 0 ? (
        <EmptyState
          message={tr("You haven't added an institution to your application yet. Browse the institutions accepting applications and add the ones you want to apply to.")}
          action={
            <Link href="/student/institutions/add" className={buttonClass("secondary")}>
              {tr("Browse institutions")}
            </Link>
          }
        />
      ) : (
        mine.applications.map((application) => (
          <InstitutionSummaryCard
            key={application.id}
            application={application}
            listing={listings.find((l) => l.id === application.institution.id)}
            fee={fees?.applications.find((f) => f.id === application.id)}
            busy={busyId === application.id}
            onRemove={() => remove(application)}
          />
        ))
      )}
    </div>
  );
}
