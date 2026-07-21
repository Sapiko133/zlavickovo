import type { Article } from "@/lib/articles";

/**
 * Kurátorské (ručne napísané) články o akciách/výpredajoch obchodov, ktoré máme.
 * Renderujú sa vždy (nezávisle od Redisu/cronu), takže homepage, /akcie a /blog
 * sú plné aj kým auto-generátor (cron check-sales) nedoplní produktové gridy.
 *
 * Redis článok s rovnakým slugom má prednosť (getAllArticles ho prepíše) —
 * takže cron/admin môžu tieto kedykoľvek obohatiť o produktový grid.
 */

interface Spec {
  shop: string;
  slug: string;         // shop slug (/kupony/[slug])
  domain: string;
  url: string;          // affiliate/cieľová URL pre CTA
  accent: string;       // farba bannera
  discountPct?: number;
  date: string;         // ISO
  title: string;
  perex: string;
  paragraphs: string[]; // odstavce obsahu
  tips?: string[];      // odrážky "čo nájdeš vo výpredaji"
}

const TAIL = `<p>Ceny, dostupnosť aj podmienky akcie (napr. minimálna suma pre dopravu zadarmo) sa môžu meniť — vždy si ich over priamo v obchode pred nákupom. Pred objednávkou skontroluj aj dostupné zľavové kódy, ktoré nájdeš nižšie.</p>`;

function buildContent(s: Spec): string {
  const intro = s.paragraphs.map((p) => `<p>${p}</p>`).join("");
  const tips = s.tips?.length
    ? `<h2>Čo sa oplatí sledovať</h2><ul>${s.tips.map((t) => `<li>${t}</li>`).join("")}</ul>`
    : "";
  return `${intro}${tips}${TAIL}`;
}

