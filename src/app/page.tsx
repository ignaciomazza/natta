import Image from "next/image";
import { ArrowRight, Heart } from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";
import { FaqList } from "@/components/faq-list";
import { HeroProductCloud } from "@/components/hero-product-cloud";
import { cakeSizes, flavors, formatCurrency } from "@/lib/catalog";

const instagramImages = {
  hero: "/images/Instagram_files/633114726_18560669452017460_185298347140133489_n.jpg",
  box: "/images/Instagram_files/517107658_18515416462017460_6047792586767829182_n.jpg",
  platedSlice:
    "/images/Instagram_files/517928155_18515416210017460_2823923844824747085_n.jpg",
  cutCake:
    "/images/Instagram_files/519650611_18516525010017460_3007151048163527603_n.jpg",
  wholeCake:
    "/images/Instagram_files/521939553_18517831567017460_4398237793762632065_n.jpg",
  spoonable:
    "/images/Instagram_files/520535978_753804793969988_6114112854840394034_n.jpg",
  tableMoment:
    "/images/Instagram_files/580286270_18412217524143217_8204408670605817052_n.jpg",
  caramelTop:
    "/images/Instagram_files/590847679_18544256392017460_217947530894216047_n.jpg",
  couple:
    "/images/Instagram_files/607318777_18550019701017460_8443849260003577236_n.jpg",
  lattas:
    "/images/Instagram_files/629664627_18562076539017460_5672466112806136791_n.jpg",
};

const featuredImages = [
  {
    src: instagramImages.couple,
    alt: "Cami y Martin sosteniendo una tarta vasca Natta",
    label: "nosotros",
  },
  {
    src: instagramImages.cutCake,
    alt: "Porcion de tarta vasca Natta de pistacho sobre plato negro",
    label: "pistacho",
  },
  {
    src: instagramImages.box,
    alt: "Caja Natta para retiro o envio",
    label: "retiro",
  },
];

