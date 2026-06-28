"use client";
import { useState } from "react";

interface Props { domain: string; name: string; size?: number }

export default function ShopFavicon({ domain, name, size = 40 }: Props) {
  const [error, setError] = useState(false);
  return error ? (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: "#22C55E", display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.4,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  ) : (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: 8, objectFit: "contain" }}
      onError={() => setError(true)}
    />
  );
}
