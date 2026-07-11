export type SupportedCurrency = "EUR" | "CZK";

export type ProductPrice = {
  amount: number;
  currency: SupportedCurrency;
};

export type FormattedProductPrices = {
  primary: string;
  secondary: string | null;
  primaryCurrency: SupportedCurrency;
  secondaryCurrency: SupportedCurrency | null;
};

const CURRENCY_BY_CONFIGURED_DOMAIN: Record<string, SupportedCurrency> = {
  "kojenecke-obleceni.eu": "CZK",
};

let warnedMissingRate = false;

// Kurz iba z EUR_TO_CZK_RATE — bez tichého fallbacku. Chýbajúci/neplatný kurz
// znamená, že sekundárna (orientačná) cena sa nezobrazí; primárna cena zostáva.
export function getEurToCzkRate(): number | null {
  const raw = process.env.EUR_TO_CZK_RATE;
  const parsed = raw ? Number.parseFloat(raw.replace(",", ".")) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (!warnedMissingRate) {
    warnedMissingRate = true;
    console.warn(
      `[price] EUR_TO_CZK_RATE ${raw ? `je neplatný ("${raw}")` : "nie je nastavený"} — sekundárna cena sa nezobrazí.`
    );
  }
  return null;
}

export function normalizeCurrencyCode(value?: string | null): SupportedCurrency | null {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "EUR" || normalized === "EURO" || normalized === "€") return "EUR";
  if (normalized === "CZK" || normalized === "KČ" || normalized === "KC" || normalized === "KORUNA") return "CZK";
  return null;
}

export function detectCurrencyFromPriceText(price?: string | number | null): SupportedCurrency | null {
  if (price === null || price === undefined || typeof price === "number") return null;
  const text = String(price).toUpperCase();
  if (/(^|[^A-Z])EUR([^A-Z]|$)|€/.test(text)) return "EUR";
  if (/(^|[^A-Z])CZK([^A-Z]|$)|KČ|KC/.test(text)) return "CZK";
  return null;
}

export function inferCurrencyCodeForConfiguredFeed(domain?: string | null): SupportedCurrency | null {
  const d = (domain ?? "").trim().toLowerCase();
  if (!d) return null;
  if (CURRENCY_BY_CONFIGURED_DOMAIN[d]) return CURRENCY_BY_CONFIGURED_DOMAIN[d];
  if (/\.cz$/i.test(d)) return "CZK";
  if (/\.sk$/i.test(d)) return "EUR";
  return null;
}

/** Iba explicitne nakonfigurované domény (CURRENCY_BY_CONFIGURED_DOMAIN) — bez TLD heuristiky. */
export function currencyForConfiguredDomain(domain?: string | null): SupportedCurrency | null {
  const d = (domain ?? "").trim().toLowerCase();
  return d ? CURRENCY_BY_CONFIGURED_DOMAIN[d] ?? null : null;
}

/**
 * Mena produktu vrátane TLD heuristiky (.cz → CZK, .sk → EUR) ako posledného
 * fallbacku. TLD odhad je vhodný na FORMÁTOVANIE ceny, ale nie na tvrdenie
 * „najnižšia cena" naprieč menami — na to použi resolveTrustedProductCurrency.
 * (Odstránenie TLD fallbacku = samostatná Fáza 3.)
 */
export function resolveProductCurrency(
  price?: string | number | null,
  explicitCurrency?: string | null,
  configuredDomain?: string | null
): SupportedCurrency | null {
  return (
    normalizeCurrencyCode(explicitCurrency) ??
    detectCurrencyFromPriceText(price) ??
    inferCurrencyCodeForConfiguredFeed(configuredDomain)
  );
}

/**
 * Dôveryhodná mena pre cenové porovnania (badge „NAJNIŽŠIA CENA"): explicitný
 * currency_code → mena v texte ceny → explicitne nakonfigurovaný feed.
 * ŽIADNY všeobecný TLD fallback — mena odhadnutá len z .sk/.cz domény nesmie
 * rozhodovať o cross-currency porovnaní.
 */
