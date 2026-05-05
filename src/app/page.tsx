import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  MessageCircle,
  Sparkles,
} from "lucide-react";
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
      "La chica mide 15 cm y rinde entre 4 y 6 porciones. La grande ronda 24/25 cm y rinde entre 8 y 12 porciones.",
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
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/35 bg-[var(--cream-soft)]/82 px-4 py-3 backdrop-blur-xl md:px-8">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <a
            className="shrink-0 font-display text-3xl italic text-[var(--chocolate)]"
            href="#inicio"
          >
            natta
          </a>
          <div className="hidden items-center gap-7 text-sm text-[var(--chocolate)]/72 md:flex">
            <a className="transition hover:text-[var(--chocolate)]" href="#historia">
              historia
            </a>
            <a className="transition hover:text-[var(--chocolate)]" href="#menu">
              menú
            </a>
            <Link className="transition hover:text-[var(--chocolate)]" href="/pedido">
              pedido
            </Link>
            <a className="transition hover:text-[var(--chocolate)]" href="#faq">
              dudas
            </a>
          </div>
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--chocolate)] px-3 text-sm font-medium text-[var(--milk)] transition hover:bg-[var(--sage)] sm:px-4"
            href="/pedido#armar"
          >
            <span className="hidden sm:inline">Armar pedido</span>
            <span className="sm:hidden">Pedido</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section
        className="section-pad relative min-h-[100svh] bg-[var(--cream-soft)] pt-24 noise"
        id="inicio"
      >
        <div className="mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-7xl min-w-0 items-center gap-12 py-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative z-10 max-w-2xl min-w-0">
            <p className="reveal-up mb-6 flex items-center gap-3 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
              <Sparkles className="h-4 w-4" />
              La cremosidad llegó a Devoto.
            </p>
            <h1 className="reveal-up font-display text-[clamp(5rem,18vw,13rem)] leading-[0.78] tracking-[-0.08em] text-[var(--chocolate-deep)]">
              natta
            </h1>
            <p className="reveal-up mt-8 max-w-xl break-words text-xl leading-8 text-[var(--chocolate)]/82 delay-100 md:text-2xl md:leading-10">
              No te lo podemos explicar: <em>tenés que probarlo</em>.
            </p>
            <div className="reveal-up mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-14 w-full max-w-full min-w-0 items-center justify-center gap-2 rounded-full border border-[rgba(43,26,24,0.72)] bg-[rgba(43,26,24,0.05)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--chocolate)] hover:text-[var(--milk)] backdrop-blur-md transition hover:bg-[rgba(43,26,24,0.74)] sm:w-auto sm:px-7 sm:text-sm sm:tracking-[0.16em]"
                href="/pedido#armar"
              >
                Consultar pedido
                <MessageCircle className="h-5 w-5" />
              </Link>
              <a
                className="inline-flex h-14 w-full max-w-full min-w-0 items-center justify-center rounded-full border border-[var(--line)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] sm:w-auto sm:px-7 sm:text-sm sm:tracking-[0.16em]"
                href="#menu"
              >
                Ver menú
              </a>
            </div>
          </div>

          <div className="reveal-soft relative h-[58vh] min-h-[430px] w-full min-w-0 lg:h-[76vh]">
            <div className="hero-image image-shadow absolute inset-0 overflow-hidden bg-[var(--chocolate)]">
              <Image
                alt="Tartas vascas Natta en moldes sobre mesa"
                className="h-full w-full object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 54vw, 100vw"
                src={instagramImages.hero}
              />
            </div>
            <div className="float-slow absolute -bottom-6 left-6 rounded-full bg-[var(--milk)] px-5 py-3 text-sm text-[var(--chocolate)] soft-shadow">
              48/72 h de anticipación
            </div>
            <div className="absolute right-5 top-5 rounded-full border border-white/70 bg-[var(--milk)] px-5 py-3 text-sm text-[var(--chocolate)] soft-shadow">
              Lun a sáb
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad bg-[var(--cream)] py-24" id="historia">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
              Nosotros
            </p>
            <h2 className="font-display text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Devoto le puso nombre a nuestras tartas.
            </h2>
          </div>
          <div className="grid gap-8 text-lg leading-8 text-[var(--chocolate)]/80 md:grid-cols-2">
            <p>
              Natta empezó con una tarta vasca que nos dejó pensando: podíamos
              hacer una propia, más nuestra.
            </p>
            <p>
              Después llegaron los pedidos, los sabores y el apodo que quedó:
              nattas.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl gap-4 md:grid-cols-3">
          {featuredImages.map((image) => (
            <div
              className="group image-shadow relative aspect-[4/5] overflow-hidden rounded-[26px] bg-[var(--milk)]"
              key={image.src}
            >
              <Image
                alt={image.alt}
                className="object-cover transition duration-700 group-hover:scale-105"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                src={image.src}
              />
              <span className="absolute bottom-4 left-4 rounded-full bg-[var(--milk)]/88 px-4 py-2 text-sm lowercase text-[var(--chocolate)] backdrop-blur">
                {image.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[var(--cream-soft)] py-20">
        <div className="section-pad mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
                Desde Instagram
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                La textura se entiende antes de leer.
              </h2>
            </div>
            <p className="max-w-md text-lg leading-8 text-[var(--chocolate)]/78">
              Fotos reales del producto, las cajas y las mesas donde Natta ya
              empezó a formar parte de cumpleaños, antojos y sobremesas.
            </p>
          </div>
        </div>

        <div className="mt-12 flex gap-4 overflow-x-auto px-4 pb-5 md:px-8">
          {editorialImages.map((image, index) => (
            <div
              className={`group image-shadow relative shrink-0 overflow-hidden rounded-[26px] bg-[var(--milk)] ${
                index % 3 === 1
                  ? "h-[430px] w-[300px] md:h-[560px] md:w-[380px]"
                  : "h-[390px] w-[270px] md:h-[500px] md:w-[340px]"
              }`}
              key={image.src}
            >
              <Image
                alt={image.alt}
                className="object-cover transition duration-700 group-hover:scale-105"
                fill
                sizes="(min-width: 768px) 380px, 300px"
                src={image.src}
              />
              <span className="absolute bottom-4 left-4 rounded-full bg-[var(--milk)]/88 px-4 py-2 text-sm lowercase text-[var(--chocolate)] backdrop-blur">
                {image.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-pad bg-[var(--chocolate-deep)] py-24 text-[var(--milk)]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="mb-5 flex items-center gap-3 text-sm uppercase tracking-[0.28em] text-[var(--caramel-soft)]">
              <Heart className="h-4 w-4" />
              Textura primero
            </p>
            <h2 className="font-display text-5xl leading-[0.96] tracking-[-0.04em] md:text-7xl">
              Cremosa por dentro. Firme por fuera.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {cakeSizes.map((size) => (
              <div className="border-t border-white/18 pt-5" key={size.id}>
                <p className="font-display text-4xl">{size.label}</p>
                <p className="mt-3 text-sm uppercase tracking-[0.18em] text-[var(--caramel-soft)]">
                  {size.detail}
                </p>
                <p className="mt-4 text-[var(--milk)]/72">{size.servings}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-[var(--cream-soft)] py-24" id="menu">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
                Menú inicial
              </p>
              <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
                Pocos tamaños. Sabores con nombre propio.
              </h2>
            </div>
          </div>

          <div className="mt-14 overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--milk)]">
            <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-[var(--line)] px-4 py-4 text-xs uppercase tracking-[0.18em] text-[var(--sage)] md:px-7">
              <span>Sabor</span>
              <span>Latta</span>
              <span>Chica</span>
              <span>Grande</span>
            </div>
            {flavors.map((flavor) => (
              <div
                className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-[var(--line)] px-4 py-5 last:border-b-0 md:px-7"
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

      <section className="section-pad bg-[var(--cream-soft)] py-24" id="faq">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
              Preguntas frecuentes
            </p>
            <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Lo que suelen preguntar antes de probar.
            </h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {faq.map((item) => (
              <details className="group py-6" key={item.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-xl font-medium text-[var(--chocolate-deep)]">
                  {item.question}
                  <ArrowRight className="h-5 w-5 shrink-0 transition group-open:rotate-90" />
                </summary>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--chocolate)]/76">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-[var(--milk)] py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--sage)]">
              Cómo pedir
            </p>
            <h2 className="font-display text-5xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] md:text-7xl">
              Elegís, reservás y coordinamos.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--chocolate)]/72">
              48/72 h de anticipación · Villa Devoto · envío por Uber/Cabify.
            </p>
          </div>
          <div className="grid gap-7 sm:grid-cols-3">
            <div className="border-t border-[var(--line)] pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--sage)]">
                01
              </p>
              <p className="mt-3 font-display text-3xl text-[var(--chocolate-deep)]">
                Elegís
              </p>
              <p className="mt-3 leading-7 text-[var(--chocolate)]/72">
                Tamaño, sabor y fecha.
              </p>
            </div>
            <div className="border-t border-[var(--line)] pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--sage)]">
                02
              </p>
              <p className="mt-3 font-display text-3xl text-[var(--chocolate-deep)]">
                Reservás
              </p>
              <p className="mt-3 leading-7 text-[var(--chocolate)]/72">
                Confirmamos cupo y seña.
              </p>
            </div>
            <div className="border-t border-[var(--line)] pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--sage)]">
                03
              </p>
              <p className="mt-3 font-display text-3xl text-[var(--chocolate-deep)]">
                Retirás
              </p>
              <p className="mt-3 leading-7 text-[var(--chocolate)]/72">
                Por Devoto o con envío coordinado.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="section-pad bg-[var(--chocolate-deep)] py-12 text-[var(--milk)]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-5xl italic">natta</p>
            <p className="mt-2 text-sm text-[var(--milk)]/62">
              Amantes de las tartas de queso · Villa Devoto
            </p>
          </div>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--milk)] px-6 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--chocolate-deep)] transition hover:bg-[var(--caramel-soft)]"
            href="/pedido#armar"
          >
            Armar pedido
          </Link>
        </div>
      </footer>

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <Link
          className="soft-shadow flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--chocolate-deep)] px-5 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--milk)]"
          href="/pedido#armar"
        >
          Armar pedido
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}

function Price({ value }: { value: number }) {
  return (
    <span className="self-center font-mono text-sm text-[var(--chocolate)] md:text-base">
      {formatCurrency(value)}
    </span>
  );
}
