import type { Metadata } from "next";
import Image from "next/image";
import { BrandLoaderProvider } from "@/components/brand-loader";
import { MotionObserver } from "@/components/motion-observer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Natta Vascas | Tartas vascas de queso",
  description:
    "Tartas vascas de queso hechas por encargo en Villa Devoto. Menu corto, textura cremosa y pedidos con anticipacion.",
  metadataBase: new URL("https://nattavascas.com"),
  openGraph: {
    title: "Natta Vascas",
    description:
      "Tartas vascas de queso, lattas y pedidos por encargo en Villa Devoto.",
    images: [
      "/images/Instagram_files/633114726_18560669452017460_185298347140133489_n.jpg",
    ],
  },
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
            <Image
              alt=""
              className="brand-loader__logo"
              height={610}
              priority
              sizes="(min-width: 768px) 22rem, 72vw"
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