export function resolveTrustedProductCurrency(
  price?: string | number | null,
  explicitCurrency?: string | null,
  configuredDomain?: string | null
): SupportedCurrency | null {
  return (
    normalizeCurrencyCode(explicitCurrency) ??
    detectCurrencyFromPriceText(price) ??
    currencyForConfiguredDomain(configuredDomain)
  );
}

export function parsePriceValue(price?: string | number | null): number | null {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price === "number") return Number.isFinite(price) && price > 0 ? price : null;

  const text = String(price);
  const firstDigit = text.search(/\d/);
  if (firstDigit === -1) return null;
  // M\u00ednus pred prvou \u010d\u00edslicou = z\u00e1porn\u00e1 cena \u2192 neplatn\u00e1. Poml\u010dka za \u010d\u00edslom
  // ("199,-" ako cel\u00e9 koruny) platn\u00e1 zost\u00e1va.
  if (text.slice(0, firstDigit).includes("-")) return null;

  const compact = text
    .replace(/\s|\u00a0/g, "")
    .replace(/[^\d.,]/g, "");
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const separator = lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";
  const separatorCount = (compact.match(/[.,]/g) ?? []).length;

  let normalized: string;
  if (!separator) {
    normalized = compact;
  } else if (separatorCount === 1) {
    const decimals = compact.length - compact.lastIndexOf(separator) - 1;
    normalized = decimals === 3 ? compact.replace(/[.,]/g, "") : compact.replace(separator, ".");
  } else {
    const thousandsSeparator = separator === "," ? "." : ",";
    normalized = compact.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "").replace(separator, ".");
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseProductPrice(
  price?: string | number | null,
  currency?: string | null,
  configuredDomain?: string | null
): ProductPrice | null {
  const amount = parsePriceValue(price);
  const resolvedCurrency = resolveProductCurrency(price, currency, configuredDomain);
  if (amount === null || !resolvedCurrency) return null;
  return { amount, currency: resolvedCurrency };
}

export function convertEurToCzk(priceEur: number, eurToCzkRate: number | null = getEurToCzkRate()): number | null {
  if (!Number.isFinite(priceEur) || eurToCzkRate === null || !Number.isFinite(eurToCzkRate) || eurToCzkRate <= 0) return null;
  return priceEur * eurToCzkRate;
}

