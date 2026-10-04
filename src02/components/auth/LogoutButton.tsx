"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function LogoutButton({ className = "" }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <button
      onClick={() => logout()}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white ${className}`}
    >
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
      Sign out
    </button>
  );
}
