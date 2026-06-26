import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import OneSignalInit from "@/components/OneSignalInit";
import InstallBanner from "@/components/InstallBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#7C3AED",
};

export const metadata: Metadata = {
  title: {
    default: "Zlavickovo – zľavové kódy a kupóny 2026",
    template: "%s | Zlavickovo",
  },
  description: "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
  keywords: ["zlavove kody", "kupony", "zlava", "zlavickovo", "zlavovy kod", "Slovakia"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Zlavickovo",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    siteName: "Zlavickovo",
    locale: "sk_SK",
    type: "website",
  },
  metadataBase: new URL("https://zlavickovo.sk"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <OneSignalInit />
          <InstallBanner />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
