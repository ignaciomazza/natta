"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const visibleRoutes = new Set(["/", "/pedido"]);
const logo = {
  src: "/images/logo/natta-logo-cropped.png",
  width: 1080,
  height: 610,
};

type LoaderVariant = "initial" | "to-order" | "to-home";

const loaderCopy: Record<LoaderVariant, { eyebrow: string; subtitle: string }> =
  {
    initial: {
      eyebrow: "",
      subtitle: "vascas",
    },
    "to-home": {
      eyebrow: "Volviendo",
      subtitle: "inicio",
    },
    "to-order": {
      eyebrow: "Preparando",
      subtitle: "tu pedido",
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
  const router = useRouter();
  const expectedPathRef = useRef<string | null>(null);
  const [currentPath, setCurrentPath] = useState(pathname);
  const [loaderRequest, setLoaderRequest] = useState<{
    id: number;
    navigateTo?: string;
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

  const completeLoader = useCallback(() => {
    setLoaderRequest(null);
  }, []);

  const navigateWithLoader = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    document.documentElement.classList.add("brand-loader-hydrated");
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");

      if (!anchor?.href || anchor.target) {
        return;
      }

      const url = new URL(anchor.href);

      if (url.origin !== window.location.origin) {
        return;
      }

      const destinationPath = url.pathname;
      const variant = getRouteVariant(pathname, destinationPath, false);

      if (!variant || destinationPath === pathname) {
        return;
      }

      event.preventDefault();
      expectedPathRef.current = destinationPath;
      setLoaderRequest({
        id: Date.now(),
        navigateTo: `${url.pathname}${url.search}${url.hash}`,
        pathname: destinationPath,
        variant,
      });
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === currentPath) {
      return;
    }

    if (pathname === expectedPathRef.current) {
      expectedPathRef.current = null;
      setCurrentPath(pathname);
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
      navigateTo={loaderRequest.navigateTo}
      onComplete={completeLoader}
      onNavigate={navigateWithLoader}
      pathname={loaderRequest.pathname}
      variant={loaderRequest.variant}
    />
  );
}

function BrandLoaderContent({
  navigateTo,
  onComplete,
  onNavigate,
  pathname,
  variant,
}: {
  navigateTo?: string;
  onComplete: () => void;
  onNavigate: (href: string) => void;
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
          ? 1320
          : 980
        : 620;
    const exitMs =
      prefersReducedMotion ? 120 : variant === "initial" ? 720 : 500;
    const navigateMs = prefersReducedMotion ? 80 : 260;

    const navigateTimer = navigateTo
      ? window.setTimeout(() => {
          onNavigate(navigateTo);
        }, navigateMs)
      : null;
    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, holdMs);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      onComplete();
    }, holdMs + exitMs);

    return () => {
      if (navigateTimer) {
        window.clearTimeout(navigateTimer);
      }

      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [navigateTo, onComplete, onNavigate, pathname, variant]);

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
        {copy.eyebrow ? (
          <p className="brand-loader__eyebrow">{copy.eyebrow}</p>
        ) : null}
        <Image
          alt="Natta"
          className="brand-loader__logo"
          height={logo.height}
          priority
          sizes="(min-width: 768px) 22rem, 72vw"
          src={logo.src}
          width={logo.width}
        />
        <p className="brand-loader__subtitle">{copy.subtitle}</p>
      </div>
    </div>
  );
}
