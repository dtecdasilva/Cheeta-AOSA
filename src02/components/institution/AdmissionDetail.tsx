"use client";

import { AdmissionRecord, findAdmissionById } from "@/lib/mockData/admissions";
import { Card, DescriptionList } from "@/components/ui";
import Link from "next/link";

export default function AdmissionDetail({ admission }: { admission: AdmissionRecord | null }) {
  if (!admission) return <Card padded={true}>Admission not found.</Card>;

  return (
    <div className="space-y-4">
      <Card padded>
        <DescriptionList
          items={[
            { label: "Applicant", value: admission.applicantName },
            { label: "Application ID", value: <Link href={`/institution/applications/${admission.applicationId}`} className="text-[var(--color-ink)] underline">{admission.applicationId}</Link> },
            { label: "Program", value: admission.programId },
            { label: "Choice", value: admission.choice },
            { label: "Status", value: admission.status },
            { label: "Admission date", value: admission.admissionDate ?? "—" },
          ]}
        />
      </Card>
    </div>
  );
}
