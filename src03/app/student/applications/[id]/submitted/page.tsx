"use client";

import { use } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Topbar } from "@/components/Topbar";
import { institutions } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";
import { buttonClass } from "@/lib/ui/button";

export default function SubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getApplication } = useApp();
  const application = getApplication(id);

  if (!application) return null;

  return (
    <>
      <Topbar title="Application submitted" />
      <main className="px-8 py-16">
        <div className="mx-auto max-w-lg text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--color-success)]" strokeWidth={1.5} />
          <h2 className="mt-5 font-bold tracking-tight text-2xl text-[var(--color-ink)]">
            Your application is on its way
          </h2>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Submitted {formatDateTime(application.submittedAt)} to{" "}
            {application.institutionIds.map((i) => institutions.find((x) => x.id === i)?.name).join(", ")}.
            Each institution will verify your file before moving it forward — you&apos;ll be notified at every stage.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/student/applications"
              className={buttonClass("secondary")}
            >
              View my applications
            </Link>
            <Link
              href="/student/dashboard"
              className={buttonClass("primary")}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
