import { redirect } from "next/navigation";
import { CapacityAdmin } from "@/components/internal/capacity-admin";
import { getCommerceBridge } from "@/lib/integrations/commerce-bridge";

export default async function CuposPage() {
  if ((await getCommerceBridge())?.enabled) {
    redirect("https://www.cobots.studio/app/availability");
  }

  return <CapacityAdmin />;
}
