"use client";

import { useState } from "react";
import { getShopDomain } from "@/lib/shop-domains";

const FALLBACK_COLORS = [
  "#E8001D", "#0065BD", "#00A551", "#FF6900",
  "#7C3AED", "#D32F2F", "#FF4081", "#0ea5e9",
  "#16a34a", "#8B1A1A", "#f59e0b", "#db2777",
];

const SIZE_PRESETS = { sm: 32, md: 48, lg: 64 } as const;

function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

export default function ShopLogo({
  name,
  domain: domainProp,
  size: sizeProp = 40,
  radius: radiusProp,
  color: colorProp,
  className,
}: {
  name: string;
  domain?: string;
  size?: number | "sm" | "md" | "lg";
  radius?: number;
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const size = typeof sizeProp === "string" ? SIZE_PRESETS[sizeProp] : sizeProp;
  const radius = radiusProp ?? Math.round(size * 0.24);
  const domain = domainProp || getShopDomain(name);
  const color = colorProp ?? colorFromName(name);
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
          width={Math.round(size * 0.7)}
          height={Math.round(size * 0.7)}
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
      <span style={{ color: "#fff", fontWeight: 900, fontSize, lineHeight: 1, userSelect: "none" }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
