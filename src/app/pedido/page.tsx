import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";
import { OrderAssistant } from "@/components/order-assistant";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Pedido | Natta Vascas",
  description:
    "Arma tu pedido de tartas vascas Natta con sabores, fecha, modalidad y pago online.",
};

export default function PedidoPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--cream-soft)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/35 bg-[var(--cream-soft)]/86 px-4 py-2 backdrop-blur-xl md:px-8 md:py-2.5">
        <nav className="content-shell flex items-center justify-between gap-4">
          <BrandLoaderLink
            className="shrink-0 font-display text-3xl leading-none italic text-[var(--chocolate)]"
            href="/"
          >
            natta
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

      <section className="section-pad noise overflow-hidden bg-[var(--cream-soft)] pb-10 pt-[5.5rem] md:pb-14 md:pt-28">
        <div className="content-shell min-w-0" data-reveal="subtle">
          <BrandLoaderLink
            className="motion-link inline-flex items-center gap-2 text-sm font-medium text-[var(--sage)] transition hover:text-[var(--chocolate)]"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </BrandLoaderLink>

          <div className="mt-7 max-w-[calc(100vw-2rem)] md:mt-9 md:max-w-4xl">
            <h1 className="font-display text-[clamp(3.7rem,15vw,9rem)] leading-[0.84] tracking-[-0.06em] text-[var(--chocolate-deep)]">
              pedido
            </h1>
            <p className="mt-5 max-w-2xl break-words text-sm leading-6 text-[var(--chocolate)]/80 md:mt-7 md:text-2xl md:leading-10">
              Elegí sabores, cantidades, fecha y modalidad. El pago se hace
              desde la web y Natta te escribe para confirmar el pedido.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad overflow-hidden bg-[var(--cream)] py-10 md:py-[4.5rem] lg:py-16" id="armar">
        <div className="content-shell min-w-0">
          <OrderAssistant />
        </div>
      </section>

      <SiteFooter ctaHref="/" ctaLabel="Volver al inicio" />
    </main>
  );
}
