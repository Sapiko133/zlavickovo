import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import Script from "next/script";
import OneSignalInit from "@/components/OneSignalInit";
import InstallBanner from "@/components/InstallBanner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SUPPORTED = ["sk", "cs", "en"] as const;
type Locale = typeof SUPPORTED[number];

export const viewport: Viewport = { themeColor: "#7C3AED" };

export const metadata: Metadata = {
  title: {
    default: "Zlavickovo – zľavové kódy a kupóny 2026",
    template: "%s | Zlavickovo",
  },
  description:
    "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
  keywords: ["zlavove kody", "kupony", "zlava", "zlavickovo", "zlavovy kod", "Slovakia"],
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Zlavickovo", statusBarStyle: "default" },
  icons: { apple: [{ url: "/icon-192.png", sizes: "192x192" }] },
  openGraph: { siteName: "Zlavickovo", locale: "sk_SK", type: "website" },
  alternates: {
    canonical: "https://zlavickovo.sk",
    languages: {
      sk: "https://zlavickovo.sk",
      cs: "https://zlavickovo.sk",
      "x-default": "https://zlavickovo.sk",
    },
  },
  metadataBase: new URL("https://zlavickovo.sk"),
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "sk";
  const locale: Locale = (SUPPORTED as readonly string[]).includes(raw)
    ? (raw as Locale)
    : "sk";
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <OneSignalInit />
          <InstallBanner />
          {children}
        </NextIntlClientProvider>

        <Script
          async
          src="//serve.affiliate.heurekashopping.sk/js/trixam.min.js"
          strategy="lazyOnload"
        />

        <Script
          async
          src="https://cse.google.com/cse.js?cx=5195c8422613748fc"
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