"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BRAND_LOADER_NAVIGATE_EVENT,
  type BrandLoaderNavigate,
  type BrandLoaderNavigateDetail,
} from "@/lib/brand-loader-navigation";

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

const isLoaderNavigationEvent = (
  event: Event,
): event is CustomEvent<BrandLoaderNavigateDetail> =>
  "detail" in event &&
  typeof (event as CustomEvent<BrandLoaderNavigateDetail>).detail?.href ===
    "string";

const BrandLoaderNavigationContext =
  createContext<BrandLoaderNavigate | null>(null);

export const useBrandLoaderNavigation = () =>
  useContext(BrandLoaderNavigationContext);

export function BrandLoaderProvider({ children }: { children: ReactNode }) {
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

  const requestLoaderNavigation = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.origin);

      if (url.origin !== window.location.origin) {
        return false;
      }

      const destinationPath = url.pathname;
      const variant = getRouteVariant(pathname, destinationPath, false);

      if (!variant || destinationPath === pathname) {
        return false;
      }

      expectedPathRef.current = destinationPath;
      setLoaderRequest({
        id: Date.now(),
        navigateTo: `${url.pathname}${url.search}${url.hash}`,
        pathname: destinationPath,
        variant,
      });

      return true;
    },
    [pathname],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.documentElement.classList.add("brand-loader-hydrated");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    window.__nattaNavigateWithLoader = requestLoaderNavigation;

    const handleNavigationRequest = (event: Event) => {
      if (!isLoaderNavigationEvent(event)) {
        return;
      }

      if (requestLoaderNavigation(event.detail.href)) {
        event.preventDefault();
      }
    };

    window.addEventListener(BRAND_LOADER_NAVIGATE_EVENT, handleNavigationRequest);

    return () => {
      if (window.__nattaNavigateWithLoader === requestLoaderNavigation) {
        delete window.__nattaNavigateWithLoader;
      }

      window.removeEventListener(
        BRAND_LOADER_NAVIGATE_EVENT,
        handleNavigationRequest,
      );
    };
  }, [requestLoaderNavigation]);

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

  return (
    <BrandLoaderNavigationContext.Provider value={requestLoaderNavigation}>
      {loaderRequest ? (
        <BrandLoaderContent
          key={loaderRequest.id}
          navigateTo={loaderRequest.navigateTo}
          onComplete={completeLoader}
          onNavigate={navigateWithLoader}
          pathname={loaderRequest.pathname}
          variant={loaderRequest.variant}
        />
      ) : null}
      {children}
    </BrandLoaderNavigationContext.Provider>
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
        : 820;
    const exitMs =
      prefersReducedMotion ? 120 : variant === "initial" ? 720 : 420;
    const navigateMs = prefersReducedMotion
      ? 80
      : variant === "initial"
        ? 0
        : 360;

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
        <img
          alt="Natta"
          className="brand-loader__logo"
          decoding="async"
          fetchPriority="high"
          height={logo.height}
          src={logo.src}
          width={logo.width}
        />
        <p className="brand-loader__subtitle">{copy.subtitle}</p>
      </div>
    </div>
  );
}
