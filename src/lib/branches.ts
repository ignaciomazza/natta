export const branches = [
  {
    slug: "devoto",
    code: "DEVOTO",
    name: "Devoto",
    label: "Sucursal Devoto",
    area: "Villa Devoto · CABA",
    addressLine: "Av. Francisco Beiró 5015, timbre 302",
    fullAddress: "Av. Francisco Beiró 5015, timbre 302, Villa Devoto, CABA",
    catalogNote: "Todos los tamaños",
    allowedSizeSlugs: ["latta", "chica", "grande"],
  },
  {
    slug: "nordelta",
    code: "NORDELTA",
    name: "Nordelta",
    label: "Sucursal Nordelta",
    area: "Dique Luján · Tigre",
    addressLine: "Boulevard de Todos los Santos 4380, Vila Marina 1",
    fullAddress:
      "Boulevard de Todos los Santos 4380, Vila Marina 1, Dique Luján, Tigre, Buenos Aires",
    catalogNote: "Por ahora, sólo Lattas",
    allowedSizeSlugs: ["latta"],
  },
] as const;

export type Branch = (typeof branches)[number];
export type BranchSlug = Branch["slug"];
export type BranchCodeValue = Branch["code"];

export const defaultBranch = branches[0];

// Control central para habilitar u ocultar la eleccion publica de sucursal.
export const isPublicBranchSelectionEnabled = true;

export const publicBranches: readonly Branch[] =
  isPublicBranchSelectionEnabled ? branches : [defaultBranch];

export function getBranchBySlug(value: string | null | undefined) {
  return branches.find((branch) => branch.slug === value) ?? null;
}

export function getBranchByCode(value: string | null | undefined) {
  return branches.find((branch) => branch.code === value) ?? defaultBranch;
}

export function isSizeAvailableAtBranch(
  branch: Branch,
  sizeSlug: string,
) {
  return (branch.allowedSizeSlugs as readonly string[]).includes(sizeSlug);
}