export function convertCzkToEur(priceCzk: number, eurToCzkRate: number | null = getEurToCzkRate()): number | null {
  if (!Number.isFinite(priceCzk) || eurToCzkRate === null || !Number.isFinite(eurToCzkRate) || eurToCzkRate <= 0) return null;
  return priceCzk / eurToCzkRate;
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCzk(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Preferovaná mena ZOBRAZENIA podľa domény obchodu: .cz → CZK, .sk → EUR,
 * ostatné domény → pôvodná mena produktu. Čisto vizuálne pravidlo (ktorá cena
 * je veľká/primárna) — nemení uloženú cenu, currency_code, porovnávanie mien
 * pre ranking ani badge „NAJNIŽŠIA CENA".
 */
export function getPreferredDisplayCurrency(
  domain: string | null | undefined,
  originalCurrency: SupportedCurrency
): SupportedCurrency {
  const d = (domain ?? "").trim().toLowerCase();
  if (d.endsWith(".cz")) return "CZK";
  if (d.endsWith(".sk")) return "EUR";
  return originalCurrency;
}

/**
 * Primárna + sekundárna cena na zobrazenie. displayCurrency (default = mena
 * produktu) určuje, ktorá mena je primárna. Ak sa líši od meny produktu,
 * primárnou je PREPOČET — označený „≈", lebo skutočná uložená cena je tá
 * sekundárna. Bez kurzu sa prepočet nevymýšľa: zobrazí sa iba pôvodná cena
 * v pôvodnej mene.
 */
export function getFormattedProductPrices(
  amount: number,
  currency: SupportedCurrency,
  eurToCzkRate: number | null = getEurToCzkRate(),
  displayCurrency: SupportedCurrency = currency
): FormattedProductPrices | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const otherCurrency: SupportedCurrency = currency === "EUR" ? "CZK" : "EUR";
  const converted =
    currency === "EUR" ? convertEurToCzk(amount, eurToCzkRate) : convertCzkToEur(amount, eurToCzkRate);

  if (displayCurrency !== currency && converted !== null) {
    return {
      primary: `≈ ${formatAmount(converted, otherCurrency)}`,
      secondary: formatAmount(amount, currency),
      primaryCurrency: otherCurrency,
      secondaryCurrency: currency,
    };
  }

  return {
    primary: formatAmount(amount, currency),
    secondary: converted === null ? null : `≈ ${formatAmount(converted, otherCurrency)}`,
    primaryCurrency: currency,
    secondaryCurrency: converted === null ? null : otherCurrency,
  };
}

export function getFormattedProductPricesFromRaw(
  price?: string | number | null,
  currency?: string | null,
  configuredDomain?: string | null,
  eurToCzkRate: number | null = getEurToCzkRate()
): FormattedProductPrices | null {
  const parsed = parseProductPrice(price, currency, configuredDomain);
  if (!parsed) return null;
  return getFormattedProductPrices(
    parsed.amount,
    parsed.currency,
    eurToCzkRate,
    getPreferredDisplayCurrency(configuredDomain, parsed.currency)
  );
}

export function formatPricePrimary(
  price?: string | number | null,
  currency?: string | null,
  configuredDomain?: string | null
): string {
  return getFormattedProductPricesFromRaw(price, currency, configuredDomain)?.primary ?? "";
}

export function formatAmount(amount: number, currency: SupportedCurrency): string {
  return currency === "CZK" ? formatCzk(amount) : formatEur(amount);
}

export type LowestPriceInput = {
  priceNum: number | null;
  /** Dôveryhodná mena (resolveTrustedProductCurrency); null = mena neznáma. */
  currency: SupportedCurrency | null;
};

/**
 * Indexy ponúk, ktoré smú dostať badge „NAJNIŽŠIA CENA". Rovnaká normalizácia
 * ako pickBestPurchase (Fáza 1): EUR a CZK sa NIKDY neporovnávajú ako surové
 * čísla. Prázdna množina = porovnanie nie je dôveryhodné a badge sa nezobrazí:
 * - menej než 2 ponuky s platnou cenou (niet čo porovnávať),
 * - ľubovoľná ponuka s cenou má neznámu menu (nevieme porovnať všetky),
 * - mix EUR/CZK bez dostupného kurzu.
 */
export function findLowestPriceIndexes(
  items: LowestPriceInput[],
  eurToCzkRate: number | null = getEurToCzkRate()
): Set<number> {
  const priced = items
    .map((item, index) => ({ ...item, index }))
    .filter((item): item is { priceNum: number; currency: SupportedCurrency | null; index: number } =>
      item.priceNum !== null && Number.isFinite(item.priceNum) && item.priceNum > 0
    );

  if (priced.length < 2) return new Set();
  if (priced.some((item) => item.currency === null)) return new Set();

  const currencies = new Set(priced.map((item) => item.currency));
  let comparable: (value: { priceNum: number; currency: SupportedCurrency | null }) => number | null;
  if (currencies.size <= 1) {
    comparable = (item) => item.priceNum;
  } else {
    if (eurToCzkRate === null || !Number.isFinite(eurToCzkRate) || eurToCzkRate <= 0) return new Set();
    comparable = (item) =>
      item.currency === "EUR" ? item.priceNum : convertCzkToEur(item.priceNum, eurToCzkRate);
  }

  let min = Infinity;
  const values = priced.map((item) => {
    const value = comparable(item);
    if (value !== null && value < min) min = value;
    return value;
  });
  if (!Number.isFinite(min)) return new Set();

  const EPSILON = 1e-6;
  const lowest = new Set<number>();
  values.forEach((value, i) => {
    if (value !== null && Math.abs(value - min) < EPSILON) lowest.add(priced[i].index);
  });
  return lowest;
}
