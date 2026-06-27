export interface CategoryShop {
  name: string;
  slug: string;
  href?: string;
  category?: string;
}

export interface CategoryDef {
  slug: string;
  label: string;
  emoji: string;
  desc: string;
  color: string;
  bg: string;
  shops: CategoryShop[];
  keywords: string[];
}

export const CATEGORIES: Record<string, CategoryDef> = {
  elektronika: {
    slug: "elektronika", label: "Elektronika", emoji: "💻",
    desc: "Kupóny na laptopy, TV, foto, audio a domáce spotrebiče.",
    color: "#0065BD", bg: "#dbeafe",
    keywords: ["laptop", "tv", "audio", "kamera", "elektronika", "mobil", "telefon"],
    shops: [
      { name: "Alza", slug: "alza" },
      { name: "Datart", slug: "datart" },
      { name: "Mall", slug: "mall" },
      { name: "CZC", slug: "czc" },
      { name: "NAY", slug: "nay" },
      { name: "Okay.sk", slug: "okay" },
    ],
  },
  moda: {
    slug: "moda", label: "Móda", emoji: "👗",
    desc: "Zľavy na oblečenie, obuv a módne doplnky.",
    color: "#E8001D", bg: "#fce7f3",
    keywords: ["oblecenie", "topanky", "moda", "rifle", "saty", "bunda"],
    shops: [
      { name: "Zalando", slug: "zalando" },
      { name: "Shein", slug: "shein" },
      { name: "ASOS", slug: "asos" },
      { name: "About You", slug: "about-you" },
      { name: "Answear", slug: "answear" },
      { name: "Enemiq", slug: "enemiq-sk" },
      { name: "Arno Obuv", slug: "arno-obuv-sk" },
    ],
  },
  zdravie: {
    slug: "zdravie", label: "Zdravie", emoji: "💊",
    desc: "Vitamíny, doplnky výživy, biopotraviny a zdravá výživa.",
    color: "#00A551", bg: "#dcfce7",
    keywords: ["vitaminy", "suplement", "zdravie", "protein", "gym", "probiotiká"],
    shops: [
      { name: "GymBeam", slug: "gymbeam" },
      { name: "Dr. Max", slug: "dr-max" },
      { name: "Notino", slug: "notino" },
      { name: "Herbatica", slug: "herbatica" },
      { name: "Superstrava", slug: "superstrava-sk" },
      { name: "Blendea", slug: "blendea-sk" },
      { name: "Altevita", slug: "altevita-sk" },
    ],
  },
  krasa: {
    slug: "krasa", label: "Krása", emoji: "💄",
    desc: "Kozmetika, parfumy, starostlivosť o pleť a vlasy.",
    color: "#db2777", bg: "#fdf2f8",
    keywords: ["parfum", "kozmetika", "krem", "makeup", "krasa", "plet"],
    shops: [
      { name: "Notino", slug: "notino" },
      { name: "Kosmetikomat", slug: "kosmetikomat-sk" },
      { name: "Spaceylon", slug: "spaceylon-sk" },
      { name: "Nechtovyraj", slug: "nechtovyraj-sk" },
    ],
  },
  sport: {
    slug: "sport", label: "Šport", emoji: "⚽",
    desc: "Kupóny na športové vybavenie, oblečenie a obuv.",
    color: "#FF6900", bg: "#fed7aa",
    keywords: ["sport", "futbal", "beh", "outdoor", "fitness", "cyklo"],
    shops: [
      { name: "Sportisimo", slug: "sportisimo" },
      { name: "Decathlon", slug: "decathlon" },
      { name: "Shox", slug: "shox-sk" },
      { name: "Belda Sport", slug: "belda-sk" },
    ],
  },
  byvanie: {
    slug: "byvanie", label: "Bývanie", emoji: "🏠",
    desc: "Nábytok, osvetlenie, dekorácie a vybavenie domácnosti.",
    color: "#7C3AED", bg: "#ede9fe",
    keywords: ["nabytok", "dom", "kuchyna", "spalna", "byvanie", "osvetlenie"],
    shops: [
      { name: "IKEA", slug: "ikea" },
      { name: "E-matrac", slug: "e-matrac-sk" },
      { name: "Artofhome", slug: "artofhome-cz" },
      { name: "Li-Go", slug: "li-go-cz" },
    ],
  },
  potraviny: {
    slug: "potraviny", label: "Potraviny", emoji: "🛒",
    desc: "Aktuálne akcie a letáky z potravinových reťazcov.",
    color: "#16a34a", bg: "#dcfce7",
    keywords: ["potraviny", "jedlo", "supermarket", "nákup", "akcie"],
    shops: [
      { name: "Lidl", slug: "lidl", href: "/letaky/lidl" },
      { name: "Kaufland", slug: "kaufland", href: "/letaky/kaufland" },
      { name: "Tesco", slug: "tesco", href: "/letaky/tesco" },
      { name: "Billa", slug: "billa", href: "/letaky/billa" },
      { name: "Rohlik.sk", slug: "rohlik" },
    ],
  },
  deti: {
    slug: "deti", label: "Deti", emoji: "👶",
    desc: "Hračky, detské oblečenie a potreby pre bábätká a deti.",
    color: "#f59e0b", bg: "#fef3c7",
    keywords: ["hracky", "deti", "babatko", "kojenec", "detske"],
    shops: [
      { name: "Dadaboom", slug: "dadaboom-sk" },
      { name: "Kojenecké oblečenie", slug: "kojenecke-obleceni-eu" },
    ],
  },
  cestovanie: {
    slug: "cestovanie", label: "Cestovanie", emoji: "✈️",
    desc: "Zľavy na hotely, letenky a dovolenkové balíčky.",
    color: "#0ea5e9", bg: "#e0f2fe",
    keywords: ["hotel", "letenka", "dovolenka", "cestovanie"],
    shops: [
      { name: "Booking.com", slug: "booking-com" },
      { name: "Airbnb", slug: "airbnb" },
      { name: "Invia", slug: "invia" },
    ],
  },
  knihy: {
    slug: "knihy", label: "Knihy", emoji: "📚",
    desc: "Kupóny na knihy, audioknihy a e-booky.",
    color: "#D32F2F", bg: "#fee2e2",
    keywords: ["knihy", "komiks", "audiokniha", "ebook", "literatura"],
    shops: [
      { name: "Martinus", slug: "martinus" },
      { name: "Bux.sk", slug: "bux" },
      { name: "Panta Rhei", slug: "panta-rhei" },
    ],
  },
};

export const CATEGORIES_LIST = Object.values(CATEGORIES);

export function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (["alza", "datart", "mall", "czc", "nay", "okay", "samsung", "apple", "lenovo", "hp", "dell"].some(k => n.includes(k))) return "elektronika";
  if (["zalando", "shein", "asos", "answear", "about you", "zara", "h&m", "bershka"].some(k => n.includes(k))) return "moda";
  if (["gymbeam", "dr. max", "dr.max", "notino", "herbatica"].some(k => n.includes(k))) return "zdravie";
  if (["sportisimo", "decathlon", "intersport"].some(k => n.includes(k))) return "sport";
  if (["ikea", "hornbach", "obi"].some(k => n.includes(k))) return "byvanie";
  if (["lidl", "kaufland", "tesco", "billa", "rohlik"].some(k => n.includes(k))) return "potraviny";
  if (["martinus", "panta rhei"].some(k => n.includes(k))) return "knihy";
  if (["booking", "airbnb", "invia"].some(k => n.includes(k))) return "cestovanie";
  return "";
}
