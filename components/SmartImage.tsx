"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Obrázok s fallbackom: keď `src` chýba alebo sa nepodarí načítať (404/503/timeout),
 * vykreslí `fallback` (napr. gradient + favicon obchodu). Používame na kartách akcií,
 * aby rozbitý banner nikdy neukázal ikonu „rozbitého obrázka".
 */
export default function SmartImage({
  src,
  alt,
  style,
  fallback,
  wrapperClassName,
  priority = false,
}: {
  src?: string;
  alt: string;
  style?: CSSProperties;
  fallback: ReactNode;
  /** Ak je zadané, úspešný <img> sa obalí do <div class=…> (napr. aspect-ratio rám). */
  wrapperClassName?: string;
  /** Nad-preload obrázka (eager namiesto lazy) — pre hero/above-the-fold karty. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      style={style}
      onError={() => setFailed(true)}
    />
  );
  return wrapperClassName ? <div className={wrapperClassName}>{img}</div> : img;
}
