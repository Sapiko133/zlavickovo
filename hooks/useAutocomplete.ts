"use client";

import { useState, useEffect } from "react";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";

export interface Suggestion {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

const CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

const TOP_SHOPS: Suggestion[] = [
  { name: "Alza",        slug: "alza",        category: "Elektronika", domain: "alza.sk" },
  { name: "Mall",        slug: "mall",        category: "Elektronika", domain: "mall.sk" },
  { name: "Datart",      slug: "datart",      category: "Elektronika", domain: "datart.sk" },
  { name: "NAY",         slug: "nay",         category: "Elektronika", domain: "nay.sk" },
  { name: "Samsung",     slug: "samsung",     category: "Elektronika", domain: "samsung.com" },
  { name: "Okay.sk",     slug: "okay",        category: "Elektronika", domain: "okay.sk" },
  { name: "Lenovo",      slug: "lenovo",      category: "Elektronika", domain: "lenovo.com" },
  { name: "Zalando",     slug: "zalando",     category: "Móda",        domain: "zalando.sk" },
  { name: "Shein",       slug: "shein",       category: "Móda",        domain: "shein.com" },
  { name: "ASOS",        slug: "asos",        category: "Móda",        domain: "asos.com" },
  { name: "About You",   slug: "about-you",   category: "Móda",        domain: "aboutyou.sk" },
  { name: "Answear",     slug: "answear",     category: "Móda",        domain: "answear.sk" },
  { name: "Zara",        slug: "zara",        category: "Móda",        domain: "zara.com" },
  { name: "H&M",         slug: "hm",          category: "Móda",        domain: "hm.com" },
  { name: "Dedoles",     slug: "dedoles",     category: "Móda",        domain: "dedoles.sk" },
  { name: "ZOOT",        slug: "zoot",        category: "Móda",        domain: "zoot.sk" },
  { name: "eobuv.sk",   slug: "eobuv",       category: "Móda",        domain: "eobuv.sk" },
  { name: "Notino",      slug: "notino",      category: "Krása",       domain: "notino.sk" },
  { name: "GymBeam",     slug: "gymbeam",     category: "Zdravie",     domain: "gymbeam.sk" },
  { name: "Dr. Max",     slug: "dr-max",      category: "Zdravie",     domain: "drmax.sk" },
  { name: "Herbatica",   slug: "herbatica",   category: "Zdravie",     domain: "herbatica.sk" },
  { name: "Sportisimo",  slug: "sportisimo",  category: "Šport",       domain: "sportisimo.sk" },
  { name: "Decathlon",   slug: "decathlon",   category: "Šport",       domain: "decathlon.sk" },
  { name: "Nike",        slug: "nike",        category: "Šport",       domain: "nike.com" },
  { name: "Adidas",      slug: "adidas",      category: "Šport",       domain: "adidas.com" },
  { name: "IKEA",        slug: "ikea",        category: "Bývanie",     domain: "ikea.com" },
  { name: "4Home",       slug: "4home",       category: "Bývanie",     domain: "4home.sk" },
  { name: "Martinus",    slug: "martinus",    category: "Knihy",       domain: "martinus.sk" },
  { name: "Panta Rhei",  slug: "panta-rhei",  category: "Knihy",       domain: "pantarhei.sk" },
  { name: "Booking.com", slug: "booking-com", category: "Cestovanie",  domain: "booking.com" },
  { name: "Airbnb",      slug: "airbnb",      category: "Cestovanie",  domain: "airbnb.com" },
  { name: "Invia",       slug: "invia",       category: "Cestovanie",  domain: "invia.sk" },
  { name: "Lidl",        slug: "lidl",        category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",    slug: "kaufland",    category: "Potraviny",   domain: "kaufland.sk" },
  { name: "Tesco",       slug: "tesco",       category: "Potraviny",   domain: "tesco.sk" },
  { name: "Billa",       slug: "billa",       category: "Potraviny",   domain: "billa.sk" },
  { name: "Temu",        slug: "temu",        category: "Iné",         domain: "temu.com" },
];

export const PRODUCT_SUGGESTIONS: Suggestion[] = [
  { name: "iPhone",         slug: "", category: "Elektronika", domain: "" },
  { name: "Samsung Galaxy", slug: "", category: "Elektronika", domain: "" },
  { name: "Notebook",       slug: "", category: "Elektronika", domain: "" },
  { name: "PlayStation 5",  slug: "", category: "Elektronika", domain: "" },
  { name: "Chladnička",     slug: "", category: "Spotrebiče",  domain: "" },
  { name: "Práčka",         slug: "", category: "Spotrebiče",  domain: "" },
  { name: "Nike tenisky",   slug: "", category: "Šport",       domain: "" },
  { name: "Parfum",         slug: "", category: "Krása",       domain: "" },
  { name: "Proteín",        slug: "", category: "Zdravie",     domain: "" },
  { name: "Adidas",         slug: "", category: "Šport",       domain: "" },
  { name: "Tablet",         slug: "", category: "Elektronika", domain: "" },
  { name: "Xbox",           slug: "", category: "Elektronika", domain: "" },
];

// Module-level cache — shared across all hook instances, survives re-renders
let _cache: Suggestion[] | null = null;
let _fetchPromise: Promise<void> | null = null;

function buildAffialSuggestions(): Suggestion[] {
  return AFFIAL_SHOPS.map(s => ({
    name: s.name,
    slug: s.domain.replace(/\.(sk|cz|eu|com)$/, "").replace(/\./g, "-"),
    category: CAT_LABELS[s.category] ?? "Iné",
    domain: s.domain,
  }));
}

const AFFIAL_ENTRIES = buildAffialSuggestions();

function mergeUnique(base: Suggestion[], extra: Suggestion[]): Suggestion[] {
  const seen = new Set(base.map(s => s.slug.toLowerCase()));
  return [...base, ...extra.filter(s => s.slug && !seen.has(s.slug.toLowerCase()))];
}

function filterSuggestions(list: Suggestion[], query: string, max = 8): Suggestion[] {
  const lq = query.toLowerCase();
  const matches = list.filter(s => s.name.toLowerCase().includes(lq));
  matches.sort((a, b) => {
    const aP = a.name.toLowerCase().startsWith(lq) ? 0 : 1;
    const bP = b.name.toLowerCase().startsWith(lq) ? 0 : 1;
    return aP - bP;
  });
  return matches.slice(0, max);
}

export function useAutocomplete(query: string, mode: "shop" | "product" = "shop"): Suggestion[] {
  const [dynamic, setDynamic] = useState<Suggestion[]>(_cache ?? []);

  useEffect(() => {
    if (_cache !== null) {
      setDynamic(_cache);
      return;
    }
    if (!_fetchPromise) {
      _fetchPromise = fetch("/api/autocomplete")
        .then(r => r.json())
        .then((d: Suggestion[]) => { _cache = Array.isArray(d) ? d : []; })
        .catch(() => { _cache = []; });
    }
    _fetchPromise.then(() => {
      if (_cache) setDynamic(_cache);
    });
  }, []);

  if (mode === "product") {
    if (query.length < 1) return PRODUCT_SUGGESTIONS.slice(0, 8);
    return filterSuggestions(PRODUCT_SUGGESTIONS, query);
  }

  if (query.length < 1) return [];
  const all = mergeUnique(TOP_SHOPS, mergeUnique(AFFIAL_ENTRIES, dynamic));
  return filterSuggestions(all, query);
}
