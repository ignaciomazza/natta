import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/internal/admin-shell";
import { requirePageAuth } from "@/lib/internal/page-auth";

export const metadata: Metadata = {
  title: "Interno",
  alternates: {
    canonical: "/interno",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function InternoLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageAuth();

  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
