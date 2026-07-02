import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vyhľadávanie",
  description: "Vyhľadaj zľavové kódy, kupóny, obchody a produkty na Zlavickovo.",
  alternates: { canonical: "https://www.zlavickovo.sk/hladat" },
};

export default function HladatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
