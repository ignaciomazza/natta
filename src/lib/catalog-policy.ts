const unavailableCatalogPairs = new Set(["brulee::chica", "brulee::grande"]);

export function isCatalogPairAvailable(flavorSlug: string, sizeSlug: string) {
  return !unavailableCatalogPairs.has(`${flavorSlug}::${sizeSlug}`);
}
