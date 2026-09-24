import {
  addDateOnlyDays,
  getBusinessDateOnlyString,
  getDateOnlyWeekday,
} from "@/lib/date-only";

export type SizeId = "latta" | "chica" | "grande";
export type FulfillmentMode = "pickup" | "delivery";

export type CakeSize = {
  id: SizeId;
  label: string;
  detail: string;
  servings: string;
  diameter?: string;
};

export const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export const cakeSizes: CakeSize[] = [
  {
    id: "latta",
    label: "Latta",
    detail: "11 cm · 300 g",
    servings: "Cuchareable individual",
    diameter: "11 cm",
  },
  {
    id: "chica",
    label: "Chica",
    detail: "15 cm · 650 g aprox.",
    servings: "Entre 4 y 6 porciones",
    diameter: "15 cm",
  },
  {
    id: "grande",
    label: "Grande",
    detail: "24 cm · 2 kg aprox.",
    servings: "Entre 10 y 12 porciones",
    diameter: "24 cm",
  },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const getMinOrderDate = () => {
  return addDateOnlyDays(getBusinessDateOnlyString(), 2);
};

export const isSunday = (date: string) => {
  if (!date) {
    return false;
  }

  return getDateOnlyWeekday(date) === 0;
};
