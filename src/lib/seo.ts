import type { Metadata } from "next";
import { cakeSizes, flavors } from "@/lib/catalog";

export const siteConfig = {
  name: "Natta Vascas",
  shortName: "Natta",
  url: "https://www.nattavascas.com",
  locale: "es_AR",
  language: "es-AR",
  title: "Natta Vascas | Tartas vascas de queso en Villa Devoto",
  description:
    "Tartas vascas de queso hechas por encargo en Villa Devoto. Menu corto, textura cremosa y pedidos con anticipacion.",
  orderDescription:
    "Arma tu pedido de tartas vascas Natta con sabores, fecha, modalidad y pago online.",
  statusDescription:
    "Consulta el estado de tu pedido Natta con codigo de comprobante o datos de entrega.",
  themeColor: "#f5f3f1",
  backgroundColor: "#403a37",
  ogImage:
    "/images/optimized/instagram/633114726_18560669452017460_185298347140133489_n.jpg",
  logo: "/images/logo/natta-logo-cropped.png",
  instagram: "https://www.instagram.com/nattavascas/",
  facebook: "https://www.facebook.com/profile.php?id=61580534162869",
  whatsapp: "https://wa.me/5491173588459",
  phoneDisplay: "+54 9 11 7358-8459",
  phone: "+5491173588459",
  location: "Villa Devoto, Buenos Aires",
  maps:
    "https://www.google.com/maps/search/?api=1&query=Villa%20Devoto%2C%20Buenos%20Aires%2C%20Argentina",
};

export const absoluteUrl = (path = "/") => new URL(path, siteConfig.url).toString();

export const sharedOpenGraph: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  locale: siteConfig.locale,
  siteName: siteConfig.name,
  title: siteConfig.name,
  description:
    "Tartas vascas de queso, lattas y pedidos por encargo en Villa Devoto.",
  url: siteConfig.url,
  images: [
    {
      url: siteConfig.ogImage,
      width: 900,
      height: 1600,
      alt: "Tarta vasca Natta con superficie caramelizada",
    },
  ],
};

export const sharedTwitter: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
  title: siteConfig.name,
  description: sharedOpenGraph.description ?? siteConfig.description,
  images: [siteConfig.ogImage],
};

type FaqItem = {
  answer: string;
  question: string;
};

const businessId = `${siteConfig.url}/#business`;
const websiteId = `${siteConfig.url}/#website`;
const homePageId = `${siteConfig.url}/#webpage`;
const menuId = `${siteConfig.url}/#menu`;
const faqId = `${siteConfig.url}/#faq`;

export function buildHomeStructuredData(faq: FaqItem[]) {
  const business = {
    "@type": "Bakery",
    "@id": businessId,
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.logo),
    image: absoluteUrl(siteConfig.ogImage),
    description: siteConfig.description,
    telephone: siteConfig.phone,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Villa Devoto",
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    areaServed: [
      {
        "@type": "AdministrativeArea",
        name: "Villa Devoto, Buenos Aires",
      },
      {
        "@type": "City",
        name: "Buenos Aires",
      },
    ],
    makesOffer: {
      "@id": menuId,
    },
    sameAs: [siteConfig.instagram, siteConfig.facebook],
  };

  const menuItems = flavors.map((flavor) => ({
    "@type": "MenuItem",
    "@id": `${siteConfig.url}/#menu-${flavor.id}`,
    name: `Tarta vasca ${flavor.name}`,
    description: flavor.description,
    menuAddOn: cakeSizes.map((size) => ({
      "@type": "MenuItem",
      name: size.label,
      description: `${size.detail}. ${size.servings}.`,
    })),
    offers: Object.entries(flavor.prices)
      .filter(([, price]) => price !== null)
      .map(([size, price]) => ({
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        price,
        priceCurrency: "ARS",
        url: absoluteUrl("/pedido"),
        itemOffered: {
          "@type": "Product",
          name: `${flavor.name} ${size}`,
        },
      })),
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      business,
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: siteConfig.name,
        url: siteConfig.url,
        inLanguage: siteConfig.language,
        publisher: {
          "@id": businessId,
        },
      },
      {
        "@type": "WebPage",
        "@id": homePageId,
        url: siteConfig.url,
        name: siteConfig.title,
        description: siteConfig.description,
        isPartOf: {
          "@id": websiteId,
        },
        about: {
          "@id": businessId,
        },
        mainEntity: {
          "@id": businessId,
        },
        inLanguage: siteConfig.language,
      },
      {
        "@type": "Menu",
        "@id": menuId,
        name: "Menu de tartas vascas Natta",
        url: `${siteConfig.url}/#menu`,
        hasMenuSection: [
          {
            "@type": "MenuSection",
            name: "Tartas vascas de queso",
            hasMenuItem: menuItems,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        url: `${siteConfig.url}/#faq`,
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteConfig.url}/#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: siteConfig.shortName,
            item: siteConfig.url,
          },
        ],
      },
    ],
  };
}

export function buildOrderStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteConfig.url}/pedido#webpage`,
        url: absoluteUrl("/pedido"),
        name: "Pedido | Natta Vascas",
        description: siteConfig.orderDescription,
        isPartOf: {
          "@id": websiteId,
        },
        about: {
          "@id": businessId,
        },
        inLanguage: siteConfig.language,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteConfig.url}/pedido#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: siteConfig.shortName,
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Pedido",
            item: absoluteUrl("/pedido"),
          },
        ],
      },
    ],
  };
}
