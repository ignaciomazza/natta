import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pedido"],
        disallow: [
          "/api/",
          "/interno/",
          "/images/Instagram_files/",
          "/images/transparent-images/",
          "/images/menu/*.HEIC",
          "/images/menu/*.heic",
          "/images/menu/*.HEIF",
          "/images/menu/*.heif",
          "/images/menu/*.png",
          "/images/menu/choco.jpg",
          "/images/menu/natta.jpg",
          "/images/logo/IMG_*.PNG",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
