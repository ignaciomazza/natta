"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { BrandLoaderLink } from "@/components/brand-loader-link";

type PointerState = {
  x: number;
  y: number;
};

type HeroPieceOverride = {
  width?: string;
  left?: number;
  top?: number;
  rotate?: number;
  expandX?: number;
  expandY?: number;
  scale?: number;
  opacity?: number;
};

type HeroPiece = {
  src: string;
  alt: string;
  width: string;
  naturalWidth: number;
  naturalHeight: number;
  left: number;
  top: number;
  rotate: number;
  depth: number;
  expandX: number;
  expandY: number;
  scale?: number;
  hoverScale?: number;
  opacity?: number;
  priority?: boolean;
  hideOnDesktop?: boolean;
  hideOnMobile?: boolean;
  hideOnSmallMobile?: boolean;
  tablet?: HeroPieceOverride;
  mobile?: HeroPieceOverride;
  smallMobile?: HeroPieceOverride;
  floatDelay?: string;
  floatY?: string;
  className?: string;
};

const logo = {
  src: "/images/logo/natta-logo-cropped.png",
  width: 1080,
  height: 610,
};

const staticImageVersion = "20260612-static";
const optimizedHeroPiece = (file: string) =>
  `/images/optimized/hero-pieces/${file}?v=${staticImageVersion}`;
const illustrationSticker = (file: string) =>
  `/images/ilustration/${file}?v=${staticImageVersion}`;

