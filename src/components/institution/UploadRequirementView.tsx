"use client";

import { UploadRequirement } from "@/lib/mockData/uploadRequirements";

export default function UploadRequirementView({ req }: { req: UploadRequirement }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{req.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">{req.description}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Required:</strong> {req.required ? 'Yes' : 'No'}</p>
        <p><strong>File type:</strong> {req.fileType}</p>
        <p><strong>Max size (KB):</strong> {req.maxSizeKb}</p>
        <p><strong>Status:</strong> {req.status}</p>
      </div>
    </div>
  );
}
"use client";

import { UploadRequirement } from "@/lib/mockData/uploadRequirements";
import Link from "next/link";

export default function UploadRequirementView({ req }: { req: UploadRequirement }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">{req.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">{req.description}</p>
      </div>

      <div className="rounded border border-[var(--color-line)] bg-white p-4 space-y-2">
        <p><strong>Required:</strong> {req.required ? "Yes" : "No"}</p>
        <p><strong>File types:</strong> {req.fileTypes.join(", ")}</p>
        <p><strong>Max size:</strong> {req.maxSizeKB} KB</p>
        <p><strong>Status:</strong> {req.status}</p>
      </div>

      <div>
        <Link href={`/institution/uploads/requirements/${req.id}/edit`} className="text-sm text-[var(--color-ink)] underline">Edit</Link>
      </div>
    </div>
  );
}
