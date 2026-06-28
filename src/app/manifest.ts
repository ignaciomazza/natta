import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: siteConfig.backgroundColor,
    categories: ["food", "shopping"],
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icons/icon-192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/icons/icon-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/maskable-icon-512.png",
        type: "image/png",
      },
    ],
    lang: siteConfig.language,
    name: siteConfig.name,
    scope: "/",
    short_name: siteConfig.shortName,
    start_url: "/",
    theme_color: siteConfig.themeColor,
  };
}
