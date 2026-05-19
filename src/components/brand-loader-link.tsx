"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { useBrandLoaderNavigation } from "@/components/brand-loader";
import {
  BRAND_LOADER_NAVIGATE_EVENT,
  type BrandLoaderNavigateDetail,
} from "@/lib/brand-loader-navigation";

type BrandLoaderLinkProps = ComponentProps<typeof Link> & {
  href: string;
};

const isPlainLeftClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export function BrandLoaderLink({
  href,
  onClick,
  replace,
  target,
  ...props
}: BrandLoaderLinkProps) {
  const router = useRouter();
  const navigateWithLoader = useBrandLoaderNavigation();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (event.defaultPrevented || !isPlainLeftClick(event) || target) {
      return;
    }

    const url = new URL(href, window.location.href);

    if (url.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();

    const destination = `${url.pathname}${url.search}${url.hash}`;
    const handledByContext = navigateWithLoader?.(destination);

    if (handledByContext) {
      return;
    }

    const handledByLoader = window.__nattaNavigateWithLoader?.(destination);

    if (handledByLoader) {
      return;
    }

    const loaderEvent = new CustomEvent<BrandLoaderNavigateDetail>(
      BRAND_LOADER_NAVIGATE_EVENT,
      {
        cancelable: true,
        detail: {
          href: destination,
        },
      },
    );
    const handledByLoaderEvent = !window.dispatchEvent(loaderEvent);

    if (!handledByLoaderEvent) {
      if (replace) {
        router.replace(destination);
      } else {
        router.push(destination);
      }
    }
  };

  return (
    <Link
      data-brand-loader-link="true"
      href={href}
      onClick={handleClick}
      replace={replace}
      target={target}
      {...props}
    />
  );
}
