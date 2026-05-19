export const BRAND_LOADER_NAVIGATE_EVENT = "natta:brand-loader:navigate";

export type BrandLoaderNavigateDetail = {
  href: string;
};

export type BrandLoaderNavigate = (href: string) => boolean;

declare global {
  interface Window {
    __nattaNavigateWithLoader?: BrandLoaderNavigate;
  }
}
