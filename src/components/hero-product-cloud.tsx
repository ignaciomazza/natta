"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

type PointerState = {
  x: number;
  y: number;
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
  hideOnMobile?: boolean;
  floatDelay?: string;
  floatY?: string;
  className?: string;
};

const logo = {
  src: "/images/logo/natta-logo-cropped.png",
  width: 1080,
  height: 610,
};

const heroPieces: HeroPiece[] = [
  {
    src: "/images/transparent-images/1.png",
    alt: "Tarta vasca Natta con centro cremoso",
    width: "clamp(5.4rem, 11vw, 10.4rem)",
    naturalWidth: 2268,
    naturalHeight: 4032,
    left: 16,
    top: 31,
    rotate: -17,
    depth: 18,
    expandX: -42,
    expandY: -18,
    scale: 0.98,
    hoverScale: 1.12,
    floatDelay: "-1.1s",
  },
  {
    src: "/images/transparent-images/2.png",
    alt: "Porcion de tarta vasca Natta",
    width: "clamp(4.7rem, 9vw, 8.8rem)",
    naturalWidth: 3213,
    naturalHeight: 5712,
    left: 83,
    top: 26,
    rotate: 16,
    depth: -20,
    expandX: 42,
    expandY: -32,
    scale: 0.92,
    hoverScale: 1.16,
    floatDelay: "-3.5s",
  },
  {
    src: "/images/transparent-images/3.png",
    alt: "Latta Natta con superficie dorada",
    width: "clamp(5.8rem, 12vw, 11.5rem)",
    naturalWidth: 2268,
    naturalHeight: 4032,
    left: 11,
    top: 61,
    rotate: 12,
    depth: -14,
    expandX: -56,
    expandY: 10,
    hoverScale: 1.1,
    floatDelay: "-2.2s",
  },
  {
    src: "/images/transparent-images/4.png",
    alt: "Corte de tarta vasca Natta",
    width: "clamp(5rem, 10vw, 9.8rem)",
    naturalWidth: 3213,
    naturalHeight: 5712,
    left: 88,
    top: 58,
    rotate: -12,
    depth: 22,
    expandX: 58,
    expandY: 10,
    hoverScale: 1.14,
    hideOnMobile: true,
    floatDelay: "-4.1s",
  },
  {
    src: "/images/transparent-images/5.png",
    alt: "Tarta vasca Natta en formato chico",
    width: "clamp(4.3rem, 8vw, 7.8rem)",
    naturalWidth: 3213,
    naturalHeight: 5712,
    left: 28,
    top: 80,
    rotate: -24,
    depth: 16,
    expandX: -26,
    expandY: 42,
    hoverScale: 1.18,
    floatDelay: "-0.4s",
  },
  {
    src: "/images/transparent-images/6.png",
    alt: "Porcion de tarta vasca con borde caramelizado",
    width: "clamp(4.8rem, 9vw, 8.7rem)",
    naturalWidth: 4284,
    naturalHeight: 5712,
    left: 76,
    top: 83,
    rotate: 19,
    depth: -18,
    expandX: 34,
    expandY: 48,
    scale: 0.96,
    hoverScale: 1.13,
    floatDelay: "-2.8s",
  },
  {
    src: "/images/transparent-images/7.png",
    alt: "Tarta Natta vista desde arriba",
    width: "clamp(4.1rem, 7vw, 6.8rem)",
    naturalWidth: 4284,
    naturalHeight: 5712,
    left: 51,
    top: 16,
    rotate: 8,
    depth: 10,
    expandX: 0,
    expandY: -44,
    opacity: 0.88,
    hideOnMobile: true,
    floatDelay: "-5.2s",
  },
  {
    src: "/images/transparent-images/8.png",
    alt: "Porcion cremosa de tarta vasca Natta",
    width: "clamp(4.4rem, 7vw, 7.2rem)",
    naturalWidth: 4284,
    naturalHeight: 5712,
    left: 50,
    top: 92,
    rotate: -5,
    depth: -12,
    expandX: 0,
    expandY: 36,
    opacity: 0.88,
    hideOnMobile: true,
    floatDelay: "-1.8s",
  },
  {
    src: "/images/ilustration/IMG_5332.PNG",
    alt: "Ilustracion de tarta Natta",
    width: "clamp(3.8rem, 6vw, 5.8rem)",
    naturalWidth: 998,
    naturalHeight: 1157,
    left: 36,
    top: 26,
    rotate: -9,
    depth: -9,
    expandX: -18,
    expandY: -28,
    scale: 0.9,
    hoverScale: 1.08,
    opacity: 0.58,
    hideOnMobile: true,
    floatDelay: "-3.1s",
    floatY: "-5px",
    className: "hero-product-piece--illustration",
  },
  {
    src: "/images/ilustration/IMG_5333.PNG",
    alt: "Ilustracion de porcion Natta",
    width: "clamp(3.6rem, 6vw, 5.5rem)",
    naturalWidth: 999,
    naturalHeight: 1157,
    left: 64,
    top: 35,
    rotate: 11,
    depth: 8,
    expandX: 18,
    expandY: -18,
    scale: 0.88,
    hoverScale: 1.1,
    opacity: 0.52,
    hideOnMobile: true,
    floatDelay: "-0.7s",
    floatY: "-6px",
    className: "hero-product-piece--illustration",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function HeroProductCloud() {
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<PointerState>({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
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
      className="hero-product-cloud section-pad relative min-h-[100svh] overflow-hidden bg-[var(--cream-soft)] pt-20 noise md:pt-24"
      id="inicio"
      onPointerLeave={resetPointer}
      onPointerMove={handlePointerMove}
    >
      <div className="hero-product-cloud__stage content-shell relative flex min-h-[calc(100svh-5rem)] items-center justify-center py-8 md:min-h-[calc(100svh-6rem)] md:py-12">
        <div aria-hidden="true" className="hero-product-cloud__pieces">
          {heroPieces.map((piece) => {
            const rotation =
              piece.rotate + pointer.x * piece.depth * 0.05 - pointer.y * piece.depth * 0.035;
            const baseScale = piece.scale ?? 1;
            const expandedScale = baseScale * (piece.hoverScale ?? 1.12);
            const baseOpacity = piece.opacity ?? 0.94;
            const expandedOpacity = Math.min(baseOpacity + 0.06, 1);
            const style = {
              left: `${piece.left}%`,
              top: `${piece.top}%`,
              width: piece.width,
              "--cursor-x": `${(pointer.x * piece.depth).toFixed(2)}px`,
              "--cursor-y": `${(pointer.y * piece.depth).toFixed(2)}px`,
              "--hover-x": `${piece.expandX}px`,
              "--hover-y": `${piece.expandY}px`,
              "--piece-rotate": `${rotation.toFixed(2)}deg`,
              "--piece-scale": baseScale.toFixed(3),
              "--piece-scale-expanded": expandedScale.toFixed(3),
              "--piece-opacity": baseOpacity.toFixed(3),
              "--piece-opacity-expanded": expandedOpacity.toFixed(3),
              "--float-delay": piece.floatDelay ?? "0s",
              "--float-y": piece.floatY ?? "-9px",
            } as CSSProperties;

            return (
              <span
                className={[
                  "hero-product-piece",
                  piece.hideOnMobile ? "hidden md:block" : "",
                  piece.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={piece.src}
                style={style}
              >
                <Image
                  alt={piece.alt}
                  className="hero-product-piece__image"
                  height={piece.naturalHeight}
                  priority={piece.src === "/images/transparent-images/1.png"}
                  sizes="(min-width: 1024px) 12vw, (min-width: 768px) 16vw, 24vw"
                  src={piece.src}
                  width={piece.naturalWidth}
                />
              </span>
            );
          })}
        </div>

        <div className="hero-product-cloud__copy relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="reveal-up mb-5 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--sage)] md:mb-6 md:gap-3 md:text-sm md:tracking-[0.28em]">
            <Sparkles className="h-4 w-4" />
            La cremosidad llegó a Devoto.
          </p>
          <h1 className="sr-only">Natta Vascas</h1>
          <Link
            aria-label="Ir al pedido de Natta"
            className="hero-product-cloud__logo reveal-soft"
            href="/pedido"
          >
            <Image
              alt="Natta"
              className="hero-product-cloud__logo-image"
              height={logo.height}
              priority
              sizes="(min-width: 1024px) 34rem, (min-width: 768px) 42vw, 74vw"
              src={logo.src}
              width={logo.width}
            />
          </Link>
          <p className="reveal-up mt-5 max-w-xl break-words text-xl leading-8 text-[var(--chocolate)]/82 delay-100 md:mt-6 md:text-2xl md:leading-10">
            No te lo podemos explicar: <em>tenés que probarlo</em>.
          </p>
        </div>
      </div>
    </section>
  );
}
