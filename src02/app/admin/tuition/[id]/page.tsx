import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { TuitionAccountView } from "@/components/tuition/Tuition";

export default async function AdminTuitionAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["AOSA_ADMIN"]);
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <TuitionAccountView id={decodeURIComponent(id)} basePath="/admin/tuition" reviewer={{ name: user.fullName, role: "admin" }} />
    </main>
  );
}
