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
  prices: Record<SizeId, number>;
  note?: string;
};

export const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export const cakeSizes: CakeSize[] = [
  {
    id: "latta",
    label: "Latta",
    detail: "300 g cuchareable",
    servings: "Individual para cuchara",
  },
  {
    id: "chica",
    label: "Chica",
    detail: "15 cm",
    servings: "Entre 4 y 6 porciones",
    diameter: "15 cm",
  },
  {
    id: "grande",
    label: "Grande",
    detail: "24/25 cm",
    servings: "Entre 8 y 12 porciones",
    diameter: "24/25 cm",
  },
];

export const flavors: Flavor[] = [
  {
    id: "natta",
    name: "Natta",
    description: "Clásica de queso.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    id: "limu",
    name: "Limu",
    description: "Tarta de queso sabor lima.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    id: "choco",
    name: "Choco",
    description: "Tarta de queso sabor 60% cacao.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    id: "tella",
    name: "Tella",
    description: "Tarta de queso con avellanas.",
    prices: { latta: 13000, chica: 26000, grande: 45000 },
    note: "Topping de Nutella sin cargo, a pedido.",
  },
  {
    id: "blanca",
    name: "Blanca",
    description: "Tarta de queso sabor chocolate blanco.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    id: "tachio",
    name: "Tachio",
    description: "Tarta de queso con pistachos.",
    prices: { latta: 13000, chica: 29000, grande: 50000 },
  },
  {
    id: "duo",
    name: "Duo",
    description: "Tarta de queso sabor chocolate blanco y Oreos.",
    prices: { latta: 13000, chica: 29000, grande: 50000 },
  },
  {
    id: "argenta",
    name: "Argenta",
    description: "Tarta de queso sabor dulce de leche.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    id: "mocha",
    name: "Mocha",
    description: "Tarta de queso sabor café con base de chocolate.",
    prices: { latta: 13000, chica: 26000, grande: 45000 },
  },
  {
    id: "brulee",
    name: "Brulée",
    description: "Tarta de queso sabor crème brûlée con crocante de caramelo.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const getMinOrderDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString().slice(0, 10);
};

export const isSunday = (date: string) => {
  if (!date) {
    return false;
  }

  return new Date(`${date}T12:00:00`).getDay() === 0;
};
