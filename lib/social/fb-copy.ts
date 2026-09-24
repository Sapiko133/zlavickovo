/**
 * Facebook copywriting bez AI — deterministický template engine.
 *
 * Text sa skladá z HOOK + TELO (reálny titulok akcie) + voliteľné riadky
 * (zľava, platnosť) + CTA + hashtagy. Každá časť má viac variantov a varianty
 * sa vyberajú deterministicky (seed = ponuka + deň), s cooldownom na nedávno
 * použité hooky. Text sa generuje VÝHRADNE z údajov feedu — žiadne vymyslené
 * vlastnosti produktu, žiadne tvrdenie, že zľava "určite funguje".
 */
import { fnv1a } from "@/lib/kv";

export interface PostData {
  shopName: string;
  /** Reálny titulok akcie z feedu. */
  title: string;
  discountPct: number | null;
  validTo: string | null;
  categoryId: string | null;
  /** Kedy sa akcia objavila (publikácia článku). */
  firstSeenAt: string | null;
  link: string;
}

export interface BuiltPost {
  templateId: string;
  hookId: string;
  text: string;
  textHash: string;
}

interface Ctx extends PostData {
  now: number;
  daysLeft: number | null;
  ageDays: number | null;
  weekday: number;
}

interface Variant {
  id: string;
  when?: (c: Ctx) => boolean;
  render: (c: Ctx) => string;
}

const CATEGORY_PHRASE: Record<string, string> = {
  elektronika: "elektroniku",
  moda: "oblečenie alebo topánky",
  zdravie: "niečo pre zdravie",
  krasa: "kozmetiku",
  sport: "športové vybavenie",
  byvanie: "niečo do domácnosti",
  potraviny: "potraviny",
  deti: "niečo pre deti",
  cestovanie: "dovolenku alebo cestovanie",
  knihy: "knihy",
};

const CATEGORY_TAG: Record<string, string> = {
  elektronika: "#elektronika",
  moda: "#moda",
  zdravie: "#zdravie",
  krasa: "#kozmetika",
  sport: "#sport",
  byvanie: "#domacnost",
  potraviny: "#potraviny",
  deti: "#deti",
  cestovanie: "#cestovanie",
  knihy: "#knihy",
};

const pct = (c: Ctx) => c.discountPct != null && c.discountPct >= 5;
const FREE_SHIPPING = /doprav[auy]?\s+(zadarmo|zdarma)|poštovné\s+(zadarmo|zdarma)/i;

export const HOOKS: Variant[] = [
  { id: "fire", render: (c) => `🔥 Dnes stojí za pozornosť: ${c.shopName}` },
  { id: "cheaper", when: pct, render: (c) => `💸 Aktuálne lacnejšie v obchode ${c.shopName}` },
  { id: "eyes", render: (c) => `👀 Jedna zo zaujímavejších dnešných ponúk – ${c.shopName}` },
  { id: "cart", when: (c) => Boolean(c.categoryId && CATEGORY_PHRASE[c.categoryId]), render: (c) => `🛒 Ak práve hľadáš ${CATEGORY_PHRASE[c.categoryId!]}, pozri sa na ${c.shopName}` },
  { id: "pct", when: pct, render: (c) => `📉 ${c.shopName}: zľava až −${c.discountPct} %` },
  { id: "tip", render: (c) => `💡 Dnešný tip zo Zlavickovo: ${c.shopName}` },
  { id: "new", when: (c) => c.ageDays != null && c.ageDays <= 3, render: (c) => `🆕 Nová akcia v obchode ${c.shopName}` },
  { id: "lastdays", when: (c) => c.daysLeft != null && c.daysLeft >= 0 && c.daysLeft <= 3, render: (c) => `⏰ Posledné dni akcie v obchode ${c.shopName}` },
  { id: "bag", render: (c) => `🛍️ ${c.shopName} má práve akciu` },
  { id: "save", render: (c) => `✅ Kto plánuje nákup v ${c.shopName}, môže ušetriť` },
  { id: "picked", render: (c) => `📌 Z dnešných akcií vyberáme ${c.shopName}` },
  { id: "weekend", when: (c) => c.weekday === 5 || c.weekday === 6 || c.weekday === 0, render: (c) => `🎉 Víkendová ponuka: ${c.shopName}` },
  { id: "shipping", when: (c) => FREE_SHIPPING.test(c.title), render: (c) => `📦 ${c.shopName}: pozor na dopravu zadarmo` },
];