const heroPieces: HeroPiece[] = [
  {
    src: optimizedHeroPiece("1.webp"),
    alt: "Tarta vasca Natta con centro cremoso",
    width: "clamp(5.4rem, 11vw, 10.4rem)",
    naturalWidth: 788,
    naturalHeight: 1400,
    left: 10,
    top: 53,
    rotate: -17,
    depth: 18,
    expandX: -42,
    expandY: -18,
    scale: 0.98,
    hoverScale: 1.12,
    priority: true,
    floatDelay: "-1.1s",
    tablet: {
      left: 7,
      top: 44,
      width: "clamp(5rem, 14vw, 8.4rem)",
    },
    mobile: {
      left: 0,
      top: 2,
      width: "clamp(8.15rem, 47vw, 10.6rem)",
      expandX: -10,
      expandY: -8,
      scale: 1.08,
    },
    smallMobile: {
      left: -1,
      top: 3,
      width: "8rem",
      scale: 1.04,
    },
  },
  {
    src: optimizedHeroPiece("2.webp"),
    alt: "Porcion de tarta vasca Natta",
    width: "clamp(4.7rem, 9vw, 8.8rem)",
    naturalWidth: 788,
    naturalHeight: 1400,
    left: 94,
    top: 44,
    rotate: 16,
    depth: -20,
    expandX: 42,
    expandY: 0,
    scale: 0.92,
    hoverScale: 1.16,
    priority: true,
    floatDelay: "-3.5s",
    floatY: "0px",
    className: "hero-product-piece--bottom-safe",
    tablet: {
      left: 95,
      top: 41,
      width: "clamp(4.4rem, 12vw, 7.5rem)",
    },
    mobile: {
      left: 26,
      top: 75,
      width: "clamp(5.15rem, 27vw, 6.4rem)",
      expandX: 8,
      expandY: -8,
      scale: 0.98,
    },
    smallMobile: {
      left: 25,
      top: 75,
      width: "5.05rem",
      scale: 0.92,
    },
  },
  {
    src: optimizedHeroPiece("3.webp"),
    alt: "Latta Natta con superficie dorada",
    width: "clamp(5.8rem, 12vw, 11.5rem)",
    naturalWidth: 788,
    naturalHeight: 1400,
    left: 11,
    top: 61,
    rotate: 12,
    depth: -14,
    expandX: -56,
    expandY: 10,
    hoverScale: 1.1,
    hideOnDesktop: true,
    priority: true,
    hideOnMobile: true,
    floatDelay: "-2.2s",
    tablet: {
      left: 9,
      top: 62,
      width: "clamp(5rem, 13vw, 8.4rem)",
    },
    mobile: {
      left: -2,
      top: 67,
      width: "clamp(5.2rem, 25vw, 6.4rem)",
      expandX: -8,
      expandY: 6,
      scale: 0.9,
    },
    smallMobile: {
      left: -4,
      top: 67,
      width: "4.7rem",
      scale: 0.84,
    },
  },
  {
    src: optimizedHeroPiece("5.webp"),
    alt: "Tarta vasca Natta en formato chico",
    width: "clamp(4rem, 7vw, 7rem)",
    naturalWidth: 788,
    naturalHeight: 1400,
    left: 20,
    top: 86,
    rotate: -24,
    depth: 16,
    expandX: -26,
    expandY: 42,
    hoverScale: 1.18,
    hideOnDesktop: true,
    priority: true,
    hideOnMobile: true,
    floatDelay: "-0.4s",
    tablet: {
      left: 19,
      top: 85,
      width: "clamp(4rem, 10vw, 6.4rem)",
    },
    mobile: {
      left: 20,
      top: 81,
      width: "clamp(3.75rem, 16vw, 4.65rem)",
      expandX: -4,
      expandY: 6,
      scale: 0.86,
    },
    smallMobile: {
      left: 17,
      top: 80,
      width: "3.65rem",
      scale: 0.8,
    },
  },
  {
    src: optimizedHeroPiece("6.webp"),
    alt: "Porcion de tarta vasca con borde caramelizado",
    width: "clamp(4.8rem, 9vw, 8.7rem)",
    naturalWidth: 1050,
    naturalHeight: 1400,
    left: 88,
    top: 90,
    rotate: 19,
    depth: -18,
    expandX: 34,
    expandY: 48,
    scale: 0.96,
    hoverScale: 1.13,
    hideOnMobile: true,
    floatDelay: "-2.8s",
    tablet: {
      left: 90,
      top: 90,
      width: "clamp(4.2rem, 11vw, 7rem)",
    },
    mobile: {
      left: 27,
      top: 61,
      width: "clamp(5.2rem, 27vw, 6.6rem)",
      expandX: 6,
      expandY: 8,
      scale: 0.96,
    },
    smallMobile: {
      left: 26,
      top: 61,
      width: "5.05rem",
      scale: 0.9,
    },
  },
  {
    src: optimizedHeroPiece("7.webp"),
    alt: "Tarta Natta vista desde arriba",
    width: "clamp(4.1rem, 7vw, 6.8rem)",
    naturalWidth: 1050,
    naturalHeight: 1400,
    left: 21,
    top: 13,
    rotate: 8,
    depth: 10,
    expandX: 0,
    expandY: -44,
    opacity: 0.88,
    priority: true,
    floatDelay: "-5.2s",
    tablet: {
      left: 20,
      top: 15,
      width: "clamp(3.7rem, 9vw, 5.8rem)",
    },
    mobile: {
      left: 100.5,
      top: 41,
      width: "clamp(6rem, 27vw, 7rem)",
      expandX: 0,
      expandY: -8,
      opacity: 0.84,
      scale: 1,
    },
    smallMobile: {
      left: 100.5,
      top: 41,
      width: "5.35rem",
      scale: 0.96,
    },
  },
  {
    src: optimizedHeroPiece("8.webp"),
    alt: "Porcion cremosa de tarta vasca Natta",
    width: "clamp(4.4rem, 7vw, 7.2rem)",
    naturalWidth: 1050,
    naturalHeight: 1400,
    left: 50,
    top: 92,
    rotate: -5,
    depth: -12,
    expandX: 0,
    expandY: 36,
    opacity: 0.88,
    hideOnDesktop: true,
    hideOnMobile: true,
    floatDelay: "-1.8s",
  },
  {
    src: illustrationSticker("IMG_5332.PNG"),
    alt: "Sticker de tarta Natta",
    width: "clamp(6.4rem, 9vw, 9.6rem)",
    naturalWidth: 998,
    naturalHeight: 1157,
    left: 20,
    top: 87,
    rotate: -11,
    depth: 7,
    expandX: -20,
    expandY: 18,
    scale: 0.94,
    hoverScale: 1.08,
    opacity: 0.68,
    hideOnDesktop: true,
    hideOnMobile: true,
    floatDelay: "-3.1s",
    floatY: "-5px",
    className: "hero-product-piece--sticker",
    tablet: {
      left: 19,
      top: 87,
      width: "clamp(5.8rem, 11vw, 8.2rem)",
    },
  },
  {
    src: illustrationSticker("IMG_5331.PNG"),
    alt: "Sticker de porcion Natta",
    width: "clamp(7.6rem, 11vw, 11.6rem)",
    naturalWidth: 998,
    naturalHeight: 1157,
    left: 86,
    top: 17,
    rotate: 8,
    depth: -8,
    expandX: 22,
    expandY: -14,
    scale: 0.92,
    hoverScale: 1.1,
    opacity: 0.66,
    hideOnDesktop: true,
    hideOnMobile: true,
    floatDelay: "-0.7s",
    floatY: "-6px",
    className: "hero-product-piece--sticker",
    tablet: {
      left: 86,
      top: 18,
      width: "clamp(6.6rem, 13vw, 9.4rem)",
    },
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const setPieceOverrideVars = (
  style: CSSProperties & Record<string, string>,
  prefix: "tablet" | "mobile" | "small-mobile",
  override?: HeroPieceOverride,
) => {
  if (!override) {
    return;
  }

  if (override.left !== undefined) {
    style[`--piece-${prefix}-left`] = `${override.left}%`;
  }

  if (override.top !== undefined) {
    style[`--piece-${prefix}-top`] = `${override.top}%`;
  }

  if (override.width) {
    style[`--piece-${prefix}-width`] = override.width;
  }

  if (override.rotate !== undefined) {
    style[`--piece-${prefix}-rotate`] = `${override.rotate}deg`;
  }

  if (override.scale !== undefined) {
    style[`--piece-${prefix}-scale`] = override.scale.toFixed(3);
  }

  if (override.opacity !== undefined) {
    style[`--piece-${prefix}-opacity`] = override.opacity.toFixed(3);
  }
};

export function HeroProductCloud() {
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0 });
  const [mobileScrollExpanded, setMobileScrollExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<PointerState>({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scrollFrame: number | null = null;
    let lastScrollY = window.scrollY;

    const setCompact = () => setMobileScrollExpanded(false);

    const updateScrollExpansion = () => {
      scrollFrame = null;

      if (!mobileQuery.matches || reducedMotionQuery.matches) {
        setCompact();
        lastScrollY = window.scrollY;
        return;
      }

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (Math.abs(delta) < 3) {
        return;
      }

      const section = sectionRef.current;
      const bounds = section?.getBoundingClientRect();
      const isHeroVisible = bounds
        ? bounds.bottom > window.innerHeight * 0.12 &&
          bounds.top < window.innerHeight * 0.88
        : currentScrollY < window.innerHeight;

      if (delta < 0) {
        setMobileScrollExpanded(false);
      } else if (isHeroVisible && currentScrollY > 6) {
        setMobileScrollExpanded(true);
      }

      lastScrollY = currentScrollY;
    };

    const requestScrollUpdate = () => {
      if (scrollFrame !== null) {
        return;
      }

      scrollFrame = window.requestAnimationFrame(updateScrollExpansion);
    };

    const handleMediaChange = () => {
      lastScrollY = window.scrollY;
      setCompact();
    };

    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    mobileQuery.addEventListener("change", handleMediaChange);
    reducedMotionQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("scroll", requestScrollUpdate);
      mobileQuery.removeEventListener("change", handleMediaChange);
      reducedMotionQuery.removeEventListener("change", handleMediaChange);

      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, []);

  const commitPointer = (nextPointer: PointerState) => {
    pendingPointerRef.current = nextPointer;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setPointer(pendingPointerRef.current);
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    const y =
      (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);

    commitPointer({
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1),
    });
  };

  const resetPointer = () => {
    commitPointer({ x: 0, y: 0 });
  };

  return (
    <section
      className={[
        "hero-product-cloud section-pad relative min-h-[100svh] overflow-hidden bg-[var(--cream-soft)] pt-20 noise md:pt-24",
        mobileScrollExpanded ? "is-mobile-scroll-expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id="inicio"
      onPointerLeave={resetPointer}
      onPointerMove={handlePointerMove}
      ref={sectionRef}
    >
      <div className="hero-product-cloud__stage content-shell relative flex min-h-[calc(100svh-5rem)] items-center justify-center py-8 md:min-h-[calc(100svh-6rem)] md:py-12">
        <div aria-hidden="true" className="hero-product-cloud__pieces">
          {heroPieces.map((piece) => {
            const shouldPreloadPiece =
              piece.priority && !piece.hideOnDesktop && !piece.hideOnMobile;
            const rotation =
              piece.rotate + pointer.x * piece.depth * 0.05 - pointer.y * piece.depth * 0.035;
            const baseScale = piece.scale ?? 1;
            const expandedScale = baseScale * (piece.hoverScale ?? 1.12);
            const baseOpacity = piece.opacity ?? 0.94;
            const expandedOpacity = Math.min(baseOpacity + 0.06, 1);
            const tabletScale = piece.tablet?.scale ?? baseScale;
            const mobileScale = piece.mobile?.scale ?? baseScale;
            const smallMobileScale = piece.smallMobile?.scale ?? mobileScale;
            const mobileExpandX = piece.mobile?.expandX ?? piece.expandX;
            const mobileExpandY = piece.mobile?.expandY ?? piece.expandY;
            const smallMobileExpandX =
              piece.smallMobile?.expandX ?? mobileExpandX;
            const smallMobileExpandY =
              piece.smallMobile?.expandY ?? mobileExpandY;
            const style = {
              "--piece-left": `${piece.left}%`,
              "--piece-top": `${piece.top}%`,
              "--piece-width": piece.width,
              "--cursor-x": `${(pointer.x * piece.depth).toFixed(2)}px`,
              "--cursor-y": `${(pointer.y * piece.depth).toFixed(2)}px`,
              "--hover-x": `${piece.expandX}px`,
              "--hover-y": `${piece.expandY}px`,
              "--piece-rotate": `${rotation.toFixed(2)}deg`,
              "--piece-scale": baseScale.toFixed(3),
              "--piece-scale-expanded": expandedScale.toFixed(3),
              "--piece-scale-expanded-tablet": (
                tabletScale + (expandedScale - baseScale) * 0.82
              ).toFixed(3),
              "--piece-scale-expanded-mobile": (
                mobileScale + (expandedScale - baseScale) * 0.52
              ).toFixed(3),
              "--piece-scale-expanded-small-mobile": (
                smallMobileScale + (expandedScale - baseScale) * 0.36
              ).toFixed(3),
              "--piece-opacity": baseOpacity.toFixed(3),
              "--piece-opacity-expanded": expandedOpacity.toFixed(3),
              "--mobile-hover-x": `${Math.round(mobileExpandX * 0.42)}px`,
              "--mobile-hover-y": `${Math.round(mobileExpandY * 0.38)}px`,
              "--small-mobile-hover-x": `${Math.round(
                smallMobileExpandX * 0.3,
              )}px`,
              "--small-mobile-hover-y": `${Math.round(
                smallMobileExpandY * 0.28,
              )}px`,
              "--float-delay": piece.floatDelay ?? "0s",
              "--float-y": piece.floatY ?? "-9px",
            } as CSSProperties & Record<string, string>;

            setPieceOverrideVars(style, "tablet", piece.tablet);
            setPieceOverrideVars(style, "mobile", piece.mobile);
            setPieceOverrideVars(style, "small-mobile", piece.smallMobile);

            return (
              <span
                className={[
                  "hero-product-piece",
                  piece.hideOnDesktop ? "hero-product-piece--hide-desktop" : "",
                  piece.hideOnMobile ? "hero-product-piece--hide-mobile" : "",
                  piece.hideOnSmallMobile
                    ? "hero-product-piece--hide-small-mobile"
                    : "",
                  piece.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={piece.src}
                style={style}
              >
                <img
                  alt={piece.alt}
                  className="hero-product-piece__image"
                  decoding="async"
                  {...(shouldPreloadPiece
                    ? { fetchPriority: "high" as const }
                    : { loading: "lazy" as const })}
                  height={piece.naturalHeight}
                  src={piece.src}
                  width={piece.naturalWidth}
                />
              </span>
            );
          })}
        </div>

        <div className="hero-product-cloud__copy relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="hero-product-cloud__eyebrow reveal-up mb-5 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--sage)] md:mb-6 md:gap-3 md:text-sm md:tracking-[0.28em]">
            <Sparkles className="h-4 w-4" />
            La cremosidad llegó a Devoto.
          </p>
          <h1 className="sr-only">Natta Vascas</h1>
          <BrandLoaderLink
            aria-label="Ir al pedido de Natta"
            className="hero-product-cloud__logo reveal-soft"
            href="/pedido"
          >
            <img
              alt="Natta"
              className="hero-product-cloud__logo-image"
              decoding="async"
              fetchPriority="high"
              height={logo.height}
              src={logo.src}
              width={logo.width}
            />
          </BrandLoaderLink>
          <p className="hero-product-cloud__tagline reveal-up mt-5 max-w-xl break-words text-xl leading-8 text-[var(--chocolate)]/82 delay-100 md:mt-6 md:text-2xl md:leading-10">
            No te lo podemos explicar: <em>tenés que probarlo</em>.
          </p>
        </div>
      </div>
    </section>
  );
}
