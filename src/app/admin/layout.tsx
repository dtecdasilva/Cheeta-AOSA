import { requireRole } from "@/lib/auth/guard";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["AOSA_ADMIN"]);
  return <AdminShell user={user}>{children}</AdminShell>;
}
