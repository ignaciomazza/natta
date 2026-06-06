const DEFAULT_PRICE_MULTIPLIER = 1;

function parsePriceMultiplier(value: string | undefined) {
  if (!value) return DEFAULT_PRICE_MULTIPLIER;

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return DEFAULT_PRICE_MULTIPLIER;
  }

  return normalized;
}

export function getPriceMultiplier() {
  return parsePriceMultiplier(process.env.NEXT_PUBLIC_PRICE_MULTIPLIER);
}

export function applyPriceMultiplier(amountArs: number) {
  const multiplier = getPriceMultiplier();
  const adjustedAmount = Math.round(amountArs * multiplier);
  return Math.max(1, adjustedAmount);
}
