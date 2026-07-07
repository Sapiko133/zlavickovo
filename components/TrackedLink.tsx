"use client";

import React from "react";
import { trackClick } from "@/lib/track-click";
import type { ClickType } from "@/lib/click-types";

/**
 * Outbound `<a>` odkaz, ktorý pri kliknutí odošle tracking event a inak sa
 * správa presne ako natívny odkaz (žiadna zmena UI/správania, žiadny redesign).
 * Určené pre server-rendered stránky (produkt, homepage, akcie, shop CTA), kde
 * nie je vlastný onClick handler.
 */
type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  type: ClickType;
  shopSlug?: string | null;
  productSlug?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  destinationDomain?: string | null;
  query?: string | null;
  source?: string;
};

export default function TrackedLink({
  type,
  shopSlug,
  productSlug,
  couponId,
  couponCode,
  destinationDomain,
  query,
  source,
  onClick,
  href,
  children,
  ...rest
}: Props) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackClick({
      type,
      source,
      shopSlug,
      productSlug,
      couponId,
      couponCode,
      destination: typeof href === "string" ? href : null,
      destinationDomain,
      query,
    });
    onClick?.(e);
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
