import {
  ArrowRight,
  ExternalLink,
  Heart,
  ReceiptText,
} from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";
import { FaqList } from "@/components/faq-list";
import { HeroProductCloud } from "@/components/hero-product-cloud";
import { MenuPhotoTable } from "@/components/menu-photo-table";
import { SiteFooter } from "@/components/site-footer";
import { cakeSizes } from "@/lib/catalog";

const staticImageVersion = "20260612-static";
const optimizedInstagramImage = (file: string) =>
  `/images/optimized/instagram/${file}.jpg?v=${staticImageVersion}`;

const instagramImages = {
  hero: optimizedInstagramImage(
    "633114726_18560669452017460_185298347140133489_n",
  ),
  box: optimizedInstagramImage(
    "517107658_18515416462017460_6047792586767829182_n",
  ),
  platedSlice:
    optimizedInstagramImage("517928155_18515416210017460_2823923844824747085_n"),
  cutCake:
    optimizedInstagramImage("519650611_18516525010017460_3007151048163527603_n"),
  wholeCake:
    optimizedInstagramImage("521939553_18517831567017460_4398237793762632065_n"),
  spoonable:
    optimizedInstagramImage("520535978_753804793969988_6114112854840394034_n"),
  tableMoment:
    optimizedInstagramImage("580286270_18412217524143217_8204408670605817052_n"),
  caramelTop:
    optimizedInstagramImage("590847679_18544256392017460_217947530894216047_n"),
  couple:
    optimizedInstagramImage("607318777_18550019701017460_8443849260003577236_n"),
  lattas:
    optimizedInstagramImage("629664627_18562076539017460_5672466112806136791_n"),
};

const editorialImages = [
  {
    src: instagramImages.cutCake,
    alt: "Porcion de tarta vasca Natta de pistacho sobre plato negro",
    label: "pistacho",
  },
  {
    src: instagramImages.platedSlice,
    alt: "Porcion de tarta vasca sobre plato negro",
    label: "porción",
  },
  {
    src: instagramImages.spoonable,
    alt: "Latta de chocolate cuchareable",
    label: "textura",
  },
  {
    src: instagramImages.lattas,
    alt: "Latas Natta listas para entregar",
    label: "lattas",
  },
  {
    src: instagramImages.tableMoment,
    alt: "Mesa con porciones de torta vasca y cafe",
    label: "mesa",
  },
  {
    src: instagramImages.wholeCake,
    alt: "Tarta vasca entera sobre plato negro",
    label: "clásica de queso",
  },
  {
    src: instagramImages.caramelTop,
    alt: "Tarta vasca caramelizada vista desde arriba",
    label: "caramelo",
  },
];

