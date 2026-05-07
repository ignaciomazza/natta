"use client";

import { useEffect } from "react";

const getParallaxOffset = (element: HTMLElement) => {
  const speed = Number(element.dataset.parallaxSpeed ?? 0.08);
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const elementCenter = rect.top + rect.height / 2;
  const viewportCenter = viewportHeight / 2;
  const progress = (viewportCenter - elementCenter) / (viewportHeight + rect.height);

  return Math.max(-1, Math.min(1, progress)) * speed * 220;
};

export function MotionObserver() {
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    document.documentElement.classList.add("motion-ready");

    if (reduceMotion) {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((element) => element.classList.add("is-visible"));

      return;
    }

    const observed = new WeakSet<Element>();
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    const observeRevealElements = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (observed.has(element)) {
          return;
        }

        observed.add(element);
        revealObserver.observe(element);
      });
    };

    let ticking = false;

    const updateParallax = () => {
      ticking = false;

      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((element) => {
        const rect = element.getBoundingClientRect();

        if (rect.bottom < -120 || rect.top > window.innerHeight + 120) {
          return;
        }

        element.style.setProperty(
          "--parallax-y",
          `${getParallaxOffset(element).toFixed(2)}px`,
        );
      });
    };

    const requestParallaxUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateParallax);
    };

    observeRevealElements();
    requestParallaxUpdate();

    const mutationObserver = new MutationObserver(() => {
      observeRevealElements();
      requestParallaxUpdate();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestParallaxUpdate);

    return () => {
      mutationObserver.disconnect();
      revealObserver.disconnect();
      window.removeEventListener("scroll", requestParallaxUpdate);
      window.removeEventListener("resize", requestParallaxUpdate);
    };
  }, []);

  return null;
}
