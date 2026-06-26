import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import OneSignalInit from "@/components/OneSignalInit";
import InstallBanner from "@/components/InstallBanner";
import skMessages from "@/messages/sk.json";
import csMessages from "@/messages/cs.json";
import enMessages from "@/messages/en.json";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const MESSAGES = { sk: skMessages, cs: csMessages, en: enMessages } as const;
type Locale = keyof typeof MESSAGES;
const SUPPORTED: Locale[] = ["sk", "cs", "en"];

export const viewport: Viewport = { themeColor: "#7C3AED" };

export const metadata: Metadata = {
  title: {
    default: "Zlavickovo – zľavové kódy a kupóny 2026",
    template: "%s | Zlavickovo",
  },
  description: "Nájdi aktuálne zľavové kódy a kupóny pre stovky slovenských obchodov. AI vyhľadávanie kupónov zadarmo.",
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "sk";
  const locale: Locale = SUPPORTED.includes(raw as Locale) ? (raw as Locale) : "sk";
  const messages = MESSAGES[locale];

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <OneSignalInit />
            <InstallBanner />
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
