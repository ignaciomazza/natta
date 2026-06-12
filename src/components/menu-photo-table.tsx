"use client";

import Image from "next/image";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { flavors, formatCurrency, type Flavor, type SizeId } from "@/lib/catalog";

type ProductPhoto = {
  src: string;
  alt: string;
};

type SlideDirection = "next" | "previous";
type SlideOffset = "center" | SlideDirection;

const sizeColumns: SizeId[] = ["latta", "chica", "grande"];

const sizeLabels: Record<SizeId, string> = {
  latta: "Latta",
  chica: "Chica",
  grande: "Grande",
};

const productPhotos: Record<string, ProductPhoto> = {
  natta: {
    src: "/images/Instagram_files/633114726_18560669452017460_185298347140133489_n.jpg",
    alt: "Tartas Natta vistas desde arriba en sus moldes",
  },
  limu: {
    src: "/images/Instagram_files/517928155_18515416210017460_2823923844824747085_n.jpg",
    alt: "Porcion cremosa de tarta Natta sobre plato negro",
  },
  choco: {
    src: "/images/Instagram_files/520535978_753804793969988_6114112854840394034_n.jpg",
    alt: "Porcion de tarta Natta con cucharita dorada",
  },
  tella: {
    src: "/images/Instagram_files/519650611_18516525010017460_3007151048163527603_n.jpg",
    alt: "Porcion de tarta Natta con frutos secos",
  },
  blanca: {
    src: "/images/Instagram_files/521939553_18517831567017460_4398237793762632065_n.jpg",
    alt: "Tarta Natta entera sobre plato negro",
  },
  tachio: {
    src: "/images/Instagram_files/517928155_18515416210017460_2823923844824747085_n.jpg",
    alt: "Porcion de tarta Natta con pistachos",
  },
  duo: {
    src: "/images/Instagram_files/629664627_18562076539017460_5672466112806136791_n.jpg",
    alt: "Lattas Natta con etiquetas de sabores",
  },
  argenta: {
    src: "/images/Instagram_files/590847679_18544256392017460_217947530894216047_n.jpg",
    alt: "Tarta Natta caramelizada en molde",
  },
  mocha: {
    src: "/images/Instagram_files/629664627_18562076539017460_5672466112806136791_n.jpg",
    alt: "Lattas Natta listas para entregar",
  },
  brulee: {
    src: "/images/Instagram_files/590847679_18544256392017460_217947530894216047_n.jpg",
    alt: "Tarta Natta creme brulee con superficie caramelizada",
  },
};

const wrapIndex = (index: number) => (index + flavors.length) % flavors.length;

