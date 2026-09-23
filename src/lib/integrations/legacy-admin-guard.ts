import { NextResponse } from "next/server";
import { getCommerceBridge } from "@/lib/integrations/commerce-bridge";

export async function legacyAdminWriteGuard(section: "capacity" | "prices") {
  if (!(await getCommerceBridge())?.enabled) return null;

  const isCapacity = section === "capacity";
  return NextResponse.json(
    {
      error: isCapacity
        ? "Los cupos y horarios se administran en Cobots."
        : "Los productos y precios se administran en Cobots.",
      manageUrl: isCapacity
        ? "https://www.cobots.studio/app/availability"
        : "https://www.cobots.studio/app/products",
    },
    { status: 409 },
  );
}