const SPECS: Spec[] = [
  {
    shop: "Alza", slug: "alza", domain: "alza.sk", url: "https://www.alza.sk/vypredaj",
    accent: "#0F3CC9", discountPct: 30, date: "2026-07-21T09:00:00Z",
    title: "Alza výpredaj – elektronika a spotrebiče až -30 %",
    perex: "Výpredaj na Alze prináša zľavy na notebooky, telefóny, televízory aj domáce spotrebiče. Pozreli sme, čo sa najviac oplatí.",
    paragraphs: [
      "Alza patrí medzi najväčšie e-shopy s elektronikou na Slovensku a jej výpredajová sekcia sa dopĺňa prakticky denne. Nájdeš tu zlacnené notebooky, mobilné telefóny, televízory, herné príslušenstvo aj veľké domáce spotrebiče.",
      "Najvýhodnejšie kúsky bývajú skladové prebytky a produkty z predošlých modelových radov — technicky úplne v poriadku, len za nižšiu cenu. Oplatí sa porovnať aj repasované (AlzaBazar) kusy so zárukou.",
    ],
    tips: [
      "Notebooky a mobily z minuloročných radov za výrazne nižšie ceny",
      "AlzaBazar — repasovaná elektronika so zárukou",
      "Doprava zadarmo nad 59 € alebo na AlzaBox",
      "S AlzaPlus+ doprava zadarmo na každú objednávku",
    ],
  },
  {
    shop: "Datart", slug: "datart", domain: "datart.sk", url: "https://www.datart.sk/vypredaj",
    accent: "#E30613", discountPct: 40, date: "2026-07-20T09:00:00Z",
    title: "Datart výpredaj – TV, práčky a spotrebiče až -40 %",
    perex: "Datart každý týždeň zlacňuje televízory, práčky, chladničky a malé spotrebiče. Prehľad, kde hľadať najväčšie zľavy.",
    paragraphs: [
      "Datart sa špecializuje na spotrebnú elektroniku a bielu techniku a jeho výpredaj patrí medzi najzaujímavejšie na trhu. Pravidelne zlacňuje televízory, práčky, chladničky, umývačky aj malé kuchynské spotrebiče.",
      "Okrem klasického výpredaja sa oplatí sledovať aj akcie typu druhý kus lacnejšie a predĺžené záruky, ktoré Datart k vybraným spotrebičom ponúka.",
    ],
    tips: [
      "Televízory a domáce kino za akciové ceny",
      "Veľké spotrebiče — práčky, chladničky, umývačky",
      "Malé spotrebiče do kuchyne a domácnosti",
    ],
  },
  {
    shop: "Notino", slug: "notino", domain: "notino.sk", url: "https://www.notino.sk/akcie/",
    accent: "#E6007E", discountPct: 25, date: "2026-07-20T11:00:00Z",
    title: "Notino akcie – parfumy a kozmetika so zľavou",
    perex: "Na Notine nájdeš zľavnené parfumy, dekoratívnu aj pleťovú kozmetiku a darčeky k nákupu. Toto sa oplatí sledovať.",
    paragraphs: [
      "Notino je najväčší online predajca parfumov a kozmetiky v regióne. V akciovej sekcii nájdeš zľavnené vône známych značiek, pleťovú a vlasovú starostlivosť aj dekoratívnu kozmetiku.",
      "Špecialitou Notina sú darčeky a vzorky k objednávke a sezónne balíčky, ktoré vyjdu výhodnejšie ako kúpa produktov samostatne.",
    ],
    tips: [
      "Parfumy známych značiek za akciové ceny",
      "Darčeky a vzorky k objednávke nad 30 €",
      "Doprava zadarmo nad 40 €",
    ],
  },
  {
    shop: "Zalando", slug: "zalando", domain: "zalando.sk", url: "https://www.zalando.sk/vypredaj/",
    accent: "#FF6900", discountPct: 50, date: "2026-07-19T09:00:00Z",
    title: "Zalando výpredaj – móda a obuv až -50 %",
    perex: "Letný výpredaj na Zalande zlacňuje oblečenie, obuv aj doplnky stoviek značiek. Pozri, ako z neho vyťažiť maximum.",
    paragraphs: [
      "Zalando je jeden z najväčších módnych e-shopov v Európe a jeho výpredaj patrí k najbohatším. Nájdeš tu oblečenie, obuv a doplnky pre ženy, mužov aj deti od stoviek značiek.",
      "Výhodou Zalanda je doprava aj vrátenie zadarmo a dlhá lehota na vrátenie — môžeš si teda objednať viac veľkostí a nechať si len to, čo sadne.",
    ],
    tips: [
      "Sezónny výpredaj oblečenia a obuvi až -50 %",
      "Doprava a vrátenie tovaru zadarmo",
      "Široký výber značiek na jednom mieste",
    ],
  },
  {
    shop: "About You", slug: "about-you", domain: "aboutyou.sk", url: "https://www.aboutyou.sk/sale",
    accent: "#1A1A1A", discountPct: 40, date: "2026-07-19T13:00:00Z",
    title: "About You výpredaj – oblečenie a -10 % pre nových",
    perex: "About You spája výpredaj módy so zľavou pre nových zákazníkov. Ako skombinovať obe výhody.",
    paragraphs: [
      "About You je obľúbený módny e-shop s dôrazom na trendy a inšpiráciu. V sekcii Sale nájdeš zlacnené oblečenie, obuv aj doplnky, pričom ponuka sa pravidelne obmieňa.",
      "Noví zákazníci navyše po registrácii zvyčajne získajú uvítaciu zľavu na prvý nákup, ktorú je možné využiť aj na časť výpredajového tovaru.",
    ],
    tips: [
      "Sezónny Sale s trendovými kúskami",
      "Uvítacia zľava -10 % na prvú objednávku",
      "Personalizované módne tipy",
    ],
  },
  {
    shop: "Nike", slug: "nike", domain: "nike.com", url: "https://www.nike.com/sk/w/sale-3yaep",
    accent: "#111111", discountPct: 40, date: "2026-07-18T09:00:00Z",
    title: "Nike výpredaj – tenisky a oblečenie až -40 %",
    perex: "V Nike výpredaji nájdeš zlacnené tenisky, tepláky, mikiny aj funkčné oblečenie. Toto stojí za pozornosť.",
    paragraphs: [
      "Nike vo svojej sekcii Sale pravidelne zlacňuje tenisky, oblečenie a doplnky pre šport aj voľný čas. Nájdeš tu obľúbené modely z predošlých kolekcií za nižšie ceny.",
      "Členovia Nike (bezplatná registrácia) mávajú prístup k exkluzívnym ponukám a lepším podmienkam dopravy a vrátenia.",
    ],
    tips: [
      "Tenisky z minulých kolekcií so zľavou",
      "Funkčné a voľnočasové oblečenie",
      "Výhody pre členov Nike",
    ],
  },
  {
    shop: "Dr. Max", slug: "dr-max", domain: "drmax.sk", url: "https://www.drmax.sk/akcie",
    accent: "#E2001A", discountPct: 30, date: "2026-07-18T12:00:00Z",
    title: "Dr. Max akcie – vitamíny, lieky a kozmetika",
    perex: "Lekáreň Dr. Max ponúka akcie na vitamíny, doplnky výživy aj dermokozmetiku. Prehľad toho najlepšieho.",
    paragraphs: [
      "Dr. Max je najväčšia lekárenská sieť a jej e-shop ponúka pravidelné akcie na voľnopredajné lieky, vitamíny, doplnky výživy a dermokozmetiku.",
      "Oplatí sa sledovať sezónne akcie (napr. na imunitu či opaľovanie) a vernostný program, ktorý prináša ďalšie zľavy a body za nákup.",
    ],
    tips: [
      "Vitamíny a doplnky výživy v akcii",
      "Dermokozmetika známych značiek",
      "Doprava zadarmo nad 29,90 €",
    ],
  },
  {
    shop: "Mall", slug: "mall", domain: "mall.sk", url: "https://www.mall.sk/vypredaj",
    accent: "#E10098", discountPct: 35, date: "2026-07-17T09:00:00Z",
    title: "Mall.sk výpredaj – elektronika a domácnosť",
    perex: "Mall.sk zlacňuje elektroniku, domáce spotrebiče, hračky aj tovar pre domácnosť. Kde hľadať zľavy.",
    paragraphs: [
      "Mall.sk je univerzálny e-shop so širokým sortimentom od elektroniky cez domáce spotrebiče až po hračky a potreby pre domácnosť. Výpredajová sekcia je preto pestrá a mení sa často.",
      "Vďaka veľkému sortimentu tu nájdeš zľavy naprieč kategóriami — od malých spotrebičov po sezónny tovar.",
    ],
    tips: [
      "Elektronika a spotrebiče za akciové ceny",
      "Tovar pre domácnosť a hračky",
      "Doprava zadarmo nad 39 €",
    ],
  },
  {
    shop: "GymBeam", slug: "gymbeam", domain: "gymbeam.sk", url: "https://gymbeam.sk/akcie",
    accent: "#D7263D", discountPct: 30, date: "2026-07-17T13:00:00Z",
    title: "GymBeam akcie – proteíny a fitness výživa",
    perex: "GymBeam ponúka akcie na proteíny, aminokyseliny, vitamíny aj fitness doplnky. Toto sa oplatí.",
    paragraphs: [
      "GymBeam je popredný predajca športovej výživy a fitness doplnkov. V akciách nájdeš proteíny, aminokyseliny (BCAA, EAA), kreatín, vitamíny a zdravé potraviny.",
      "Značka pravidelne pripravuje balíčky a množstevné zľavy, ktoré pri väčšom nákupe znížia cenu za porciu.",
    ],
    tips: [
      "Proteíny a gainery v akcii",
      "Vitamíny a doplnky pre imunitu",
      "Zvýhodnené balíčky a množstevné zľavy",
    ],
  },
  {
    shop: "Dedoles", slug: "dedoles", domain: "dedoles.sk", url: "https://www.dedoles.sk/vypredaj",
    accent: "#00A88E", discountPct: 30, date: "2026-07-16T09:00:00Z",
    title: "Dedoles výpredaj – veselé ponožky a oblečenie",
    perex: "Dedoles zlacňuje svoje známe veselé ponožky, spodnú bielizeň aj oblečenie. Ideálne aj na darčeky.",
    paragraphs: [
      "Dedoles sa preslávil veselými ponožkami s originálnymi vzormi a dnes ponúka aj spodnú bielizeň, tričká a oblečenie. Výpredajová sekcia je skvelá príležitosť doplniť šuplík za nižšie ceny.",
      "Vzory sa sezónne obmieňajú, takže vo výpredaji často nájdeš staršie kolekcie a limitované edície, ktoré sa už bežne nepredávajú.",
    ],
    tips: [
      "Veselé ponožky a bielizeň so zľavou",
      "Staršie a limitované vzory",
      "Vhodné na darčeky",
    ],
  },
  {
    shop: "Decathlon", slug: "decathlon", domain: "decathlon.sk", url: "https://www.decathlon.sk/akcie",
    accent: "#0082C3", discountPct: 30, date: "2026-07-16T12:00:00Z",
    title: "Decathlon akcie – športové vybavenie pre každého",
    perex: "Decathlon ponúka výhodné ceny na vybavenie pre turistiku, cyklistiku, fitness aj tímové športy.",
    paragraphs: [
      "Decathlon je synonymom dostupného športového vybavenia. V akciovej sekcii nájdeš oblečenie, obuv aj vybavenie pre desiatky športov — od turistiky a cyklistiky po fitness a plávanie.",
      "Vlastné značky Decathlonu ponúkajú výborný pomer ceny a výkonu už v základe a vo výpredaji sa dajú kúpiť ešte výhodnejšie.",
    ],
    tips: [
      "Vybavenie na turistiku a cyklistiku",
      "Fitness a bežecké oblečenie",
      "Výhodné vlastné značky",
    ],
  },
  {
    shop: "Sportisimo", slug: "sportisimo", domain: "sportisimo.sk", url: "https://www.sportisimo.sk/vypredaj/",
    accent: "#E30613", discountPct: 50, date: "2026-07-15T09:00:00Z",
    title: "Sportisimo výpredaj – tenisky a športová móda až -50 %",
    perex: "Sportisimo zlacňuje tenisky, športové oblečenie aj vybavenie značiek ako Nike, adidas či Puma.",
    paragraphs: [
      "Sportisimo je jeden z najväčších predajcov športovej módy a vybavenia. Vo výpredaji nájdeš tenisky, oblečenie a doplnky značiek ako Nike, adidas, Puma alebo Under Armour.",
      "Sezónne výpredaje bývajú obzvlášť výhodné pri obuvi a bundách z predošlých kolekcií.",
    ],
    tips: [
      "Tenisky známych značiek so zľavou",
      "Športové a outdoorové oblečenie",
      "Vybavenie pre bežné aj tímové športy",
    ],
  },
  {
    shop: "ZOOT", slug: "zoot", domain: "zoot.sk", url: "https://www.zoot.sk/vypredaj",
    accent: "#F03C69", discountPct: 40, date: "2026-07-15T12:00:00Z",
    title: "ZOOT výpredaj – móda s vrátením do 365 dní",
    perex: "ZOOT zlacňuje oblečenie a obuv a k tomu ponúka dopravu zadarmo a rekordné vrátenie do 365 dní.",
    paragraphs: [
      "ZOOT je módny e-shop známy zákazníckym prístupom — dopravou zadarmo a možnosťou vrátiť tovar až do 365 dní. Vo výpredaji nájdeš oblečenie, obuv a doplnky pre ženy aj mužov.",
      "Vďaka dlhej lehote na vrátenie si môžeš bez rizika objednať aj kúsky, pri ktorých si nie si istý veľkosťou.",
    ],
    tips: [
      "Sezónny výpredaj oblečenia a obuvi",
      "Doprava zadarmo",
      "Vrátenie tovaru do 365 dní",
    ],
  },
  {
    shop: "Lidl", slug: "lidl", domain: "lidl.sk", url: "https://www.lidl.sk/c/online-letak/s10008489",
    accent: "#0050AA", date: "2026-07-14T09:00:00Z",
    title: "Lidl akcie tento týždeň – potraviny aj nepotravinový tovar",
    perex: "Lidl každý pondelok a štvrtok spúšťa nové akcie na potraviny aj nepotravinový tovar. Čo sledovať v letáku.",
    paragraphs: [
      "Lidl patrí medzi najobľúbenejšie reťazce a jeho akcie sa obmieňajú niekoľkokrát do týždňa. Okrem potravín ponúka aj obľúbený nepotravinový tovar (Lidl Shop) — od kuchynských pomôcok po záhradu a domácnosť.",
      "Najvýhodnejšie bývajú tematické akcie a limitované ponuky, ktoré sa rýchlo vypredajú, preto sa oplatí sledovať leták hneď od začiatku akcie.",
    ],
    tips: [
      "Nové akcie na potraviny každý pondelok a štvrtok",
      "Nepotravinový tovar v Lidl Shope",
      "Tematické a sezónne ponuky",
    ],
  },
];

function specToArticle(s: Spec): Article {
  const nowIso = s.date;
  return {
    slug: `${s.slug}-vypredaj`,
    type: "sale",
    title: s.title,
    perex: s.perex,
    content: buildContent(s),
    shopName: s.shop,
    domain: s.domain,
    shopSlug: s.slug,
    discountPct: s.discountPct ?? null,
    products: [],
    affiliateUrl: s.url,
    date: nowIso,
    updatedAt: nowIso,
    published: true,
    source: "manual",
    // accent nie je súčasť Article typu — banner farbu drží mapa v komponente
  };
}

export const STATIC_SALE_ARTICLES: Article[] = SPECS.map(specToArticle);

/** Mapa slug → accent farba bannera (pre ArticleCard, keď článok nemá obrázok). */
export const ARTICLE_ACCENTS: Record<string, string> = Object.fromEntries(
  SPECS.map((s) => [`${s.slug}-vypredaj`, s.accent])
);
