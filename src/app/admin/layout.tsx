import { requireRole } from "@/lib/auth/guard";
import { AuthProvider } from "@/context/AuthContext";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["AOSA_ADMIN"]);
  return (
    <AuthProvider initialUser={user}>
      <AdminShell user={user}>{children}</AdminShell>
    </AuthProvider>
  );
}
