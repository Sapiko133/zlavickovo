import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import OneSignalInit from "@/components/OneSignalInit";
import IntlProvider from "@/components/IntlProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#7C3AED" };

export const metadata: Metadata = {
  title: {
    default: "Zlavickovo – zľavové kódy a kupóny 2026",
    template: "%s | Zlavickovo",
  },
  description:
    "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
  keywords: ["zlavove kody", "kupony", "zlava", "zlavickovo", "zlavovy kod", "Slovakia"],
  openGraph: {
    title: "Zlavickovo – zľavové kódy a kupóny 2026",
    description:
      "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
    url: "https://www.zlavickovo.sk",
    siteName: "Zlavickovo",
    locale: "sk_SK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo – zľavové kódy a kupóny 2026",
    description:
      "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
  },
  alternates: {
    canonical: "https://www.zlavickovo.sk",
    languages: {
      sk: "https://www.zlavickovo.sk",
      cs: "https://www.zlavickovo.sk",
      "x-default": "https://www.zlavickovo.sk",
    },
  },
  metadataBase: new URL("https://www.zlavickovo.sk"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="sk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <IntlProvider>
          <OneSignalInit />
          {children}
        </IntlProvider>

        <Script
          src="//serve.affiliate.heurekashopping.sk/js/trixam.min.js"
          strategy="lazyOnload"
        />

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DX0G5PZ4P7"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DX0G5PZ4P7');
          `}
        </Script>
      </body>
    </html>
  );
}
