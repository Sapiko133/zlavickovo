import type { Metadata } from "next";
import SearchPageClient from "./SearchPageClient";

// Výsledky vyhľadávania sú thin/duplicitný obsah → noindex (C1). follow ponechá
// tok link equity na obchody/kupóny. Kanonická je základná /hladat bez query.
export const metadata: Metadata = {
  title: "Vyhľadávanie obchodov a kupónov · Zlavickovo",
  description: "Vyhľadaj obchod, zľavu alebo zľavový kód na Zlavickovo.sk.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.zlavickovo.sk/hladat" },
};

export default function SearchPage() {
  return <SearchPageClient />;
}
