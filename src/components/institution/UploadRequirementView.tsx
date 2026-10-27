import { formatFileSize, formatFileTypes, type UploadRequirement } from "@/lib/institution/uploadRequirements";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

/** One upload requirement, as the institution set it. */
export default async function UploadRequirementView({ req, canEdit }: { req: UploadRequirement; canEdit: boolean }) {
  const tr = await getT();
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={tr(req.name)} description={req.description || undefined} />
        <DescriptionList
          items={[
            { label: tr("Document type"), value: req.custom ? tr("{name} (your own document)", { name: req.name }) : req.documentTypeId ? req.name : tr("Not chosen yet") },
            { label: tr("Required or optional"), value: req.required ? tr("Required: an application can't be submitted without it") : tr("Optional: applicants may leave it out") },
            { label: tr("Accepted file types"), value: formatFileTypes(req.fileTypes) },
            { label: tr("Maximum size"), value: formatFileSize(req.maxSizeKb) },
            { label: tr("Status"), value: req.status === "ACTIVE" ? tr("Active") : tr("Inactive") },
            { label: tr("Asked of applicants"), value: req.status === "ACTIVE" ? tr("Yes") : tr("No") },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/uploads/requirements/${req.id}/edit`}>{tr("Edit")}</RowAction>}
    </div>
  );
}
