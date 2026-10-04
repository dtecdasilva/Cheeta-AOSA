import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getSessionUser, homeForRole } from "@/lib/auth/guard";
import { buttonClass } from "@/lib/ui/button";

export default async function UnauthorizedPage() {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-[var(--color-danger)]" strokeWidth={1.5} />
        <h1 className="mt-5 font-bold tracking-tight text-2xl text-[var(--color-ink)]">
          You don&apos;t have access to this area
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {user
            ? "Your account doesn't have permission to view this portal."
            : "Sign in with an account that has permission to view this page."}
        </p>
        <Link
          href={user ? homeForRole(user.role) : "/login"}
          className={`mt-6 ${buttonClass("primary")}`}
        >
          {user ? "Go to your dashboard" : "Go to sign in"}
        </Link>
      </div>
    </div>
  );
}
