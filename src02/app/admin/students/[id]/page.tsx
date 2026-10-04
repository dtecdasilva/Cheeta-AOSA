import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StudentDetail } from "@/components/admin/students/StudentSummary";

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StudentDetail id={decodeURIComponent(id)} />
    </main>
  );
}
