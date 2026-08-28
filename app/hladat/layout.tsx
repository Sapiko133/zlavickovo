import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vyhľadávanie",
  description: "Vyhľadaj aktuálne zľavové kódy, kupóny, akcie a obchody na Zlavickovo.",
  robots: { index: false, follow: true },
};

export default function HladatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
