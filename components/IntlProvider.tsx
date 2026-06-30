"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import skMessages from "@/messages/sk.json";
import csMessages from "@/messages/cs.json";
import enMessages from "@/messages/en.json";

type Locale = "sk" | "cs" | "en";
const msgMap: Record<Locale, typeof skMessages> = { sk: skMessages, cs: csMessages, en: enMessages };

function getCookieLocale(): Locale {
  if (typeof document === "undefined") return "sk";
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const val = match?.[1];
  return (val === "cs" || val === "en" ? val : "sk") as Locale;
}

export default function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("sk");

  useEffect(() => {
    setLocale(getCookieLocale());
  }, []);

  return (
    <NextIntlClientProvider messages={msgMap[locale]} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
