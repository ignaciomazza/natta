import { applyPriceMultiplier } from "@/lib/price-adjustments";
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

export type Flavor = {
  id: string;
  name: string;
  description: string;
  prices: Record<SizeId, number | null>;
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
    detail: "15 cm · 950 g aprox.",
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

function buildPrices(latta: number, chica: number, grande: number): Record<SizeId, number | null> {
  return {
    latta: applyPriceMultiplier(latta),
    chica: applyPriceMultiplier(chica),
    grande: applyPriceMultiplier(grande),
  };
}

function buildLattaOnlyPrice(latta: number): Record<SizeId, number | null> {
  return {
    latta: applyPriceMultiplier(latta),
    chica: null,
    grande: null,
  };
}

export const flavors: Flavor[] = [
  {
    id: "natta",
    name: "Natta",
    description: "Clásica de queso.",
    prices: buildPrices(13000, 23000, 40000),
  },
  {
    id: "limu",
    name: "Limu",
    description: "Lima.",
    prices: buildPrices(13000, 23000, 40000),
  },
  {
    id: "choco",
    name: "Choco",
    description: "60% cacao.",
    prices: buildPrices(13000, 23000, 40000),
  },
  {
    id: "tella",
    name: "Tella",
    description: "Avellanas.",
    prices: buildPrices(13000, 26000, 45000),
  },
  {
    id: "blanca",
    name: "Blanca",
    description: "Chocolate blanco.",
    prices: buildPrices(13000, 23000, 40000),
  },
  {
    id: "tachio",
    name: "Tachio",
    description: "Pistachos.",
    prices: buildPrices(13000, 29000, 50000),
  },
  {
    id: "duo",
    name: "Duo",
    description: "Chocolate blanco y Oreos.",
    prices: buildPrices(13000, 29000, 50000),
  },
  {
    id: "argenta",
    name: "Argenta",
    description: "Dulce de leche.",
    prices: buildPrices(13000, 23000, 40000),
  },
  {
    id: "mocha",
    name: "Mocha",
    description: "Café con base de chocolate.",
    prices: buildPrices(13000, 26000, 45000),
  },
  {
    id: "brulee",
    name: "Brulée",
    description: "Crème brûlée con crocante de caramelo.",
    prices: buildLattaOnlyPrice(13000),
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
