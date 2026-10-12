import { formatFileSize, formatFileTypes, type UploadRequirement } from "@/lib/institution/uploadRequirements";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

/** One upload requirement, as the institution set it. */
export default function UploadRequirementView({ req, canEdit }: { req: UploadRequirement; canEdit: boolean }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={req.name} description={req.description || undefined} />
        <DescriptionList
          items={[
            { label: "Document type", value: req.documentTypeId ? req.name : "Not chosen yet" },
            { label: "Required or optional", value: req.required ? "Required: an application can't be submitted without it" : "Optional: applicants may leave it out" },
            { label: "Accepted file types", value: formatFileTypes(req.fileTypes) },
            { label: "Maximum size", value: formatFileSize(req.maxSizeKb) },
            { label: "Status", value: req.status === "ACTIVE" ? "Active" : "Inactive" },
            { label: "Asked of applicants", value: req.status === "ACTIVE" ? "Yes" : "No" },
          ]}
        />
      </Card>
      {canEdit && <RowAction href={`/institution/uploads/requirements/${req.id}/edit`}>Edit</RowAction>}
    </div>
  );
}
