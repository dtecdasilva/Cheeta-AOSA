import { requireRole } from "@/lib/auth/guard";
import { AuthProvider } from "@/context/AuthContext";
import { StudentShell } from "./StudentShell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Runs on the server before anything below renders. If there's no
  // session, or the session belongs to a non-STUDENT role, this redirects
  // away — the page content never executes, so there's nothing a student
  // (or anyone else) can do from the browser to see it anyway.
  const user = await requireRole(["STUDENT"]);

  return (
    <AuthProvider initialUser={user}>
      <StudentShell user={user}>{children}</StudentShell>
    </AuthProvider>
  );
}