export function MenuPhotoTable() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [slideOffset, setSlideOffset] = useState<SlideOffset>("center");
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const targetIndexRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);

  const visibleIndexes = useMemo(() => {
    if (isAnimating && targetIndex !== null) {
      return slideOffset === "previous"
        ? [targetIndex, activeIndex, wrapIndex(activeIndex + 1)]
        : [wrapIndex(activeIndex - 1), activeIndex, targetIndex];
    }

    return [wrapIndex(activeIndex - 1), activeIndex, wrapIndex(activeIndex + 1)];
  }, [activeIndex, isAnimating, slideOffset, targetIndex]);

  const visualActiveIndex =
    isAnimating && targetIndex !== null ? targetIndex : activeIndex;

  const finishSlide = useCallback((forcedIndex?: number) => {
    const nextIndex = forcedIndex ?? targetIndexRef.current;

    if (!isAnimatingRef.current || nextIndex === null) return;

    if (finishTimeoutRef.current !== null) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }

    isAnimatingRef.current = false;
    targetIndexRef.current = null;
    setActiveIndex(nextIndex);
    setTargetIndex(null);
    setSlideOffset("center");
    setIsAnimating(false);
  }, []);

  const startSlide = useCallback(
    (nextIndex: number, direction: SlideDirection) => {
      if (isAnimatingRef.current || nextIndex === activeIndex) return;

      isAnimatingRef.current = true;
      targetIndexRef.current = nextIndex;
      setTargetIndex(nextIndex);
      setSlideOffset(direction);
      setIsAnimating(true);

      finishTimeoutRef.current = window.setTimeout(() => {
        finishSlide(nextIndex);
      }, 720);
    },
    [activeIndex, finishSlide],
  );

  useEffect(() => {
    if (isPaused || isAnimating) return;

    const interval = window.setInterval(() => {
      startSlide(wrapIndex(activeIndex + 1), "next");
    }, 4300);

    return () => window.clearInterval(interval);
  }, [activeIndex, isAnimating, isPaused, startSlide]);

  useEffect(() => {
    return () => {
      if (finishTimeoutRef.current !== null) {
        window.clearTimeout(finishTimeoutRef.current);
      }
    };
  }, []);

  const selectFlavor = (nextIndex: number) => {
    if (nextIndex === activeIndex || isAnimatingRef.current) return;

    const forwardDistance = wrapIndex(nextIndex - activeIndex);
    const backwardDistance = wrapIndex(activeIndex - nextIndex);

    startSlide(
      nextIndex,
      forwardDistance <= backwardDistance ? "next" : "previous",
    );
  };

  const goToPrevious = () => {
    startSlide(wrapIndex(activeIndex - 1), "previous");
  };

  const goToNext = () => {
    startSlide(wrapIndex(activeIndex + 1), "next");
  };

  const activeFlavor = flavors[activeIndex] ?? flavors[0];

  return (
    <div
      aria-label="Sabores de Natta"
      aria-roledescription="carousel"
      className="mt-8 md:mt-10"
      data-reveal="subtle"
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (
          nextFocusedElement instanceof Node &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return;
        }

        setIsPaused(false);
      }}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <p className="sr-only" aria-live="polite">
        {activeFlavor.name}: {activeFlavor.description}
      </p>

      <div className="menu-carousel-viewport py-6">
        <div
          className={`menu-carousel-track ${isAnimating ? "is-sliding" : ""}`}
          data-slide-offset={slideOffset}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "transform"
            ) {
              finishSlide();
            }
          }}
        >
          {visibleIndexes.map((flavorIndex, position) => (
            <MenuSlideCard
              flavor={flavors[flavorIndex]}
              isActive={visualActiveIndex === flavorIndex}
              key={`${flavors[flavorIndex].id}-${position}`}
              onSelect={() => selectFlavor(flavorIndex)}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-[28rem] items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {flavors.map((flavor, index) => (
            <button
              aria-label={`Ver ${flavor.name}`}
              aria-pressed={activeIndex === index}
              className={`h-2 rounded-full transition disabled:pointer-events-none ${
                activeIndex === index
                  ? "w-7 bg-[var(--chocolate-deep)]"
                  : "w-2 bg-[var(--chocolate)]/22 hover:bg-[var(--chocolate)]/45"
              }`}
              disabled={isAnimating}
              key={flavor.id}
              onClick={() => selectFlavor(index)}
              type="button"
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Sabor anterior"
            className="grid h-10 w-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--milk)] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] hover:text-[var(--chocolate-deep)] disabled:pointer-events-none disabled:opacity-45"
            disabled={isAnimating}
            onClick={goToPrevious}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Sabor siguiente"
            className="grid h-10 w-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--milk)] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] hover:text-[var(--chocolate-deep)] disabled:pointer-events-none disabled:opacity-45"
            disabled={isAnimating}
            onClick={goToNext}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuSlideCard({
  flavor,
  isActive,
  onSelect,
}: {
  flavor: Flavor;
  isActive: boolean;
  onSelect: () => void;
}) {
  const photo = productPhotos[flavor.id] ?? productPhotos.natta;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isActive || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    onSelect();
  };

  return (
    <article
      aria-current={isActive ? "true" : undefined}
      aria-label={`${flavor.name}: ${flavor.description}`}
      className={`menu-slide-card image-shadow rounded-[24px] bg-[var(--milk)] p-2 ${
        isActive ? "is-active" : ""
      }`}
      onClick={isActive ? undefined : onSelect}
      onKeyDown={handleKeyDown}
      role={isActive ? undefined : "button"}
      tabIndex={isActive ? -1 : 0}
    >
      <div className="px-3 pb-3 pt-3 md:px-4 md:pt-4">
        <h3 className="font-display text-5xl leading-none text-[var(--chocolate-deep)] md:text-6xl">
          {flavor.name}
        </h3>
        <p className="mt-2 min-h-6 text-base leading-6 text-[var(--chocolate)]/72">
          {flavor.description}
        </p>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[var(--cream)]">
        <Image
          alt={photo.alt}
          className="object-cover"
          fill
          loading="eager"
          sizes="(min-width: 768px) 28rem, 88vw"
          src={photo.src}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 px-2 py-3 md:gap-5 md:px-3 md:py-4">
        {sizeColumns.map((size) => (
          <Price
            key={size}
            label={sizeLabels[size]}
            value={flavor.prices[size]}
          />
        ))}
      </div>
    </article>
  );
}

function Price({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div
        aria-label="No disponible"
        className="px-1 py-1 text-center text-[var(--chocolate)]/34"
      >
        <span className="block text-[0.62rem] uppercase tracking-[0.14em]">
          {label}
        </span>
        <span className="mt-1 block font-mono text-sm">—</span>
      </div>
    );
  }

  return (
    <div className="px-1 py-1 text-center text-[var(--chocolate)]">
      <span className="block text-[0.62rem] uppercase tracking-[0.14em] text-[var(--sage)]">
        {label}
      </span>
      <span className="mt-1 block font-mono text-[0.72rem] md:text-sm">
        {formatCurrency(value)}
      </span>
    </div>
  );
}
