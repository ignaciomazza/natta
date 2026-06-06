import type { ReactNode } from "react";
import { AdminShell } from "@/components/internal/admin-shell";
import { requirePageAuth } from "@/lib/internal/page-auth";

export default async function InternoLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePageAuth();

  return (
    <AdminShell userName={user.name}>
      {children}
    </AdminShell>
  );
}