const BODIES: Variant[] = [
  { id: "plain", render: (c) => c.title },
  { id: "quote", render: (c) => `„${c.title}“` },
  { id: "arrow", render: (c) => `➡️ ${c.title}` },
  { id: "what", render: (c) => `O čo ide: ${c.title}` },
];

const CTAS: Variant[] = [
  { id: "more", render: (c) => `👉 Viac info a odkaz do obchodu: ${c.link}` },
  { id: "here", render: (c) => `🔗 Pozri ponuku tu: ${c.link}` },
  { id: "detail", render: (c) => `➡️ Detail akcie: ${c.link}` },
  { id: "shop", when: pct, render: (c) => `🛒 Nakúpiť so zľavou: ${c.link}` },
  { id: "bare", render: (c) => `👉 ${c.link}` },
  { id: "link", render: (c) => `Odkaz na akciu: ${c.link}` },
];

const GENERIC_TAGS = ["#zlavy #akcie", "#akcie #vypredaj", "#zlavy #nakupy", "#setrime #zlavy"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function localWeekday(now: number): number {
  return WEEKDAYS.indexOf(new Date(now).toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Bratislava" }));
}

function formatDate(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("sk-SK", { timeZone: "Europe/Bratislava" }) : null;
}

function pick<T extends Variant>(list: T[], ctx: Ctx, seed: string, avoid: ReadonlySet<string> = new Set()): T {
  const allowed = list.filter((v) => !v.when || v.when(ctx));
  const fresh = allowed.filter((v) => !avoid.has(v.id));
  const pool = fresh.length > 0 ? fresh : allowed;
  return pool[parseInt(fnv1a(seed), 36) % pool.length];
}

/** Deterministický post z reálnych dát ponuky. avoidHooks = nedávno použité hooky (cooldown). */
export function buildPost(data: PostData, opts: { seed: string; now?: number; avoidHooks?: ReadonlySet<string>; avoidTemplates?: ReadonlySet<string> }): BuiltPost {
  const now = opts.now ?? Date.now();
  const validTo = data.validTo ? Date.parse(data.validTo) : NaN;
  const first = data.firstSeenAt ? Date.parse(data.firstSeenAt) : NaN;
  const ctx: Ctx = {
    ...data,
    title: data.title.replace(/\s+/g, " ").trim(),
    now,
    daysLeft: Number.isFinite(validTo) ? Math.floor((validTo - now) / 86_400_000) : null,
    ageDays: Number.isFinite(first) ? Math.floor((now - first) / 86_400_000) : null,
    weekday: localWeekday(now),
  };

  let hook = pick(HOOKS, ctx, `${opts.seed}|h`, opts.avoidHooks);
  let body = pick(BODIES, ctx, `${opts.seed}|b`);
  let cta = pick(CTAS, ctx, `${opts.seed}|c`);
  // Rovnaká kombinácia šablón ako nedávno → posuň telo/CTA (text nemá pôsobiť strojovo).
  for (let i = 0; i < 6 && opts.avoidTemplates?.has(`${hook.id}.${body.id}.${cta.id}`); i++) {
    body = pick(BODIES, ctx, `${opts.seed}|b${i}`);
    cta = pick(CTAS, ctx, `${opts.seed}|c${i}`);
  }
  if (opts.avoidTemplates?.has(`${hook.id}.${body.id}.${cta.id}`)) hook = pick(HOOKS, ctx, `${opts.seed}|h2`, opts.avoidHooks);

  const lines: string[] = [hook.render(ctx), body.render(ctx)];
  // Zľavu dopíš, len ak ju nespomína hook ani samotný titulok.
  if (pct(ctx) && hook.id !== "pct" && !/\d\s*%/.test(ctx.title)) lines.push(`Zľava až −${ctx.discountPct} %.`);
  const until = data.validTo ? formatDate(data.validTo) : null;
  if (until && ctx.daysLeft != null && ctx.daysLeft >= 0) lines.push(`Platí do ${until}.`);
  else lines.push("Podmienky a platnosť si over priamo v obchode.");
  lines.push(cta.render(ctx));
  const catTag = data.categoryId ? CATEGORY_TAG[data.categoryId] : undefined;
  const generic = GENERIC_TAGS[parseInt(fnv1a(`${opts.seed}|t`), 36) % GENERIC_TAGS.length];
  lines.push([generic, catTag, "#zlavickovo"].filter(Boolean).join(" "));

  const text = lines.join("\n\n");
  return { templateId: `${hook.id}.${body.id}.${cta.id}`, hookId: hook.id, text, textHash: fnv1a(text) };
}
