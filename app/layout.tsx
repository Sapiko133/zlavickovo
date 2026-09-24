import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import OneSignalInit from "@/components/OneSignalInit";
import IntlProvider from "@/components/IntlProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#22C55E" };

export const metadata: Metadata = {
  title: {
    default: "Zlavickovo – akcie, výpredaje a zľavové kupóny",
    template: "%s | Zlavickovo",
  },
  description:
    "Aktuálne akcie, výpredaje, kupóny a zľavové kódy slovenských obchodov pravidelne aktualizované na jednom mieste.",
  applicationName: "Zlavickovo",
  creator: "Zlavickovo",
  publisher: "Zlavickovo",
  category: "shopping",
  openGraph: {
    title: "Zlavickovo – akcie, výpredaje a zľavové kupóny",
    description:
      "Aktuálne akcie, výpredaje a zľavové kupóny slovenských obchodov na jednom mieste.",
    url: "https://www.zlavickovo.sk",
    siteName: "Zlavickovo",
    locale: "sk_SK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo – akcie, výpredaje a zľavové kupóny",
    description:
      "Aktuálne akcie, výpredaje a zľavové kupóny slovenských obchodov na jednom mieste.",
  },
  // Žiadny root canonical — každá stránka deklaruje vlastný self-canonical.
  // (Zdedený canonical na homepage by z každej stránky bez vlastného canonical
  // urobil duplikát homepage — napr. 404 stránky.)
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
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
