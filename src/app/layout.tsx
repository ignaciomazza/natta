import type { Metadata, Viewport } from "next";
import { BrandLoaderProvider } from "@/components/brand-loader";
import { MotionObserver } from "@/components/motion-observer";
import {
  sharedOpenGraph,
  sharedTwitter,
  siteConfig,
} from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.shortName,
  },
  authors: [{ name: siteConfig.name }],
  alternates: {
    canonical: "/",
  },
  creator: siteConfig.name,
  description: siteConfig.description,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  keywords: [
    "Natta",
    "Natta Vascas",
    "tartas vascas",
    "tarta vasca de queso",
    "cheesecake vasca",
    "pasteleria Villa Devoto",
    "tortas por encargo Buenos Aires",
    "lattas",
  ],
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/icons/apple-touch-icon.png",
      },
    ],
    icon: [
      { sizes: "any", url: "/favicon.ico" },
      {
        sizes: "16x16",
        type: "image/png",
        url: "/icons/favicon-16x16.png",
      },
      {
        sizes: "32x32",
        type: "image/png",
        url: "/icons/favicon-32x32.png",
      },
      {
        sizes: "192x192",
        type: "image/png",
        url: "/icons/icon-192.png",
      },
      {
        sizes: "512x512",
        type: "image/png",
        url: "/icons/icon-512.png",
      },
    ],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(siteConfig.url),
  openGraph: sharedOpenGraph,
  publisher: siteConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  twitter: sharedTwitter,
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: siteConfig.themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className="h-full scroll-smooth"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full bg-[var(--cream)] text-[var(--chocolate)] antialiased">
        <div className="brand-loader-shell" aria-hidden="true">
          <div className="brand-loader__glow" />
          <div className="brand-loader__content">
            <img
              alt=""
              className="brand-loader__logo"
              decoding="async"
              fetchPriority="high"
              height={610}
              src="/images/logo/natta-logo-cropped.png"
              width={1080}
            />
            <p className="brand-loader__subtitle">vascas</p>
          </div>
        </div>
        <BrandLoaderProvider>
          <MotionObserver />
          {children}
        </BrandLoaderProvider>
      </body>
    </html>
  );
}
