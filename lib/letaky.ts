export type Letak = {
  slug: string;
  name: string;
  color: string;
  letter: string;
  url: string;
  country: "sk" | "cz";
  newDayOfWeek: number; // 0=Sun,1=Mon,...,6=Sat — day new leaflet is published
  updateText: string;
};

export const LETAKY: Letak[] = [
  { slug: "lidl",        name: "Lidl",        color: "#FFCC00", letter: "L", url: "https://www.lidl.sk/c/online-letak/s10008489",                  country: "sk", newDayOfWeek: 1, updateText: "nový každý pondelok" },
  { slug: "kaufland",    name: "Kaufland",    color: "#E30613", letter: "K", url: "https://www.kaufland.sk/akcie/aktualne-letaky.html",             country: "sk", newDayOfWeek: 4, updateText: "nový každý štvrtok" },
  { slug: "tesco",       name: "Tesco",       color: "#00539F", letter: "T", url: "https://www.tesco.sk/letaky",                                    country: "sk", newDayOfWeek: 3, updateText: "nový každú stredu" },
  { slug: "billa",       name: "Billa",       color: "#E2001A", letter: "B", url: "https://www.billa.sk/letaky-a-akcie/aktualny-letak",             country: "sk", newDayOfWeek: 2, updateText: "nový každý utorok" },
  { slug: "coop-jednota",name: "COOP Jednota",color: "#009639", letter: "C", url: "https://www.coopjednota.sk/letak",                               country: "sk", newDayOfWeek: 1, updateText: "týždenný" },
  { slug: "terno",       name: "Terno",       color: "#FF6600", letter: "T", url: "https://www.terno.sk/letaky",                                    country: "sk", newDayOfWeek: 1, updateText: "týždenný" },
  { slug: "fresh",       name: "Fresh",       color: "#00AA44", letter: "F", url: "https://www.fresh.sk/letak",                                     country: "sk", newDayOfWeek: 1, updateText: "týždenný" },
  { slug: "penny",       name: "Penny",       color: "#CC0000", letter: "P", url: "https://www.penny.cz/letak",                                     country: "cz", newDayOfWeek: 1, updateText: "týždenný" },
  { slug: "albert",      name: "Albert",      color: "#E2001A", letter: "A", url: "https://www.albert.cz/letak",                                    country: "cz", newDayOfWeek: 3, updateText: "nový každú stredu" },
  { slug: "globus",      name: "Globus",      color: "#0066CC", letter: "G", url: "https://www.globus.cz/letak",                                    country: "cz", newDayOfWeek: 1, updateText: "týždenný" },
];

// Returns the expiry date: day before next publication day
export function getExpiryDate(newDayOfWeek: number): Date {
  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun
  const expiryDow = (newDayOfWeek - 1 + 7) % 7;
  let daysAhead = (expiryDow - todayDow + 7) % 7;
  if (daysAhead === 0 && todayDow === expiryDow) daysAhead = 0; // expires today
  const d = new Date(today);
  d.setDate(today.getDate() + daysAhead);
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isExpiringSoon(d: Date): boolean {
  const diff = d.getTime() - Date.now();
  return diff <= 2 * 24 * 60 * 60 * 1000; // within 2 days
}
