/**
 * Variant Guard (PROJECT_VISION §8) — ochrana porovnávania ponúk pred
 * rozdielnymi baleniami a množstvami. Aj keď dva produkty zdieľajú EAN alebo
 * manufacturer+productno, ich názvy môžu jednoznačne uvádzať iné množstvo
 * (10 g vs 25 × 10 g), iný objem (250 ml vs 500 ml) alebo iný počet kusov
 * (30 kapsúl vs 120 kapsúl). Také ponuky sa NESMÚ porovnávať ako tá istá kúpa,
 * inak vznikne falošná „Najvýhodnejšia kúpa" a klamlivé „ušetríš".
 *
 * Čistý deterministický modul bez DB a env, samostatne testovateľný
 * (scripts/test-variant-guard.ts). Diakritiku a whitespace normalizuje cez
 * zdieľaný normalizeSearchText z lib/search-normalize.ts — desatinné oddeľovače
 * sú pred normalizáciou dočasne chránené, aby „0,5 kg" zostalo číselné.
 */
import { normalizeSearchText } from "../search-normalize";

/** Porovnateľná dimenzia množstva. Hodnoty sú vždy v základnej jednotke. */
export type VariantDimension = "weight" | "volume" | "count";

/**
 * Normalizovaný podpis množstva. `weight` je v gramoch, `volume` v mililitroch,
 * `count` v kusoch. `null` = daná dimenzia sa v názve nevyskytla.
 */
export interface VariantSignature {
  /** Celková hmotnosť v gramoch (mg/g/kg zjednotené). */
  weight: number | null;
  /** Celkový objem v mililitroch (ml/cl/l zjednotené). */
  volume: number | null;
  /** Celkový počet kusov/kapsúl/tabliet/sáčkov/vreciek. */
  count: number | null;
}

/**
 * Jednotky → dimenzia + prevodný faktor na základnú jednotku dimenzie.
 * Kľúče sú v tvare BEZ diakritiky (normalizeSearchText diakritiku odstráni),
 * takže slovenské aj české tvary sa zbiehajú do rovnakého kľúča:
 * „kapsúl"→kapsul, „kapslí"→kapsli, „sáčků"→sacku, „balení"→baleni.
 */
const UNITS: Record<string, { dim: VariantDimension; factor: number }> = {
  // hmotnosť → gramy
  mg: { dim: "weight", factor: 0.001 },
  g: { dim: "weight", factor: 1 },
  kg: { dim: "weight", factor: 1000 },
  // objem → mililitre
  ml: { dim: "volume", factor: 1 },
  cl: { dim: "volume", factor: 10 },
  l: { dim: "volume", factor: 1000 },
  // počet → kusy
  ks: { dim: "count", factor: 1 },
  kus: { dim: "count", factor: 1 },
  kusy: { dim: "count", factor: 1 },
  kusov: { dim: "count", factor: 1 },
  bal: { dim: "count", factor: 1 },
  balenie: { dim: "count", factor: 1 },
  baleni: { dim: "count", factor: 1 }, // CZ „balení"
  kapsula: { dim: "count", factor: 1 },
  kapsuly: { dim: "count", factor: 1 },
  kapsul: { dim: "count", factor: 1 }, // SK „kapsúl"
  kapsli: { dim: "count", factor: 1 }, // CZ „kapslí"
  tableta: { dim: "count", factor: 1 },
  tablety: { dim: "count", factor: 1 },
  tabliet: { dim: "count", factor: 1 },
  tablet: { dim: "count", factor: 1 },
  tbl: { dim: "count", factor: 1 },
  cps: { dim: "count", factor: 1 },
  sacok: { dim: "count", factor: 1 }, // SK „sáčok"
  sacky: { dim: "count", factor: 1 }, // „sáčky"
  sackov: { dim: "count", factor: 1 }, // „sáčkov"
  sacku: { dim: "count", factor: 1 }, // CZ „sáčků"
  vrecko: { dim: "count", factor: 1 },
  vrecka: { dim: "count", factor: 1 }, // „vrecká"
  vreciek: { dim: "count", factor: 1 },
};

// Jednotky zoradené od najdlhšej — v alternácii sa tak „kusov" skúsi pred „kus"
// a „ml" pred „l" (hranicu za jednotkou navyše stráži lookahead nižšie).
const UNIT_PATTERN = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join("|");

// Číslo pred jednotkou nesmie byť pokračovaním slova/kódu (nie [a-z] vľavo),
// za jednotkou nesmie nasledovať písmeno (aby „l" nechytilo „liter",
// „g" nechytilo „green"). Desatinné číslo: bodka (čiarku prevedieme vopred).
const NUMBER = "(\\d+(?:\\.\\d+)?)";
const UNIT_TAIL = `(${UNIT_PATTERN})(?![a-z])`;

// Multiplikátor „25 × 10 g" / „2 x 250 ml" / „25*10g" → count × amount.
// Uznaný IBA keď za druhým číslom nasleduje podporovaná jednotka, takže
// rozmery ako 90x200 alebo 1920x1080 (bez jednotky) sa NIKDY nezachytia.
const MULTIPLIER_RE = new RegExp(
  `(?<![a-z])(\\d+)\\s*[x×*]\\s*${NUMBER}\\s*${UNIT_TAIL}`,
  "gi"
);

// Samostatné množstvo „500 g", „250ml", „30 kapsúl", „0.5 kg".
const SINGLE_RE = new RegExp(`(?<![a-z])${NUMBER}\\s*${UNIT_TAIL}`, "gi");