const editorialImages = [
  {
    src: instagramImages.platedSlice,
    alt: "Porcion de tarta vasca sobre plato negro",
    label: "porción",
  },
  {
    src: instagramImages.spoonable,
    alt: "Latta de chocolate cuchareable",
    label: "cuchareable",
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
    label: "entera",
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
      "Si hay cupo puede salir en 24 h, pero la recomendación real es pedir con 48/72 h de anticipación, y más tiempo para ocasiones especiales.",
  },
  {
    question: "¿Qué diferencia hay entre chica y grande?",
    answer:
      "La chica mide 15 cm y rinde entre 4 y 6 porciones. La grande ronda 24 cm y rinde entre 8 y 12 porciones.",
  },
  {
    question: "¿Hacen envíos?",
    answer:
      "Sí, coordinados en el día por Uber o Cabify. Para envío se pide el pago total del producto por anticipado.",
  },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[rgba(81,53,48,0.09)] bg-[var(--cream-soft)]/76 px-4 py-3 backdrop-blur-2xl md:px-8">
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
        className="hero-followup-section mobile-section-compact section-pad section-y bg-[var(--milk)]"
        id="como-pedir"
      >
        <div className="content-shell grid gap-6 md:gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="max-w-2xl" data-reveal="left">
            <p className="mb-3 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--sage)] md:mb-5 md:text-sm md:tracking-[0.28em]">
              Cómo pedir
            </p>
            <h2 className="font-display text-[2.55rem] leading-[0.95] tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl md:leading-none">
              Elegís, reservás y coordinamos.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-[var(--chocolate)]/72 md:mt-6 md:text-lg md:leading-8">
              48/72 h de anticipación · Villa Devoto · envío por Uber/Cabify.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 md:gap-7" data-stagger>
            <div
              className="step-card border-t border-[var(--line)] pt-3 md:pt-5"
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
              className="step-card border-t border-[var(--line)] pt-3 md:pt-5"
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
              className="step-card border-t border-[var(--line)] pt-3 md:pt-5"
              data-reveal="subtle"
            >
              <p className="hidden text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:block">
                03
              </p>
              <p className="font-display text-2xl text-[var(--chocolate-deep)] md:mt-3 md:text-3xl">
                Retirás
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/72 md:mt-3 md:text-base md:leading-7">
                Por Devoto o con envío coordinado.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="section-pad section-y bg-[var(--cream)]"
        id="historia"
      >
        <div className="content-shell grid gap-10 md:gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div data-reveal="left">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
              Nosotros
            </p>
            <h2 className="font-display text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Devoto le puso nombre a nuestras tartas.
            </h2>
          </div>
          <div className="max-w-3xl space-y-5 text-lg leading-8 text-[var(--chocolate)]/80 md:text-xl md:leading-9">
            <p data-reveal="right">
              Natta nació de una pasión que compartimos desde hace 12 años: la
              cocina y la búsqueda constante de nuevas experiencias
              gastronómicas.
            </p>
            <p data-reveal="right">
              Con el tiempo, esa curiosidad por explorar sabores y texturas se
              convirtió también en una búsqueda cada vez más precisa: entender
              los detalles, perfeccionar procesos y encontrar ese equilibrio
              entre intensidad, suavidad y cremosidad que define cada creación.
            </p>
            <p data-reveal="right">
              Un proyecto creado para compartir, acompañar encuentros y
              transformar el sabor en experiencia. Porque creemos que muchas
              veces los mejores recuerdos empiezan alrededor de una mesa.
            </p>
          </div>
        </div>

        <div
          className="content-shell mt-10 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-3 md:gap-4"
          data-stagger
        >
          {featuredImages.map((image, index) => (
            <div
              className={`group image-shadow lift-hover relative overflow-hidden rounded-[20px] bg-[var(--milk)] md:rounded-[26px] ${
                index === 2
                  ? "col-span-2 aspect-[2.25/1] md:col-span-1 md:aspect-[4/5]"
                  : "aspect-[4/5]"
              }`}
              data-reveal="scale"
              key={image.src}
            >
              <Image
                alt={image.alt}
                className="object-cover transition duration-700 group-hover:scale-105"
                fill
                sizes={
                  index === 2
                    ? "(min-width: 768px) 33vw, 100vw"
                    : "(min-width: 768px) 33vw, 50vw"
                }
                src={image.src}
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-[var(--milk)]/88 px-3 py-1.5 text-sm lowercase text-[var(--chocolate)] backdrop-blur md:bottom-4 md:left-4 md:px-4 md:py-2">
                {image.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mobile-section-compact section-pad section-y bg-[var(--chocolate-deep)] text-[var(--milk)]">
        <div className="content-shell grid gap-6 md:gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div data-reveal="left">
            <p className="mb-3 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--caramel-soft)] md:mb-5 md:gap-3 md:text-sm md:tracking-[0.28em]">
              <Heart className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Textura primero
            </p>
            <h2 className="font-display text-[2.55rem] leading-[0.95] tracking-[-0.04em] md:text-7xl">
              Cremosa por dentro. Firme por fuera.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 md:gap-6" data-stagger>
            {cakeSizes.map((size) => (
              <div
                className="step-card border-t border-white/18 pt-3 md:pt-5"
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

      <section className="section-y-tight bg-[var(--cream-soft)]">
        <div className="section-pad content-shell">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
            <div data-reveal="left">
              <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
                Desde Instagram
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                La textura se entiende antes de leer.
              </h2>
            </div>
            <p
              className="max-w-md text-lg leading-8 text-[var(--chocolate)]/78 md:pb-1"
              data-reveal="right"
            >
              Fotos reales del producto, las cajas y las mesas donde Natta ya
              empezó a formar parte de cumpleaños, antojos y sobremesas.
            </p>
          </div>
        </div>

        <div
          className="editorial-rail mt-10 flex gap-3 overflow-x-auto px-4 pb-5 md:mt-12 md:gap-4 md:px-8"
          data-stagger
        >
          {editorialImages.map((image, index) => (
            <div
              className={`editorial-card group image-shadow lift-hover relative shrink-0 overflow-hidden rounded-[26px] bg-[var(--milk)] ${
                index % 3 === 1
                  ? "h-[430px] w-[300px] md:h-[560px] md:w-[380px]"
                  : "h-[390px] w-[270px] md:h-[500px] md:w-[340px]"
              }`}
              data-reveal="scale"
              key={image.src}
            >
              <Image
                alt={image.alt}
                className="object-cover transition duration-700 group-hover:scale-105"
                fill
                sizes="(min-width: 768px) 380px, 300px"
                src={image.src}
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-[var(--milk)]/88 px-3 py-1.5 text-sm lowercase text-[var(--chocolate)] backdrop-blur md:bottom-4 md:left-4 md:px-4 md:py-2">
                {image.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="section-pad section-y bg-[var(--cream-soft)]"
        id="menu"
      >
        <div className="content-shell">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
            <div data-reveal="left">
              <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
                Menú inicial
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                Sabores con nombre propio.
              </h2>
            </div>
          </div>

          <div
            className="mt-10 overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--milk)] md:mt-14 md:rounded-[28px]"
            data-reveal="subtle"
          >
            <div className="grid grid-cols-[minmax(7rem,1.4fr)_repeat(3,minmax(3.25rem,0.8fr))] items-center gap-2 border-b border-[var(--line)] px-4 py-3 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--sage)] md:gap-3 md:px-7 md:py-4 md:text-xs md:tracking-[0.18em]">
              <span>Sabor</span>
              <span>Latta</span>
              <span>Chica</span>
              <span>Grande</span>
            </div>
            {flavors.map((flavor) => (
              <div
                className="menu-row grid grid-cols-[minmax(7rem,1.4fr)_repeat(3,minmax(3.25rem,0.8fr))] items-center gap-2 border-b border-[var(--line)] px-4 py-4 last:border-b-0 md:gap-3 md:px-7 md:py-5"
                key={flavor.id}
              >
                <div>
                  <p className="font-display text-3xl leading-none text-[var(--chocolate-deep)]">
                    {flavor.name}
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--chocolate)]/72">
                    {flavor.description}
                  </p>
                </div>
                <Price value={flavor.prices.latta} />
                <Price value={flavor.prices.chica} />
                <Price value={flavor.prices.grande} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="section-pad section-y bg-[var(--cream-soft)]"
        id="faq"
      >
        <div className="content-shell grid gap-10 md:gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal="left">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[var(--sage)] md:mb-5">
              Preguntas frecuentes
            </p>
            <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Lo que suelen preguntar antes de probar.
            </h2>
          </div>
          <FaqList items={faq} />
        </div>
      </section>

      <footer className="section-pad bg-[var(--chocolate-deep)] pb-32 pt-12 text-[var(--milk)] md:py-12">
        <div className="content-shell flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-5xl italic">natta</p>
            <p className="mt-2 text-sm text-[var(--milk)]/62">
              Amantes de las tartas de queso · Villa Devoto
            </p>
          </div>
          <BrandLoaderLink
            className="motion-button lift-hover inline-flex h-12 items-center justify-center rounded-full bg-[var(--milk)] px-6 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--chocolate-deep)] transition hover:bg-[var(--caramel-soft)]"
            href="/pedido"
          >
            Armar pedido
          </BrandLoaderLink>
        </div>
      </footer>

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

function Price({ value }: { value: number }) {
  return (
    <span className="self-center font-mono text-[0.72rem] text-[var(--chocolate)] md:text-base">
      {formatCurrency(value)}
    </span>
  );
}
