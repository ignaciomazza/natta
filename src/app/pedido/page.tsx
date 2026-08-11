import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";
import { OrderAssistant } from "@/components/order-assistant";
import { SiteLogo } from "@/components/site-logo";
import { SiteFooter } from "@/components/site-footer";
import { StructuredData } from "@/components/structured-data";
import {
  buildOrderStructuredData,
  sharedOpenGraph,
  sharedTwitter,
  siteConfig,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pedido",
  description: siteConfig.orderDescription,
  alternates: {
    canonical: "/pedido",
  },
  openGraph: {
    ...sharedOpenGraph,
    title: "Pedido | Natta Vascas",
    description: siteConfig.orderDescription,
    url: "/pedido",
  },
  twitter: {
    ...sharedTwitter,
    title: "Pedido | Natta Vascas",
    description: siteConfig.orderDescription,
  },
};

export default function PedidoPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--cream-soft)]">
      <StructuredData data={buildOrderStructuredData()} />
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/35 bg-[var(--cream-soft)]/86 px-4 py-2 backdrop-blur-xl md:px-8 md:py-2.5">
        <nav className="content-shell flex items-center justify-between gap-4">
          <BrandLoaderLink
            className="group shrink-0"
            href="/"
            aria-label="Natta"
          >
            <SiteLogo
              className="h-10 w-auto transition duration-200 group-hover:scale-[1.03] md:h-11"
              priority
            />
          </BrandLoaderLink>
          <div className="hidden items-center gap-7 text-sm text-[var(--chocolate)]/72 md:flex">
            <Link className="transition hover:text-[var(--chocolate)]" href="/#menu">
              menú
            </Link>
            <Link className="transition hover:text-[var(--chocolate)]" href="/#faq">
              dudas
            </Link>
            <BrandLoaderLink
              className="transition hover:text-[var(--chocolate)]"
              href="/"
            >
              inicio
            </BrandLoaderLink>
          </div>
        </nav>
      </header>

      <section className="section-pad noise overflow-hidden bg-[var(--cream-soft)] pb-8 pt-[5.5rem] md:pb-10 md:pt-24">
        <div className="content-shell min-w-0" data-reveal="subtle">
          <BrandLoaderLink
            className="motion-link inline-flex items-center gap-2 text-sm font-medium text-[var(--sage)] transition hover:text-[var(--chocolate)]"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </BrandLoaderLink>

          <div className="mt-7 max-w-[calc(100vw-2rem)] md:mt-6 md:max-w-4xl">
            <h1 className="font-display text-[clamp(3.7rem,12vw,6.5rem)] leading-[0.84] tracking-[-0.06em] text-[var(--chocolate-deep)]">
              pedido
            </h1>
            <p className="mt-4 max-w-2xl break-words text-[0.8rem] leading-5 text-[var(--chocolate)]/80 sm:mt-5 sm:text-sm sm:leading-6 md:mt-4 md:text-xl md:leading-8">
              Elegí sucursal, sabores, cantidades, fecha y modalidad. El pago
              se hace desde la web y Natta te escribe para confirmar el pedido.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad overflow-hidden bg-[var(--cream)] py-8 md:py-10 lg:py-12" id="armar">
        <div className="content-shell min-w-0">
          <OrderAssistant />
        </div>
      </section>

      <SiteFooter ctaHref="/" ctaLabel="Volver al inicio" />
    </main>
  );
}
