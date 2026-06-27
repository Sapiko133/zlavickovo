"use client";

import { useState } from "react";
import { getShopDomain } from "@/lib/shop-domains";

export default function ShopLogo({
  name,
  size = 40,
  radius = 10,
  color,
  className,
}: {
  name: string;
  size?: number;
  radius?: number;
  color: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const domain = getShopDomain(name);
  const fontSize = Math.round(size * 0.38);

  if (domain && !failed) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, borderRadius: radius, flexShrink: 0,
          background: "#fff", border: "1.5px solid #e8e8e8",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={name}
          width={Math.round(size * 0.68)}
          height={Math.round(size * 0.68)}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 3px 10px ${color}44`,
      }}
    >
      <span style={{ color: "#fff", fontWeight: 900, fontSize, lineHeight: 1 }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
