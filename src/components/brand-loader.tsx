"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const visibleRoutes = new Set(["/", "/pedido"]);

type LoaderVariant = "initial" | "to-order" | "to-home";

const loaderCopy: Record<
  LoaderVariant,
  { eyebrow: string; title: string; subtitle: string }
> = {
  initial: {
    eyebrow: "Tortas vascas",
    subtitle: "vascas",
    title: "natta",
  },
  "to-home": {
    eyebrow: "Volviendo",
    subtitle: "inicio",
    title: "natta",
  },
  "to-order": {
    eyebrow: "Preparando",
    subtitle: "tu pedido",
    title: "pedido",
  },
};

const getRouteVariant = (
  previousPath: string | null,
  pathname: string,
  firstRender: boolean,
): LoaderVariant | null => {
  if (!visibleRoutes.has(pathname)) {
    return null;
  }

  if (firstRender) {
    return "initial";
  }

  if (previousPath === "/" && pathname === "/pedido") {
    return "to-order";
  }

  if (previousPath === "/pedido" && pathname === "/") {
    return "to-home";
  }

  return null;
};

export function BrandLoader() {
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState(pathname);
  const [loaderRequest, setLoaderRequest] = useState<{
    id: number;
    pathname: string;
    variant: LoaderVariant;
  } | null>(() => {
    const variant = getRouteVariant(null, pathname, true);

    return variant
      ? {
          id: 0,
          pathname,
          variant,
        }
      : null;
  });

  useEffect(() => {
    if (pathname === currentPath) {
      return;
    }

    const previousPath = currentPath;
    const timer = window.setTimeout(() => {
      const variant = getRouteVariant(previousPath, pathname, false);

      setCurrentPath(pathname);
      setLoaderRequest(
        variant
          ? {
              id: Date.now(),
              pathname,
              variant,
            }
          : null,
      );
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentPath, pathname]);

  if (!loaderRequest) {
    return null;
  }

  return (
    <BrandLoaderContent
      key={loaderRequest.id}
      pathname={loaderRequest.pathname}
      variant={loaderRequest.variant}
    />
  );
}

function BrandLoaderContent({
  pathname,
  variant,
}: {
  pathname: string;
  variant: LoaderVariant;
}) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const holdMs = prefersReducedMotion
      ? 420
      : variant === "initial"
        ? pathname === "/"
          ? 1550
          : 1150
        : 360;
    const exitMs =
      prefersReducedMotion ? 120 : variant === "initial" ? 820 : 460;

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, holdMs);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, holdMs + exitMs);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pathname, variant]);

  if (!visible) {
    return null;
  }

  const copy = loaderCopy[variant];

  return (
    <div
      aria-hidden="true"
      className={`brand-loader brand-loader--${variant}${
        leaving ? " is-leaving" : ""
      }`}
    >
      <div className="brand-loader__glow" />
      <div className="brand-loader__content">
        <p className="brand-loader__eyebrow">{copy.eyebrow}</p>
        <p className="brand-loader__title">{copy.title}</p>
        <p className="brand-loader__subtitle">{copy.subtitle}</p>
      </div>
    </div>
  );
}
