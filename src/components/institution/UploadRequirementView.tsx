import { UploadRequirement } from "@/lib/mockData/uploadRequirements";
import { Card, CardHeader, DescriptionList, RowAction } from "@/components/ui";

export default function UploadRequirementView({ req }: { req: UploadRequirement }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card padded={false}>
        <CardHeader title={req.name} description={req.description} />
        <DescriptionList
          items={[
            { label: "Required", value: req.required ? "Yes" : "No" },
            { label: "Accepted file types", value: req.fileTypes.join(", ").toUpperCase() },
            { label: "Maximum size", value: req.maxSizeKB >= 1024 ? `${(req.maxSizeKB / 1024).toFixed(req.maxSizeKB % 1024 === 0 ? 0 : 1)} MB` : `${req.maxSizeKB} KB` },
            { label: "Status", value: req.status === "active" ? "Active" : "Inactive" },
          ]}
        />
      </Card>
      <RowAction href={`/institution/uploads/requirements/${req.id}/edit`}>Edit</RowAction>
    </div>
  );
}
