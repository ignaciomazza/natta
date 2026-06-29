import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";
import { OrderStatusLookup } from "@/components/order-status-lookup";
import { SiteLogo } from "@/components/site-logo";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Estado de pedido",
  description: siteConfig.statusDescription,
  alternates: {
    canonical: "/estado-pedido",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function EstadoPedidoPage() {
  return (
    <>
      <main className="min-h-screen bg-[var(--cream-soft)]">
        <header className="border-b border-[rgba(81,53,48,0.09)] bg-[var(--cream-soft)]/82 px-4 py-2.5 backdrop-blur-2xl md:px-8">
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
            <div className="flex items-center gap-3">
              <BrandLoaderLink
                className="hidden h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-sm text-[var(--chocolate)] transition hover:border-[var(--chocolate)] sm:inline-flex"
                href="/"
              >
                <ArrowLeft className="h-4 w-4" />
                Inicio
              </BrandLoaderLink>
              <BrandLoaderLink
                className="motion-button inline-flex h-10 items-center gap-2 rounded-full bg-[var(--chocolate-deep)] px-4 text-sm font-medium text-[var(--milk)] transition hover:bg-[var(--sage)]"
                href="/pedido"
              >
                Armar pedido
                <ArrowRight className="h-4 w-4" />
              </BrandLoaderLink>
            </div>
          </nav>
        </header>

        <section className="section-pad py-12 md:py-16 lg:py-20">
          <div className="content-shell">
            <div className="mb-8 max-w-3xl md:mb-10">
              <h1 className="font-display text-[3.65rem] leading-[1.08] tracking-[-0.04em] text-[var(--chocolate-deep)] sm:text-6xl md:text-7xl">
                Seguí tu pedido <span className="italic">natta</span>
              </h1>
            </div>

            <OrderStatusLookup />
          </div>
        </section>
      </main>
      <SiteFooter ctaHref="/pedido" ctaLabel="Armar pedido" />
    </>
  );
}