/**
 * Diakriticky zložený, lowercase text s DESATINNOU bodkou. Desatinný oddeľovač
 * (čiarka aj bodka medzi číslicami) je pred normalizeSearchText chránený
 * medzibodkou „·" (tú normalizeSearchText nemení), po nej vrátený na „."
 * — inak by „0,5" skončilo ako „0 5".
 */
function normalizeVariantText(raw: string): string {
  const protectedDecimals = (raw ?? "").replace(/(\d)[.,](\d)/g, "$1·$2");
  return normalizeSearchText(protectedDecimals).replace(/·/g, ".");
}

function addTo(acc: Partial<Record<VariantDimension, number>>, dim: VariantDimension, value: number): void {
  acc[dim] = (acc[dim] ?? 0) + value;
}

/**
 * Extrahuje normalizovaný podpis množstva z názvu produktu.
 *
 * Množstvá zbierame do dvoch samostatných vedier podľa PÔVODU:
 *  - `multiplier` — súčin z multiplikátora „25 × 10 g" → 250 g. Textový rozsah,
 *    ktorý multiplikátor spotreboval (aj jeho amount „10 g"), sa zo vstupu
 *    vymaže, takže sa už nikdy nezapočíta druhýkrát ako samostatný token.
 *  - `single` — samostatný explicitný total „40 g", „500 ml", „30 kapsúl".
 *
 * KOMBINÁCIA (oprava double-count): samostatný explicitný total je záväzné
 * čisté množstvo produktu; multiplikátorový rozpis tej istej dimenzie ten istý
 * total iba ROZPISUJE — nie je to ďalšie množstvo. Preto ich NIKDY nesčítame:
 *  - „40 g (10×4 g)" → single 40, multiplier 40 → 40 (nie 80),
 *  - „100 g (25×4 g)" → 100 (nie 200),
 *  - „2×250 ml 500 ml" → 500 (nie 1000),
 *  - „25×10 g" (bez samostatného totalu) → multiplier 250.
 *
 * Samostatný total má prednosť pred multiplikátorom: keď súhlasia, výsledok je
 * ich spoločná hodnota (deduplikácia); keď si protirečia (nekonzistentný názov
 * „100 g (10×4 g)"), konzervatívne berieme headline total „100 g" a NEsčítame
 * na 140 g — inak by sme legitímnu zhodu s čistým „100 g" falošne rozbili.
 */
export function extractVariantSignature(name: string): VariantSignature {
  const text = normalizeVariantText(name);

  const multiplier: Partial<Record<VariantDimension, number>> = {};
  const remainder = text.replace(MULTIPLIER_RE, (_m, mult: string, amount: string, unit: string) => {
    const spec = UNITS[unit.toLowerCase()];
    if (spec) addTo(multiplier, spec.dim, Number(mult) * Number(amount) * spec.factor);
    return " ";
  });

  const single: Partial<Record<VariantDimension, number>> = {};
  let m: RegExpExecArray | null;
  SINGLE_RE.lastIndex = 0;
  while ((m = SINGLE_RE.exec(remainder)) !== null) {
    const spec = UNITS[m[2].toLowerCase()];
    if (spec) addTo(single, spec.dim, Number(m[1]) * spec.factor);
  }

  const sig: VariantSignature = { weight: null, volume: null, count: null };
  const dims: VariantDimension[] = ["weight", "volume", "count"];
  for (const dim of dims) {
    // Samostatný total vyhráva (deduplikuje / prebíja rozpis); inak multiplikátor.
    sig[dim] = single[dim] ?? multiplier[dim] ?? null;
  }
  return sig;
}

/** Dve hodnoty sú rovnaké v rámci malej relatívnej tolerancie (float drift). */
function valuesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * `true` iba ak obe strany majú tú istú porovnateľnú dimenziu a jej
 * normalizované celkové hodnoty sa líšia (10 g vs 250 g, 250 ml vs 500 ml,
 * 1 ks vs 2 ks). Ak dimenziu uvádza len jedna strana, nejde o potvrdený
 * konflikt a vráti sa `false` (konzervatívne — radšej neblokovať legitímnu
 * ponuku než skryť skutočnú zhodu).
 */
export function variantsConflict(a: string, b: string): boolean {
  const sa = extractVariantSignature(a);
  const sb = extractVariantSignature(b);
  const dims: VariantDimension[] = ["weight", "volume", "count"];
  for (const dim of dims) {
    const va = sa[dim];
    const vb = sb[dim];
    if (va !== null && vb !== null && !valuesEqual(va, vb)) return true;
  }
  return false;
}

/**
 * Odfiltruje z kandidátov tie, ktorých názov je v množstevnom konflikte so
 * seedom (`variantsConflict`). Seed sám sa nikdy nefiltruje. `apply=false`
 * (napr. identityLevel = name) vráti kandidátov nezmenených — pri slabej
 * identite sa Variant Guard neuplatňuje. `excludedCount` = počet odstránených
 * kandidátov (volajúci ho priráta do existujúceho excludedCount, aby UI
 * neuvádzalo nepravdivý počet porovnaných ponúk).
 */
export function filterVariantConflicts<T extends { id: number; name: string }>(
  seed: { id: number; name: string },
  candidates: T[],
  apply: boolean
): { kept: T[]; excludedCount: number } {
  if (!apply) return { kept: candidates, excludedCount: 0 };
  let excludedCount = 0;
  const kept: T[] = [];
  for (const candidate of candidates) {
    if (candidate.id !== seed.id && variantsConflict(seed.name, candidate.name)) {
      excludedCount += 1;
      continue;
    }
    kept.push(candidate);
  }
  return { kept, excludedCount };
}