const faq = [
  {
    question: "¿La tarta está cruda?",
    answer:
      "No. La tarta vasca se hornea a alta temperatura para lograr una superficie caramelizada y un centro suave, cremoso y estable.",
  },
  {
    question: "¿Cuánto tarda el pedido?",
    answer:
      "Si hay cupo puede salir en 24 h, pero la recomendación real es pedir con 48 h de anticipación, y más tiempo para ocasiones especiales.",
  },
  {
    question: "¿Qué diferencia hay entre chica y grande?",
    answer:
      "La Latta mide 11 cm y pesa 300 g. La chica mide 15 cm, pesa 950 g aprox. y rinde entre 4 y 6 porciones. La grande mide 24 cm, pesa 2 kg aprox. y rinde entre 10 y 12 porciones.",
  },
  {
    question: "¿Hacen envíos?",
    answer:
      "Sí, coordinamos envío por Uber. Para envío se pide el pago total del producto por anticipado.",
  },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[rgba(81,53,48,0.09)] bg-[var(--cream-soft)]/76 px-4 py-2.5 backdrop-blur-2xl md:px-8">
        <nav className="content-shell grid grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <a
            className="shrink-0 justify-self-start font-display text-3xl leading-none italic text-[var(--chocolate)] transition hover:text-[var(--chocolate-deep)]"
            href="#inicio"
          >
            natta
          </a>
          <div className="hidden items-center gap-8 justify-self-center text-sm text-[var(--chocolate)]/68 md:flex">
            <a
              className="transition hover:text-[var(--chocolate)]"
              href="#historia"
            >
              historia
            </a>
            <a
              className="transition hover:text-[var(--chocolate)]"
              href="#menu"
            >
              menú
            </a>
            <BrandLoaderLink
              className="transition hover:text-[var(--chocolate)]"
              href="/pedido"
            >
              pedido
            </BrandLoaderLink>
            <a className="transition hover:text-[var(--chocolate)]" href="#faq">
              dudas
            </a>
          </div>
          <BrandLoaderLink
            className="cta-soft-shadow motion-button inline-flex h-10 shrink-0 items-center justify-center gap-2 justify-self-end rounded-full border border-[var(--chocolate)] bg-[var(--milk)] px-3 text-sm font-medium text-[var(--chocolate)] transition hover:bg-[var(--chocolate)] hover:text-[var(--milk)] sm:px-4"
            href="/pedido"
          >
            <span className="hidden sm:inline">Armar pedido</span>
            <span className="sm:hidden">Pedido</span>
            <ArrowRight className="h-4 w-4" />
          </BrandLoaderLink>
        </nav>
      </header>

      <HeroProductCloud />

      <section
        className="middle-mobile-section hero-followup-section mobile-section-compact section-pad section-y section-y-roomy bg-[var(--milk)]"
        id="como-pedir"
      >
        <div className="content-shell">
          <div className="grid gap-8 md:gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div className="max-w-2xl" data-reveal="left">
              <p className="mb-3 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--sage)] md:mb-5 md:text-sm md:tracking-[0.28em]">
                Cómo pedir
              </p>
              <h2 className="font-display text-[2.55rem] leading-[0.95] tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl md:leading-none">
                Elegís, reservás y coordinamos.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-[var(--chocolate)]/72 md:mt-6 md:text-lg md:leading-8">
                48 h de anticipación · Villa Devoto · envío por Uber.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3 md:gap-7" data-stagger>
              <div
                className="step-card border-[var(--line)] pt-3 md:border-t md:pt-5"
                data-reveal="subtle"
              >
                <p className="hidden text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:block">
                  01
                </p>
                <p className="font-display text-2xl text-[var(--chocolate-deep)] md:mt-3 md:text-3xl">
                  Elegís
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/72 md:mt-3 md:text-base md:leading-7">
                  Tamaño, sabor y fecha.
                </p>
              </div>
              <div
                className="step-card border-[var(--line)] pt-3 md:border-t md:pt-5"
                data-reveal="subtle"
              >
                <p className="hidden text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:block">
                  02
                </p>
                <p className="font-display text-2xl text-[var(--chocolate-deep)] md:mt-3 md:text-3xl">
                  Reservás
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/72 md:mt-3 md:text-base md:leading-7">
                  Confirmamos cupo y seña.
                </p>
              </div>
              <div
                className="step-card border-[var(--line)] pt-3 md:border-t md:pt-5"
                data-reveal="subtle"
              >
                <p className="hidden text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:block">
                  03
                </p>
                <p className="font-display text-2xl text-[var(--chocolate-deep)] md:mt-3 md:text-3xl">
                  Retirás
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/72 md:mt-3 md:text-base md:leading-7">
                  Por Devoto o con envío por Uber previamente coordinado.
                </p>
              </div>
            </div>
          </div>

          <div
            className="mx-auto mb-[4.75rem] mt-36 grid max-w-[54rem] gap-12 py-10 sm:grid-cols-2 sm:gap-12 md:mb-[4.25rem] md:mt-48 md:gap-24 md:py-14"
            data-reveal="subtle"
          >
            <div className="flex flex-col items-center text-center">
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[var(--sage)] md:text-base">
                Nuevo pedido
              </p>
              <BrandLoaderLink
                className="motion-button inline-flex h-12 w-[17rem] items-center justify-center gap-2 rounded-full bg-[var(--chocolate-deep)] px-7 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--milk)] shadow-[0_8px_16px_rgba(38,35,33,0.18)] transition hover:bg-[var(--sage)] hover:shadow-[0_9px_18px_rgba(38,35,33,0.2)] sm:w-[18rem] md:h-[3.35rem] md:text-[0.95rem]"
                href="/pedido"
              >
                Armar
                <ArrowRight className="h-4 w-4" />
              </BrandLoaderLink>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[var(--sage)] md:text-base">
                Pedido en curso
              </p>
              <BrandLoaderLink
                className="motion-button inline-flex h-12 w-[17rem] items-center justify-center gap-2 rounded-full border border-[rgba(64,58,55,0.08)] bg-transparent px-7 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] shadow-[0_8px_16px_rgba(43,26,24,0.08)] transition hover:border-[var(--chocolate)] hover:bg-[var(--cream-soft)] hover:shadow-[0_9px_18px_rgba(43,26,24,0.1)] sm:w-[18rem] md:h-[3.35rem] md:text-[0.95rem]"
                href="/estado-pedido"
              >
                Ver estado
                <ReceiptText className="h-4 w-4" />
              </BrandLoaderLink>
            </div>
          </div>
        </div>
      </section>

      <section
        className="middle-mobile-section section-pad section-y bg-[var(--cream)]"
        id="historia"
      >
        <div className="content-shell grid gap-9 md:gap-11 lg:grid-cols-[minmax(0,0.98fr)_minmax(21rem,0.72fr)] lg:items-center lg:gap-16">
          <div className="max-w-2xl" data-reveal="left">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
              Nosotros
            </p>
            <h2 className="font-display text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              De Devoto a tu mesa.
            </h2>
            <div className="mt-5 max-w-xl space-y-4 text-base leading-7 text-[var(--chocolate)]/78 md:mt-7 md:space-y-5 md:text-lg md:leading-8">
              <p>
              Natta empezó en la cocina de Cami y Martín, entre pruebas,
              sobremesas y una búsqueda clara: una tarta vasca cremosa, firme y
              con identidad propia.
              </p>
              <p>
              Desde Devoto, esa idea encontró su formato más reconocible en la
              Latta: una porción individual, práctica y reutilizable, pensada
              para viajar bien y quedarse en la mesa.
              </p>
            </div>
          </div>
          <div className="lg:justify-self-end" data-reveal="right">
            <a
              className="group block max-w-md overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--milk)] text-[var(--chocolate)] image-shadow transition hover:-translate-y-0.5 hover:text-[var(--chocolate-deep)] lg:max-w-[24rem]"
              href="https://www.iprofesional.com/negocios/456313-tomaron-un-postre-tradicional-lo-pusieron-en-una-lata-y-crearon-un-gran-negocio"
              rel="noreferrer"
              target="_blank"
            >
              <span className="relative block aspect-[4/5] overflow-hidden bg-[var(--cream)]">
                <img
                  alt="Cami y Martin sosteniendo una tarta vasca Natta"
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  decoding="async"
                  loading="lazy"
                  src={instagramImages.couple}
                  style={{ objectPosition: "center 18%" }}
                />
                <span className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start rounded-full bg-[var(--milk)]/90 px-3 py-1.5 text-[0.62rem] uppercase leading-none tracking-[0.18em] text-[var(--sage)] shadow-[0_10px_22px_rgba(43,26,24,0.14)] backdrop-blur md:bottom-4 md:left-4 md:px-3.5 md:py-2 md:text-[0.68rem]">
                  Nota en iProfesional
                </span>
              </span>
              <span className="flex min-w-0 items-center justify-between gap-3 p-4 md:p-5">
                <span className="min-w-0">
                  <span className="block text-base leading-6 md:text-lg md:leading-7">
                    La historia de cómo la tarta vasca llegó al formato latta.
                  </span>
                </span>
                <span className="shrink-0 px-1.5">
                  <ExternalLink className="h-5 w-5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="middle-mobile-section mobile-section-compact section-pad section-y section-y-roomy bg-[var(--chocolate-deep)] text-[var(--milk)]">
        <div className="content-shell grid gap-8 md:gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div data-reveal="left">
            <p className="mb-3 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--caramel-soft)] md:mb-5 md:gap-3 md:text-sm md:tracking-[0.28em]">
              <Heart className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Textura primero
            </p>
            <h2 className="font-display text-[2.55rem] leading-[0.95] tracking-[-0.04em] md:text-7xl">
              Cremosa por dentro. Firme por fuera.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3 md:gap-6" data-stagger>
            {cakeSizes.map((size) => (
              <div
                className="step-card border-white/18 pt-3 md:border-t md:pt-5"
                data-reveal="subtle"
                key={size.id}
              >
                <p className="font-display text-3xl md:text-4xl">{size.label}</p>
                <p className="mt-2 text-[0.68rem] uppercase leading-5 tracking-[0.16em] text-[var(--caramel-soft)] md:mt-3 md:text-sm md:leading-normal md:tracking-[0.18em]">
                  {size.detail}
                </p>
                <p className="mt-2 text-sm text-[var(--milk)]/72 md:mt-4 md:text-base">
                  {size.servings}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="middle-mobile-section instagram-mobile-section section-y-tight !pb-0 bg-[var(--cream-soft)]">
        <div className="section-pad content-shell max-md:px-5">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
            <div data-reveal="left">
              <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
                Desde Instagram
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                Natta y vos.
              </h2>
            </div>
          </div>
        </div>

        <div
          className="editorial-rail flex gap-4 overflow-x-auto px-7 pb-10 pt-6 md:gap-4 md:px-10 md:pt-8"
          data-stagger
        >
          {editorialImages.map((image, index) => (
            <div
              className={`editorial-card group image-shadow lift-hover relative shrink-0 rounded-[26px] bg-[var(--milk)] ${
                index % 3 === 1
                  ? "h-[430px] w-[300px] md:h-[560px] md:w-[380px]"
                  : "h-[390px] w-[270px] md:h-[500px] md:w-[340px]"
              }`}
              data-reveal="scale"
              key={image.src}
            >
              <span className="absolute inset-0 overflow-hidden rounded-[26px]">
                <img
                  alt={image.alt}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  decoding="async"
                  loading="lazy"
                  src={image.src}
                />
              </span>
              <span className="absolute bottom-3 left-3 rounded-full bg-[var(--milk)]/88 px-3 py-1.5 text-sm lowercase text-[var(--chocolate)] backdrop-blur md:bottom-4 md:left-4 md:px-4 md:py-2">
                {image.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="middle-mobile-section section-pad section-y bg-[var(--cream-soft)]"
        id="menu"
      >
        <div className="content-shell">
          <div className="flex flex-col items-center justify-center gap-7 text-center md:gap-8">
            <div className="mx-auto max-w-xl" data-reveal="left">
              <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
                Menú inicial
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                Sabores con nombre propio.
              </h2>
            </div>
          </div>

          <MenuPhotoTable />
        </div>
      </section>

      <section
        className="middle-mobile-section section-pad section-y bg-[var(--cream-soft)]"
        id="faq"
      >
        <div className="content-shell grid gap-12 md:gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal="left">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)]/65 md:mb-5">
              Preguntas frecuentes
            </p>
            <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Lo que suelen preguntar antes de probar.
            </h2>
          </div>
          <FaqList items={faq} />
        </div>
      </section>

      <SiteFooter />

      <div className="mobile-cta-gradient pointer-events-none fixed inset-x-0 bottom-0 z-40 h-28 md:hidden" />

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <BrandLoaderLink
          className="cta-soft-shadow mobile-cta-float motion-button flex h-14 items-center justify-center gap-2 rounded-full border border-[var(--chocolate)] bg-[var(--milk)] px-5 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] transition hover:bg-[var(--chocolate)] hover:text-[var(--milk)]"
          href="/pedido"
        >
          Armar pedido
          <ArrowRight className="h-4 w-4" />
        </BrandLoaderLink>
      </div>
    </main>
  );
}
