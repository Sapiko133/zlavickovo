"use client";
import { useState } from "react";
import Image from "next/image";

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#22C55E","#D32F2F","#FF4081","#006A35","#003580"];

function colorFor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

interface Props { domain: string; name: string; size?: number }

export default function ShopFavicon({ domain, name, size = 40 }: Props) {
  const [error, setError] = useState(!domain);

  if (error) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: colorFor(name || "?"), display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.42),
      }}>
        {(name || "?").charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      alt={name}
      width={size}
      height={size}
      unoptimized
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 8, objectFit: "contain", flexShrink: 0 }}
      onError={() => setError(true)}
    />
  );
}
