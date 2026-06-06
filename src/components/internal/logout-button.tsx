"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50/40 px-3 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 hover:text-red-800"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/interno/login");
        router.refresh();
      }}
      type="button"
    >
      <LogOut className="h-4 w-4" />
      <span>Cerrar sesión</span>
    </button>
  );
}
