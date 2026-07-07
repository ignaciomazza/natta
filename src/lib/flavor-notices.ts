export const BRULEE_SAME_DAY_NOTICE =
  "Consumir en el día";

export function getFlavorNotice(slug: string) {
  return slug === "brulee" ? BRULEE_SAME_DAY_NOTICE : null;
}
