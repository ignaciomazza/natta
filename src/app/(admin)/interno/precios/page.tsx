import { redirect } from "next/navigation";
import { PricesAdmin } from "@/components/internal/prices-admin";
import { getCommerceBridge } from "@/lib/integrations/commerce-bridge";

export default async function PreciosPage() {
  if ((await getCommerceBridge())?.enabled) {
    redirect("https://www.cobots.studio/app/products");
  }

  return <PricesAdmin />;
}
