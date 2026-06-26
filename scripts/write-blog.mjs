import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "content", "blog");
fs.mkdirSync(OUT, { recursive: true });

const TODAY = "2026-06-26";

const articles = [
{
  slug: "ako-usettrit-na-alza-10-tipov",
  title: "Ako ušetriť na Alza - 10 tipov 2026",
  description: "Overené tipy ako nakupovať na Alza lacnejšie. Zľavové kódy, akcie, Alza Body a Black Friday.",
  date: TODAY, category: "tipy", shop: "alza",
  content: `<h2>Alza je najväčší e-shop na Slovensku - a dá sa na ňom výborne ušetriť</h2>
<p>Alza.sk ponúka státisíce produktov od elektroniky, cez domácnosť až po potraviny. Ak viete, kde hľadať, môžete ušetriť desiatky až stovky eur ročne. Tu sú najlepšie overené tipy pre rok 2026.</p>
<h2>10 tipov ako nakupovať na Alza lacnejšie</h2>
<h3>1. Používaj zľavové kódy</h3>
<p>Na Zlavickovo.sk nájdeš vždy aktuálne promo kódy pre Alza. Kódy ako ALZA20 alebo NOVYZAKAZNIK ti môžu ušetriť 5–20% z celkovej sumy objednávky. Kódy stačí zadať do poľa "Zľavový kód" pri pokladni.</p>
<h3>2. Alza Body – program odmien</h3>
<p>Alza Body je vernostný program, v ktorom zbieraš body za každý nákup. 1 bod = 1 cent zľava na ďalší nákup. Za rok bežného nakupovania môžeš nazbierať body v hodnote 10–30€.</p>
<h3>3. Black Friday a Alza Birthday</h3>
<p>Alza organizuje každý rok obrovský Black Friday výpredaj a tiež Alza Birthday (narodeniny e-shopu). Počas týchto akcií sú zľavy 20–60% na tisíce produktov. Daj si do kalendára tieto dátumy a nakúp vopred pripravený zoznam.</p>
<h3>4. Sleduj sekciu Výpredaj</h3>
<p>Alza má permanentnú sekciu Výpredaj, kde nájdeš produkty so zníženými cenami. Obzvlášť zaujímavá je sekcia refurbished (repasované) produkty, kde ušetríš 20–40% oproti novým.</p>
<h3>5. Doprava zadarmo</h3>
<p>Objednávky nad určitú sumu majú dopravu zadarmo. Ak nakupuješ niekoľko drobností, skús ich zlúčiť do jednej objednávky a ušetri na poštovnom.</p>
<h3>6. Alza App – exkluzívne zľavy</h3>
<p>Stiahnuť Alza mobilnú aplikáciu sa oplatí. App obsahuje exkluzívne ponuky, notifikácie o zľavách na wishlist produkty a rýchlejšie objednávanie.</p>
<h3>7. Sleduj cenu – Alza Price Tracker</h3>
<p>Pred nákupom drahšieho produktu skontroluj históriu ceny. Alza občas zvýši cenu pred výpredajom a potom ju zníži späť. Tretie nástroje ako Heureka alebo camelcamelcamel ti ukážu skutočný vývoj ceny.</p>
<h3>8. Newsletter zľava</h3>
<p>Pri prihlásení na Alza newsletter dostaneš jednorazovú zľavu na prvý nákup. To je rýchly a jednoduchý spôsob ako ušetriť ihneď.</p>
<h3>9. Cashback cez partnerské portály</h3>
<p>Cez cashback portály vrátane Zlavickovo.sk môžeš získať späť 1–4% z každého nákupu na Alza. Pri nákupe elektorniky za 500€ to znamená 5–20€ späť.</p>
<h3>10. Kupuj v správnom čase</h3>
<p>Elektronika zlacňuje pred vydaním nového modelu. Ak nepotrebuješ najnovší iPhone alebo laptop ihneď, počkaj 1–2 mesiace po vydaní novej generácie a kúp starší model so zľavou 15–30%.</p>
<h2>Záver</h2>
<p>Kombináciou týchto tipov môžeš na ročných nákupoch na Alza ušetriť aj 100–200€. Vždy si pred nákupom skontroluj aktuálne kódy na Zlavickovo.sk!</p>`,
},
{
  slug: "shein-zlavove-kody-novi-zakaznici",
  title: "Shein zľavové kódy pre nových zákazníkov 2026",
  description: "Ako získať maximálnu zľavu pri prvom nákupe na Shein. Promo kódy, app bonus a ďalšie tipy.",
  date: TODAY, category: "kupony", shop: "shein",
  content: `<h2>Shein - najväčší módny e-shop sveta</h2>
<p>Shein je globálna módna platforma s neuveriteľne nízkymi cenami. Pre nových zákazníkov je k dispozícii množstvo špeciálnych zliav - ak ich využiješ správne, ušetríš pri prvom nákupe 30–50%.</p>
<h2>Zľavy pre nových zákazníkov Shein</h2>
<h3>Zľava pri registrácii</h3>
<p>Samotná registrácia na Shein.com ti prinesie bonus – zvyčajne 10–15% zľavu na prvý nákup alebo kredity v hodnote niekoľkých eur. Zľava sa automaticky aktivuje po overení emailu.</p>
<h3>Promo kódy pre nováčikov</h3>
<p>Na Zlavickovo.sk nájdeš aktuálne promo kódy pre Shein. Špeciálne kódy pre nových zákazníkov môžu poskytnúť zľavu 15–25% nad rámec bežných akcií. Kombinovanie kódov s existujúcimi výpredajmi je bežnou praxou.</p>
<h3>Shein App – extra 10% zľava</h3>
<p>Stiahnutím Shein mobilnej aplikácie získaš extra 10% zľavu na prvý nákup cez app. Aplikácia navyše ponúka denné prihlásenie odměny (bodíky) a flash predaje s extrémne nízkymi cenami.</p>
<h2>Ďalšie tipy pre nakupovanie na Shein</h2>
<h3>Zľavové udalosti</h3>
<ul>
<li><strong>Anniversary Sale</strong> – každoročná výročná akcia s najväčšími zľavami roka</li>
<li><strong>11.11 (Singles Day)</strong> – globálny shopping festival s extrémne nízkymi cenami</li>
<li><strong>Black Friday</strong> – týždenné akcie s až 70% zľavou</li>
<li><strong>Sezónne výpredaje</strong> – koniec zimy/leta s výpredajom kolekcie</li>
</ul>
<h3>Doprava zadarmo</h3>
<p>Shein ponúka dopravu zadarmo pri objednávkach nad určitú sumu (zvyčajne 25–35€). Zoskupuj nákupy, aby si dosiahol minimálnu sumu a ušetril na poštovnom.</p>
<h3>Referral program</h3>
<p>Za každého nového zákazníka, ktorého pozveš, získaš bodíky použiteľné ako zľava. Ak máš väčší okruh priateľov, môžeš takto zarobiť značné kredity.</p>
<h2>Na čo si dávať pozor</h2>
<p>Pri nakupovaní na Shein si vždy prečítaj recenzie produktu a skontroluj tabuľku veľkostí – Shein používa ázijské veľkosti, ktoré sa môžu líšiť od európskych. Väčšina produktov je kvalitná za svoju cenu, ale niektoré kategórie sú lepšie ako iné.</p>
<h2>Záver</h2>
<p>Pre nových zákazníkov Shein je neuveriteľná príležitosť nakúpiť módne oblečenie za veľmi nízke ceny. Využi všetky dostupné zľavy a promo kódy z Zlavickovo.sk pre maximálnu úsporu.</p>`,
},
{
  slug: "booking-com-najlacnejsi-hotel",
  title: "Booking.com - ako nájsť najlacnejší hotel",
  description: "Praktické tipy ako rezervovať hotel na Booking.com čo najlacnejšie. Genius program, flexibilné dátumy a zľavy.",
  date: TODAY, category: "tipy", shop: "booking",
  content: `<h2>Booking.com - najväčší portál pre rezervácie hotelov</h2>
<p>Booking.com ponúka milióny ubytovaní po celom svete. Vedieť, ako systém funguje, ti môže ušetriť 20–40% na každej rezervácii. Tu sú najefektívnejšie stratégie pre rok 2026.</p>
<h2>Genius program - najväčšia zľava</h2>
<p>Genius je vernostný program Booking.com s 3 úrovňami. Od Genius Level 1 dostávaš automaticky 10% zľavu v tisíckach hotelov. Level 2 prináša 15% a Level 3 až 20%. Čím viac rezervuješ, tým väčší máš discount.</p>
<h2>Tipy na najlacnejšie rezervácie</h2>
<h3>Flexibilné dátumy</h3>
<p>Funkcia "Flexibilné dátumy" ti ukáže ceny v okolí tvojho preferovaného termínu. Zmena odletu o 1–2 dni môže ušetriť 20–50%. Stredy a štvrtky sú zvyčajne lacnejšie ako víkendy.</p>
<h3>Rezervuj s možnosťou zrušenia</h3>
<p>Vždy ber možnosť bezplatného zrušenia, aj keď je mierne drahšia. Po rezervácii naďalej sleduj cenu – ak cena klesne, zruš a znova rezervuj lacnejšie.</p>
<h3>Last minute vs. early bird</h3>
<ul>
<li><strong>Early bird</strong> – rezervácia 90+ dní vopred prináša špeciálne zľavy</li>
<li><strong>Last minute</strong> – hotely vypredávajú voľné izby s 30–60% zľavou týždeň pred termínom</li>
<li><strong>Promo codes</strong> – Booking.com pravidelne vydáva promo kódy pre konkrétne destinácie</li>
</ul>
<h3>Platba vopred vs. na mieste</h3>
<p>Ceny s platbou vopred sú zvyčajne 5–15% lacnejšie. Ak si istý svojou rezerváciou, táto možnosť ušetrí peniaze.</p>
<h2>Porovnaj ceny</h2>
<p>Booking.com nie je vždy najlacnejší. Vždy porovnaj cenu aj na Expedia, Hotels.com alebo priamo na webe hotela. Hotely sú povinné ponúkať rovnakú cenu na svojom webe ako cez OTA portály.</p>
<h2>Záver</h2>
<p>S Genius programom, flexibilnými dátumami a správnym načasovaním môžeš na každej dovolenke ušetriť stovky eur. Sleduj Zlavickovo.sk pre aktuálne Booking.com promo kódy.</p>`,
},
{
  slug: "lidl-vs-kaufland-kde-lacnejsie",
  title: "Lidl vs Kaufland - kde je lacnejšie?",
  description: "Porovnanie Lidl vs Kaufland - kde nájdeš lepšie ceny, akcie a výhody? Detailná analýza 2026.",
  date: TODAY, category: "porovnanie", shop: "",
  content: `<h2>Lidl alebo Kaufland - kde nakupovať?</h2>
<p>Oba reťazce patria do skupiny Schwarz a pokrývajú celé Slovensko. Napriek tomu sa v cenách, assortimente aj vernostných programoch výrazne líšia. Prinášame porovnanie pre rok 2026.</p>
<h2>Ceny základných potravín</h2>
<p>Základné potraviny (mlieko, chlieb, mäso) sú v oboch reťazcoch porovnateľné. Lidl má mierne nižšie ceny na vlastnú značku (Milbona, Pikok), zatiaľ čo Kaufland ponúka širší výber značkových produktov.</p>
<h2>Týždenné akcie</h2>
<h3>Lidl akcie</h3>
<p>Lidl vydáva leták každý pondelok a štvrtok s non-food akciami (náradie, oblečenie, záhradné potreby). Tieto "stredné uličky" sú legendárne svojimi ultra-nízkymi cenami. Na potravinové akcie nájdeš zľavy 20–40%.</p>
<h3>Kaufland akcie</h3>
<p>Kaufland aktualizuje akcie každú stredu a ponúka väčší výber potravinových produktov v akcii. Silnou stránkou sú mäsové výrobky a čerstvé potraviny v akcii.</p>
<h2>Vernostné programy</h2>
<ul>
<li><strong>Lidl Plus</strong> – mobilná app s personalizovanými kupónmi, zbieraním bodov a exkluzívnymi zľavami</li>
<li><strong>Kaufland Card</strong> – karta s bodovým programom, kde 1 bod = 1 cent zľava</li>
</ul>
<p>Lidl Plus app ponúka každý týždeň 3–5 kupónov s výraznou zľavou (napr. -25% na vybraný produkt). Kaufland Card je jednoduchšia, ale bodovanie je transparentnejšie.</p>
<h2>Organické a bio produkty</h2>
<p>Kaufland má širší výber bio produktov a lokálnych potravín. Lidl BioOrganic linka je lacnejšia, ale menšia. Pre bio zákazníka vyhráva Kaufland.</p>
<h2>Záver - kde je lacnejšie?</h2>
<p>Pre základný nákup a non-food akcie vedie <strong>Lidl</strong>. Pre čerstvé mäso, ryby a širší assortiment je lepší <strong>Kaufland</strong>. Ideálne riešenie? Kombinovať oba reťazce a sledovať letáky na Zlavickovo.sk.</p>`,
},
{
  slug: "co-je-cashback-ako-funguje",
  title: "Čo je cashback a ako funguje?",
  description: "Vysvetlenie cashback programov - ako získať peniaze späť z každého nákupu. Kompletný sprievodca.",
  date: TODAY, category: "navody", shop: "",
  content: `<h2>Cashback - zarábaj pri nakupovaní</h2>
<p>Cashback (alebo "peniaze späť") je systém, kde ti portál alebo aplikácia vráti časť peňazí z každého nákupu uskutočneného cez ich odkaz. Je to legálny spôsob ako systematicky šetriť na online nakupovaní.</p>
<h2>Ako cashback funguje krok za krokom</h2>
<h3>Krok 1: Klikneš cez cashback portál</h3>
<p>Navštívíš cashback portál (napr. Zlavickovo.sk) a klikneš na odkaz k obchodu. Týmto krokom sa do URL obchodu vloží sledovací parameter, ktorý identifikuje, že si prišiel od nás.</p>
<h3>Krok 2: Uskutočníš nákup</h3>
<p>Nakupuješ normálne na webe obchodu. Cena produktu je pre teba rovnaká ako bez cashback portálu – dokonca môžeš kombinovať cashback s akciami a zľavovými kódmi.</p>
<h3>Krok 3: Obchod zaplatí províziu</h3>
<p>Obchod nám zaplatí affiliate odmenu za sprostredkovaný nákup. Táto odmena je obvykle 2–15% z hodnoty objednávky.</p>
<h3>Krok 4: Dostaneš cashback</h3>
<p>Zo získanej odmeny ti vrátime časť priamo na účet alebo vo forme kreditov. Cashback sa zvyčajne pripíše do 30–60 dní po nákupe (po uplynutí doby na vrátenie tovaru).</p>
<h2>Koľko môžeš ušetriť?</h2>
<ul>
<li><strong>Alza</strong> – až 3% cashback</li>
<li><strong>Notino</strong> – až 8% cashback</li>
<li><strong>Zalando</strong> – až 5% cashback</li>
<li><strong>GymBeam</strong> – až 10% cashback</li>
<li><strong>Booking.com</strong> – až 5% cashback</li>
</ul>
<p>Pri ročných výdajoch 2000€ na online nakupovanie môžeš cashbackom ušetriť 60–200€ ročne.</p>
<h2>Kombinácia cashback + zľavový kód</h2>
<p>Najlepší tip: kombinuj cashback s promo kódom. Napríklad použiješ kód NOTINO15 (15% zľava) A zároveň klikneš cez cashback portál (8% späť). Efektívne ušetríš až 23% z nákupu.</p>
<h2>Na čo si dávať pozor</h2>
<p>Niektoré obchody vylučujú cashback pri použití promo kódu. Vždy si prečítaj podmienky konkrétneho programu. Cashback sa tiež nepočíta z poštovného a vrátených tovarov.</p>
<h2>Záver</h2>
<p>Cashback je jednoduchý, bezplatný spôsob ako ušetriť peniaze bez toho, aby si musel meniť svoje nákupné zvyky. Začni dnes cez sekciu Cashback na Zlavickovo.sk!</p>`,
},
{
  slug: "zalando-nakupovat-lacnejsie",
  title: "Ako nakupovať na Zalando lacnejšie",
  description: "Tipy a triky na lacnejšie nakupovanie na Zalando. Zľavové kódy, SALE sekcia a ďalšie spôsoby úspory.",
  date: TODAY, category: "tipy", shop: "zalando",
  content: `<h2>Zalando - európsky módny gigant</h2>
<p>Zalando je najväčší európsky módny e-shop s tisíckami značiek. Ceny sú zvyčajne vyššie ako na Shein, ale kvalita a výber sú na inom level. Existuje niekoľko overených spôsobov, ako nakupovať lacnejšie.</p>
<h2>SALE sekcia - najväčšia úspora</h2>
<p>Zalando má permanentnú SALE sekciu s až 70% zľavou. Najväčšie výpredaje prebiehajú v januári (po Vianociach) a júli (letný výpredaj). Pridaj si produkty do wishlistu a sleduj, keď ich cena klesne.</p>
<h2>Zľavové kódy pre Zalando</h2>
<p>Na Zlavickovo.sk nájdeš aktuálne Zalando promo kódy. Nové zákazníčky obvykle dostanú 10–15% na prvý nákup. Kódy sú často viazané na minimálnu hodnotu objednávky.</p>
<h2>Ďalšie spôsoby úspory</h2>
<h3>Zaregistruj sa na newsletter</h3>
<p>Zalando newsletter prináša exkluzívne ponuky a early access k výpredajom. Newsletter subskriberi dostávajú oznámenie o začiatku SALE 24 hodín pred ostatnými.</p>
<h3>Využi bezplatné vrátenie</h3>
<p>Zalando ponúka bezplatné vrátenie – to ti umožňuje objednať niekoľko veľkostí a vrátiť nehodiacse. Šetríš čas a vyhneš sa nákupu nevhodnej veľkosti.</p>
<h3>Zalando Lounge</h3>
<p>Zalando Lounge je uzavretá sekcia s flash predajmi luxusných značiek za 30–75% zľavu. Akcie trvajú 3–5 dní. Registrácia je zadarmo a stojí za to.</p>
<h3>Studentská zľava</h3>
<p>Študenti s platnou ISIC kartou alebo university emailom získajú extra 10–15% zľavu cez Student Beans alebo UniDays program.</p>
<h2>Načasovanie nákupov</h2>
<ul>
<li><strong>Január</strong> – Winter Sale, zľavy 30–70%</li>
<li><strong>Júl</strong> – Summer Sale, rovnaké zľavy</li>
<li><strong>Black Friday november</strong> – celý obchod v akcii</li>
<li><strong>Cyber Monday</strong> – ešte lepšie online ponuky</li>
</ul>
<h2>Záver</h2>
<p>Na Zalando sa dá veľmi dobre ušetriť, ak poznáš správne stratégie. Kombinuj SALE sekciu, promo kódy z Zlavickovo.sk a newsletter zľavy pre maximálnu úsporu.</p>`,
},
{
  slug: "gymbeam-najlepsie-akcie-proteiny",
  title: "GymBeam - najlepšie akcie na proteíny",
  description: "Ako ušetriť na GymBeam proteínoch a doplnkoch. Kupóny, bundle dealy a sezónne výpredaje.",
  date: TODAY, category: "kupony", shop: "gymbeam",
  content: `<h2>GymBeam - najpopulárnejší obchod s fitness doplnkami</h2>
<p>GymBeam je slovenská e-commerce úspešnica, ktorá vyrába a predáva vlastné fitness doplnky. Ich proteíny, kreatin a vitamíny patria k najlepšiemu pomeru cena/kvalita na trhu. Tu sú tipy ako nakúpiť ešte lacnejšie.</p>
<h2>Promo kódy GymBeam</h2>
<p>GymBeam pravidelne vydáva promo kódy, ktoré nájdeš na Zlavickovo.sk. Typické zľavy sú 10–15%, pri špeciálnych akciách aj 20%. Kódy fungujú zvyčajne na celý sortiment alebo vybrané kategórie.</p>
<h2>Výhodné nákupy na GymBeam</h2>
<h3>Bundle dealy</h3>
<p>GymBeam predáva špeciálne "starter pack" a "bundle" balíčky, kde dostaneš viac produktov za nižšiu cenu. Proteín + kreatin + vitamíny v bundle môžu byť 15–25% lacnejšie ako kúpené zvlášť.</p>
<h3>Veľké balenia</h3>
<p>Väčšie balenie znamená nižšiu cenu za gram proteínu. 5kg balenie proteínu je o 20–30% lacnejšie na kilogram ako 1kg. Ak proteín používaš pravidelne, veľký balík sa vždy oplatí.</p>
<h3>Sample Pack – vyskúšaj pred nákupom</h3>
<p>GymBeam ponúka vzorky proteínov za symbolickú cenu. Skôr než kúpiš 5kg príchuť, ktorá ti nebude chutiť, vyskúšaj sample. Ušetríš peniaze a sklamanie.</p>
<h2>Sezónne akcie GymBeam</h2>
<ul>
<li><strong>Nový rok (január)</strong> – "New Year, New You" akcie pre nových fitness zákazníkov</li>
<li><strong>Leto (jún-august)</strong> – akcie na spaľovače tukov a hydratačné produkty</li>
<li><strong>Black Friday</strong> – najväčšie ročné zľavy, zvyčajne 25–40%</li>
<li><strong>Narodeninová akcia GymBeam</strong> – výročná akcia s extra zľavami</li>
</ul>
<h2>Newsletter a sociálne siete</h2>
<p>Prihláš sa na GymBeam newsletter a sleduj ich Instagram. Pravidelne zverejňujú flash sale kódy platné len 24–48 hodín. Tieto kódy sú často výhodnejšie ako bežné kampane.</p>
<h2>Záver</h2>
<p>GymBeam je skvelou voľbou pre kvalitné doplnky za rozumnú cenu. S promo kódmi z Zlavickovo.sk a správnym načasovaním môžeš ušetriť 20–40% na každom nákupe.</p>`,
},
{
  slug: "notino-kupony-kozmetika",
  title: "Notino kupóny - ako ušetriť na kozmetike",
  description: "Aktuálne Notino kupóny a zľavy. Parfumy, kozmetika a starostlivosť o pleť lacnejšie s promo kódmi.",
  date: TODAY, category: "kupony", shop: "notino",
  content: `<h2>Notino - najväčší online parfuméria v Európe</h2>
<p>Notino ponúka obrovský výber parfumov, kozmetiky a starostlivosti o pleť od stoviek svetových značiek. Ceny sú konkurenčné, ale s promo kódmi a cashbackom môžeš ušetriť ešte viac.</p>
<h2>Promo kódy pre Notino</h2>
<p>Notino pravidelne vydáva kupóny, ktoré nájdeš na Zlavickovo.sk. Zľavy sa pohybujú od 5% pre bežné akcie až po 20% pri špeciálnych udalostiach. Niektoré kódy sú viazané na konkrétne kategórie (parfumy, make-up, vlasová kozmetika).</p>
<h2>Tipy na lacnejšie nakupovanie na Notino</h2>
<h3>Darčekové sady – hodnota navyše</h3>
<p>Notino ponúka luxusné darčekové sady (napr. parfum + telové mlieko + sprchový gél), ktoré sú 30–50% lacnejšie ako kúpené jednotlivo. Ideálne na darčeky alebo pre seba.</p>
<h3>Outlet sekcia</h3>
<p>V Notino Outlet nájdeš produkty s poškodeným obalom alebo blízko dátumu spotreby za výrazne znížené ceny. Samotný produkt je nepoškodený – len obal nie je perfektný.</p>
<h3>Vernostný program</h3>
<p>Za každý nákup na Notino zbieraš body. Nazbierané body môžeš použiť ako zľavu pri ďalšom nákupe. Nákup nad určitú sumu ti tiež zaradí do vyššej vernostnej úrovne s lepšími benefitmi.</p>
<h2>Najlepší čas na nákup</h2>
<ul>
<li><strong>Valentín (február)</strong> – zľavy na parfumy a kozmetické sady</li>
<li><strong>Deň matiek (máj)</strong> – špeciálne darčekové edície</li>
<li><strong>Black Friday</strong> – najväčšie ročné zľavy na prémiové značky</li>
<li><strong>Vianoce</strong> – darčekové sady s extra zľavou</li>
</ul>
<h2>Cashback na Notino</h2>
<p>Notino patrí medzi obchody s najvyšším cashbackom – až 8%. Pri parfume za 100€ dostaneš 8€ späť. Kombinuj cashback cez Zlavickovo.sk s promo kódom pre maximálnu zľavu.</p>
<h2>Záver</h2>
<p>Notino je skvelým miestom na nákup prémiových parfumov a kozmetiky. S kupónmi z Zlavickovo.sk a cashbackom môžeš ušetriť až 25% z bežnej ceny.</p>`,
},
{
  slug: "top-5-sposobov-usettrit-online",
  title: "Top 5 spôsobov ako ušetriť pri online nakupovaní",
  description: "5 overených stratégií ako systematicky šetriť pri online nákupoch. Kupóny, cashback a ďalšie tipy.",
  date: TODAY, category: "tipy", shop: "",
  content: `<h2>Šetri pri každom online nákupe</h2>
<p>Online nakupovanie môže byť oveľa lacnejšie ako kamenný obchod – ak vieš, ako na to. Tieto 5 stratégií ti pomôžu systematicky šetriť bez toho, aby si musel meniť nákupné zvyky.</p>
<h2>1. Zľavové kódy a kupóny</h2>
<p>Pred každým nákupom si vyhľadaj promo kód na Zlavickovo.sk. Trvá to 30 sekúnd a môžeš ušetriť 10–20%. Kódy existujú pre takmer každý väčší e-shop – Alza, Shein, Zalando, Notino, GymBeam a stovky ďalších.</p>
<p><strong>Tip:</strong> Nainštaluj si browserový rozšírenie, ktoré automaticky hľadá a aplikuje kupóny pri pokladni.</p>
<h2>2. Cashback portály</h2>
<p>Cashback je systém, kde dostaneš späť časť peňazí z každého nákupu uskutočneného cez partnerský odkaz. Portály ako Zlavickovo.sk ti vrátia 2–10% z nákupu. Pri ročných výdajoch 3000€ to znamená 60–300€ späť.</p>
<h2>3. Sleduj históriu cien</h2>
<p>Ceny online sa neustále menia. Pred drahším nákupom skontroluj historiu ceny pomocou nástrojov ako Heureka alebo rozšírení pre prehliadač. Zistíš, či je "akciová" cena naozaj výhodná alebo len šikovný marketing.</p>
<h2>4. Nakupuj v správnom čase</h2>
<ul>
<li><strong>Black Friday (november)</strong> – najväčšie ročné zľavy</li>
<li><strong>Singles Day 11.11</strong> – globálna akcia pôvodom z Číny</li>
<li><strong>Sezónne výpredaje</strong> – január a júl pre módu, jar a jeseň pre elektroniku</li>
<li><strong>Pred koncom mesiaca</strong> – obchody plnia predajné ciele</li>
</ul>
<h2>5. Kombinuj stratégie</h2>
<p>Maximálna úspora nastáva kombináciou viacerých metód súčasne: nakúpiš cez cashback portál (5% späť) + použiješ promo kód (10% zľava) + nakúpiš počas výpredaja (20% zľava). Efektívne ušetríš 35% z bežnej ceny.</p>
<h2>Bonus: Newsletter zľavy</h2>
<p>Prihláš sa na newsletter obchodov, kde nakupuješ pravidelne. Zvyčajne dostaneš okamžitú 10–15% zľavu na prvý nákup a pravidelné informácie o akciách.</p>
<h2>Záver</h2>
<p>Systematické šetrenie pri online nakupovaní nevyžaduje veľa úsilia – len správne návyky. Začni s Zlavickovo.sk ako svojím prvým krokom pred každým nákupom.</p>`,
},
{
  slug: "ikea-akcie-kedy-nakupovat",
  title: "IKEA akcie - kedy nakupovať najlacnejšie",
  description: "Kedy a ako nakupovať na IKEA najlacnejšie. IKEA Family card, sezónne akcie a online zľavy 2026.",
  date: TODAY, category: "tipy", shop: "ikea",
  content: `<h2>IKEA akcie - kedy nakúpiš najlacnejšie</h2>
<p>IKEA je synonymom pre škandinávsky dizajn za dostupné ceny. Existujú však spôsoby, ako nakúpiť ešte lacnejšie. Tu sú overené stratégie pre slovenských zákazníkov.</p>
<h2>IKEA Family - karta zadarmo plná výhod</h2>
<p>IKEA Family je bezplatná vernostná karta pre každého. Výhody zahŕňajú špeciálne ceny na vybrané produkty (IKEA Family Price), bezplatnú kávu každý deň v reštaurácii a prvý prístup k výpredajom.</p>
<h2>IKEA Family Sale</h2>
<p>Niekoľkokrát ročne IKEA organizuje exkluzívny IKEA Family Sale – víkend, počas ktorého majitelia karty dostávajú extra 10–15% zľavy na tisíce produktov. Sleduj IKEA newsletter, aby si nepremeškal.</p>
<h2>Sezónne akcie</h2>
<ul>
<li><strong>Januar</strong> – výpredaj po Vianociach</li>
<li><strong>Jar (február-apríl)</strong> – akcie na záhradný nábytok</li>
<li><strong>Júl-august</strong> – letný výpredaj a back-to-school</li>
<li><strong>November</strong> – Black Friday v IKEA</li>
</ul>
<h2>AS-IS sekcia – továr s malou chybou</h2>
<p>AS-IS je sekcia v každej predajni IKEA s produktmi, ktoré majú malé estetické vady (škrabanec, chýbajúca skrutka) za 30–70% zľavu. Väčšina produktov je plne funkčná – len vizuálne nie sú perfektné.</p>
<h2>Nakupuj online</h2>
<p>IKEA online obchod pravidelne ponúka exkluzívne online zľavy a cashback. Vyhnúť sa fronte v predajni a nakúpiť pohodlne z domu so špeciálnou online cenou je skvelá stratégia.</p>
<h2>Reštaurácia – ceny pod výrobné náklady</h2>
<p>IKEA reštaurácia je zámerné lákadlo – hovädzie guľky, lososový tanier a ďalšie jedlá sú pod výrobnými nákladmi. Kombinuj nákup s lacným obedom a ušetríš aj na stravovaní.</p>
<h2>Záver</h2>
<p>IKEA Family karta je absolútne nutná pre každého, kto v IKEA nakupuje aspoň raz ročne. Sleduj IKEA Family Sale dátumy a AS-IS sekciu pre maximálnu úsporu.</p>`,
},
{
  slug: "shein-vs-zalando-ktory-lacnejsi",
  title: "Shein vs Zalando - ktorý je lacnejší?",
  description: "Porovnanie Shein vs Zalando - ceny, kvalita, dodanie a výber. Kde nakúpite lacnejšie oblečenie?",
  date: TODAY, category: "porovnanie", shop: "",
  content: `<h2>Shein vs Zalando - detailné porovnanie 2026</h2>
<p>Obidva sú módne e-shopy, ale inak nemajú skoro nič spoločné. Shein je ultra-fast-fashion z Číny s extrémne nízkymi cenami, Zalando je európska platforma s tisíckami prémiových značiek. Čo je pre teba lepšie?</p>
<h2>Ceny</h2>
<p><strong>Shein</strong> vyhráva v cenách – tričko za 3–8€, šaty za 10–20€. Ceny sú nižšie ako kdekoľvek inde. Dosahuje sa to masovou výrobou v Číne s minimálnymi maržami.</p>
<p><strong>Zalando</strong> predáva značkové oblečenie v bežných cenách – 20–100€ za tričko, 50–300€ za kabát. V SALE sekcii sú ceny 30–70% nižšie.</p>
<h2>Kvalita</h2>
<ul>
<li><strong>Shein</strong> – variabilná kvalita, niektoré produkty vydržia len pár praní, iné sú prekvapivo dobré</li>
<li><strong>Zalando</strong> – predáva overené značky (Adidas, Zara, Tommy Hilfiger) so štandardnou kvalitou</li>
</ul>
<h2>Dodanie a vrátenie</h2>
<p><strong>Shein</strong> doručuje z Číny – štandardne 10–20 dní, express 5–8 dní. Vrátenie je zdarma prvú objednávku, potom za poplatok.</p>
<p><strong>Zalando</strong> doručuje z európskych skladov – zvyčajne 2–4 dni. Vrátenie je VŽDY zadarmo – to je obrovská výhoda pri nakupovaní obuvi.</p>
<h2>Výber</h2>
<p>Shein má milióny produktov, ale sú to least od neznámych výrobcov. Zalando má menší výber, ale obsahuje renomované európske a medzinárodné značky.</p>
<h2>Pre koho je čo vhodné?</h2>
<ul>
<li><strong>Shein</strong> – ideálny pre módne trendy s obmedzeným rozpočtom, party outfity, sezónne doplnky</li>
<li><strong>Zalando</strong> – pre kvalitné základné kúsky, značkovú obuv, pracovné oblečenie</li>
</ul>
<h2>Záver</h2>
<p>Nevolíme víťaza – oba e-shopy majú miesto vo vašom šatníku. Shein pre trend-driven nákupy, Zalando pre quality basics. Sleduj zľavové kódy pre obidva na Zlavickovo.sk.</p>`,
},
{
  slug: "ako-pouzivat-zlavove-kody-spravne",
  title: "Ako používať zľavové kódy správne",
  description: "Kompletný návod na používanie zľavových kódov. Kde hľadať, ako zadávať a ako kombinovať kupóny.",
  date: TODAY, category: "navody", shop: "",
  content: `<h2>Zľavové kódy – kompletný sprievodca</h2>
<p>Zľavový kód (promo kód, kupónový kód) je séria znakov, ktorú zadávaš pri pokladni v online obchode a dostaneš zľavu. Zdá sa to jednoducho – ale existujú dôležité detaily, ktoré môžu znamenať rozdiel medzi platným a zamietnutým kódom.</p>
<h2>Kde nájsť platné zľavové kódy</h2>
<ul>
<li><strong>Zlavickovo.sk</strong> – slovenský portál s aktuálnymi overenými kódmi</li>
<li><strong>Newsletter obchodu</strong> – prihlás sa a dostaneš kódy priamo na email</li>
<li><strong>Sociálne siete obchodu</strong> – Instagram, Facebook akcie</li>
<li><strong>Vernostný program</strong> – kódy pre members-only akcie</li>
<li><strong>Remarketing</strong> – ak opustíš košík, mnohé obchody ti pošlú kód emailom</li>
</ul>
<h2>Ako správne zadať kód</h2>
<ol>
<li>Pridaj produkty do košíka</li>
<li>Prejdi do pokladne (checkout)</li>
<li>Nájdi pole "Zľavový kód", "Promo kód" alebo "Kupón"</li>
<li>Zadaj kód PRESNE (vrátane veľkých písmen a číslic)</li>
<li>Klikni "Použiť" a skontroluj, či sa zľava odpočítala</li>
</ol>
<h2>Prečo kód nefunguje – bežné dôvody</h2>
<h3>Kód vypršal</h3>
<p>Každý kód má expiráciu. Vždy skontroluj platnosť kódu pred použitím. Na Zlavickovo.sk sú kódy pravidelne aktualizované.</p>
<h3>Minimálna hodnota objednávky</h3>
<p>Väčšina kódov má podmienku minimálnej hodnoty košíka (napr. "min. objednávka 50€"). Ak košík podmienku nespĺňa, kód sa neuplatní.</p>
<h3>Kategórická výnimka</h3>
<p>Niektoré kódy platia len na vybrané kategórie (napr. len na elektroniku, nie na potraviny). Skontroluj podmienky kódu.</p>
<h3>Jednorázové použitie</h3>
<p>Kódy pre nových zákazníkov fungujú len raz. Ak si ich použil pri prvej objednávke, nebudú fungovať opakovane.</p>
<h2>Kombinovanie kódov a akcií</h2>
<p>Väčšina obchodov povoluje len jeden kód naraz. Niektoré však umožňujú kombináciu kódu s prebiehajúcou akciou – zľava sa počíta z upravenej (akciovej) ceny.</p>
<h2>Záver</h2>
<p>Zľavové kódy sú jednoduchý spôsob ako ušetriť 5–30% na každom nákupe. Vždy si skontroluj aktuálne kódy na Zlavickovo.sk ešte pred zadaním platby.</p>`,
},
{
  slug: "sportisimo-kupony-sportove-vybavenie",
  title: "Sportisimo kupóny - ušetri na športovom vybavení",
  description: "Zľavové kódy pre Sportisimo. Tipy ako nakúpiť lacnejšie topánky, oblečenie a vybavenie.",
  date: TODAY, category: "kupony", shop: "sportisimo",
  content: `<h2>Sportisimo – najväčší slovenský obchod so športovým vybavením</h2>
<p>Sportisimo patrí k lídrom predaja v kategórii sport. Nájdeš tam všetko od bežeckých topánok, cez fitness vybavenie až po zimné lyžiarske doplnky. S promo kódmi môžeš ušetriť slušnú sumu.</p>
<h2>Promo kódy pre Sportisimo</h2>
<p>Aktuálne zľavové kódy pre Sportisimo nájdeš na Zlavickovo.sk. Typická zľava je 10–15% na celý nákup alebo špecifické kategórie. Pri nákupe bežeckých topánok za 100€ to znamená 10–15€ úspora.</p>
<h2>Sportisimo vernostný program</h2>
<p>Sportisimo Club je bezplatný vernostný program. Za každých 10€ nákupu zbieraš body, ktoré môžeš vymeniť za zľavy. Členovia tiež dostávajú exkluzívne akcie a early access k výpredajom.</p>
<h2>Sezónne akcie a výpredaje</h2>
<ul>
<li><strong>Január</strong> – výpredaj zimnej kolekcie (lyžiarske vybavenie, bundy)</li>
<li><strong>Apríl-máj</strong> – začiatok sezóny: bežecká obuv, cyklistika</li>
<li><strong>Júl-august</strong> – letný výpredaj, plážové vybavenie</li>
<li><strong>November</strong> – Black Friday, najväčšie ročné zľavy</li>
</ul>
<h2>Brandové akcie</h2>
<p>Sportisimo pravidelne organizuje akcie jednotlivých značiek. Adidas, Nike, Puma, Under Armour – každá značka má aspoň raz ročne výraznú akciu v Sportisimo. Sleduj newsletter alebo sekciu Akcie na webe.</p>
<h2>Outlet v predajni</h2>
<p>V kamenných predajniach Sportisimo nájdeš outlet sekciu s produktmi predchádzajúcej sezóny za 30–60% zľavu. Minuloročné bežecké topánky plnia rovnakú funkciu za zlomok ceny.</p>
<h2>Záver</h2>
<p>Pre pravidelných nakupovateľov v Sportisimo sa oplatí Sportisimo Club a sledovanie promo kódov na Zlavickovo.sk. Kombinácia bodov, kupónov a sezónnych akcií môže priniesť úsporu 20–35% ročne.</p>`,
},
{
  slug: "dedoles-originalne-ponozky-zlava",
  title: "Dedoles - originálne ponožky so zľavou",
  description: "Ako nakúpiť Dedoles ponožky a ďalšie produkty lacnejšie. Promo kódy a tipy na úsporu.",
  date: TODAY, category: "kupony", shop: "dedoles",
  content: `<h2>Dedoles – slovenská ponožková jednotka</h2>
<p>Dedoles je slovenská úspešnica, ktorá začala s originálnymi potlačenými ponožkami a dnes predáva oblečenie, pyžamá, doplnky a bytové dekorácie. Ich produkty sú skvelým darčekom – a s promo kódom ušetríš.</p>
<h2>Zľavové kódy Dedoles</h2>
<p>Aktuálne promo kódy pre Dedoles nájdeš na Zlavickovo.sk. Typická zľava je 10–15% na celú objednávku. Kódy sú vhodné na darčekové nákupy, kde každé euro rozhoduje.</p>
<h2>Tipy na lacnejší nákup v Dedoles</h2>
<h3>Bundle zľavy</h3>
<p>Čím viac ponožiek kúpiš, tým lacnejšia je cena za pár. Pakety 5-ks alebo 10-ks sú výhodnejšie ako kúpiť po jednom. Ideálne na Vianoce pre celú rodinu.</p>
<h3>Sale sekcia</h3>
<p>Dedoles má Sale sekciu s produktmi minulej kolekcie za nižšie ceny. Ak ti nevadí, že dizajn nie je z aktuálnej sezóny, ušetríš 20–40%.</p>
<h3>Personalizácia – nie vždy lacnejšia</h3>
<p>Dedoles ponúka personalizované ponožky (napr. s fotkou). Tieto sú drahšie a promo kódy na ne zvyčajne nefungujú. Ak chceš ušetriť, volíš bežné kolekcie.</p>
<h2>Referral program</h2>
<p>Za odporúčanie priateľa dostaneš obidvaja zľavu. Ak pozveš priateľa cez tvoj referral link a uskutoční nákup, obidvaja dostanete kredit (zvyčajne 5–10€).</p>
<h2>Najobľúbenejšie produkty ako darček</h2>
<ul>
<li>Tematické ponožky (Vianoce, Veľká noc, narodeniny)</li>
<li>Pyžamové sety pre páry</li>
<li>Detské kolekcie</li>
<li>Personalizované ponožky s menom</li>
</ul>
<h2>Záver</h2>
<p>Dedoles je skvelý pre originálne darčeky s osobným nádychom. S promo kódom z Zlavickovo.sk a bundle nákupom ušetríš pri väčšej objednávke 15–25%.</p>`,
},
{
  slug: "martinus-kupony-knihy-lacnejsie",
  title: "Martinus kupóny - knihy lacnejšie",
  description: "Zľavové kódy pre Martinus. Ako nakúpiť knihy, e-booky a audioknihy lacnejšie v 2026.",
  date: TODAY, category: "kupony", shop: "martinus",
  content: `<h2>Martinus – knihy pre každého</h2>
<p>Martinus je najobľúbenejší slovenský kníhkupec s obrovským výberom kníh, e-kníh a audiokníh. Pravidelní čitatelia môžu ušetriť desiatky eur ročne, ak vedia, kde hľadať zľavy.</p>
<h2>Promo kódy pre Martinus</h2>
<p>Aktuálne Martinus kupóny nájdeš na Zlavickovo.sk. Zľavové kódy sú zvyčajne 5–15%, niektoré sú platné len na slovenské alebo české tituly.</p>
<h2>Martinus vernostný program</h2>
<p>Martinus má vernostný systém, kde zbieraš "štampiľky" za každý nákup. Po nazbieraní dostatočného počtu dostaneš zľavy alebo darčekovú poukážku. Dlhodobí zákazníci profitujú najviac.</p>
<h2>Tipy na lacnejší nákup kníh</h2>
<h3>E-knihy – lacnejšie ako tlačené</h3>
<p>E-knihy sú zvyčajne 20–40% lacnejšie ako tlačené vydanie. Ak čítaš na tablete alebo e-readeri, e-knihy sú logická voľba pre úsporu.</p>
<h3>Predpredaj – early bird zľava</h3>
<p>Martinus ponúka predpredaj nových titulov s nižšou cenou. Ak vieš, že chceš určitú knihu, objednaj ju ešte pred vydaním a ušetri.</p>
<h3>Akčné balíky</h3>
<p>Martinus pravidelne ponúka balíky kníh jedného autora alebo série so zľavou. Ak sleduješ konkrétnu sériu, balík je oveľa výhodnejší ako jednotlivé tituly.</p>
<h2>Sezónne akcie</h2>
<ul>
<li><strong>Veľká noc</strong> – akcie na detské knihy a výchovnú literatúru</li>
<li><strong>Letná čítanie (júl)</strong> – bestsellery za akciové ceny</li>
<li><strong>September – Mesiac kníh</strong> – celomesačné akcie</li>
<li><strong>Vianoce</strong> – darčekové balenia, vouchers</li>
</ul>
<h2>Záver</h2>
<p>Pre vášnivých čitateľov je Martinus neodmysliteľný. Kombinácia vernostného programu, e-kníh a promo kódov z Zlavickovo.sk môže priniesť úsporu 15–25% ročne na čítaní.</p>`,
},
{
  slug: "nordvpn-zlava-usettrit-vpn",
  title: "NordVPN zľava - ako ušetriť na VPN",
  description: "Ako získať najlacnejšie NordVPN predplatné. Promo kódy, dlhodobé plány a Black Friday zľavy.",
  date: TODAY, category: "tipy", shop: "nordvpn",
  content: `<h2>NordVPN - prečo a ako kúpiť lacnejšie</h2>
<p>NordVPN je jeden z najpopulárnejších VPN poskytovateľov na svete. Mesačné predplatné môže byť drahé, ale ak vieš, kedy a ako kúpiť, môžeš ušetriť 60–70% oproti bežnej ceny.</p>
<h2>Dlhodobý plán – najväčšia úspora</h2>
<p>NordVPN ponúka predplatné na 1 mesiac, 1 rok a 2 roky. Dvojročný plán je o 60–70% lacnejší ako mesačný. Ak plánuješ NordVPN používať dlhodobo, 2-ročný plán je absolútne najvýhodnejší.</p>
<h2>Promo kódy pre NordVPN</h2>
<p>NordVPN aktívne spolupracuje s influencermi a portálmi. Promo kódy môžu priniesť extra 20–30% zľavu nad rámec bežnej ceny. Aktuálne kódy nájdeš na Zlavickovo.sk.</p>
<h2>Kedy kupovať NordVPN</h2>
<ul>
<li><strong>Black Friday (november)</strong> – historicky najväčšie zľavy, zvyčajne 65–75%</li>
<li><strong>Cyber Monday</strong> – pokračovanie Black Friday akcií</li>
<li><strong>Nový rok</strong> – akcie s dlhodobými plánmi</li>
<li><strong>Valentín</strong> – špeciálne párové ponuky</li>
</ul>
<h2>NordVPN vs. alternatívy</h2>
<p>Ak ti ide primárne o cenu, existujú lacnejšie VPN ako Surfshark (špeciálne na neobmedzený počet zariadení) alebo CyberGhost. Všetky ponúkajú podobné funkcie, ale NordVPN má dlhodobú reputáciu spoľahlivosti.</p>
<h2>Čo dostaneš s NordVPN</h2>
<ul>
<li>Ochrana až 10 zariadení súčasne</li>
<li>Servery v 60+ krajinách</li>
<li>Blokátor reklám a malware (Threat Protection)</li>
<li>30-dňová garancia vrátenia peňazí</li>
</ul>
<h2>Záver</h2>
<p>NordVPN je výborná investícia do online súkromia. Kúp 2-ročný plán počas Black Friday s promo kódom z Zlavickovo.sk a zaplatíš menej ako 3€ mesačne.</p>`,
},
{
  slug: "najlacnejsie-letenky-ako-najst",
  title: "Ako nájsť najlacnejšie letenky",
  description: "Tipy ako kúpiť lacné letenky. Flexibilné dátumy, price alerts a správne vyhľadávanie letov 2026.",
  date: TODAY, category: "tipy", shop: "",
  content: `<h2>Lacné letenky – umenie nájsť správnu cenu</h2>
<p>Ceny leteniek sa menia desaťtisíckrát denne. Algoritmy leteckých spoločností analyzujú dopyt a dynamicky upravujú ceny. Vedieť, ako tieto systémy fungujú, ti môže ušetriť stovky eur.</p>
<h2>Kedy hľadať letenky</h2>
<h3>Najlacnejšie dni leta</h3>
<p>Štatisticky sú lety v utorok, stredu a sobotu lacnejšie ako v piatok a nedeľu. Ak máš flexibility v dátumoch, ušetríš 10–30% samotnou zmenou dňa odletu.</p>
<h3>Kedy rezervovať</h3>
<ul>
<li><strong>Lacné dlhé lety (Ázia, Amerika)</strong> – rezervuj 3–6 mesiacov vopred</li>
<li><strong>Európske lety</strong> – najlepšie ceny sú 1–3 mesiace pred letom</li>
<li><strong>Last minute</strong> – môže fungovať, ale je to riskantné</li>
</ul>
<h2>Najlepšie nástroje na hľadanie leteniek</h2>
<ul>
<li><strong>Google Flights</strong> – najlepší na zobrazenie cenových trendov a flexibilných dátumov</li>
<li><strong>Skyscanner</strong> – skvelý na porovnanie celých mesiacov</li>
<li><strong>Momondo</strong> – nájde niekedy lacnejšie letenky ako konkurencia</li>
<li><strong>Booking.com letné dealy</strong> – kombinovaný hotel + let</li>
</ul>
<h2>Price Alert</h2>
<p>Nastav si cenové upozornenie (Price Alert) na Google Flights alebo Skyscanner. Keď cena klesne pod tvoju hranicu, dostaneš email. Týmto spôsobom môžeš sledovať ceny bez každodenného manuálneho hľadania.</p>
<h2>Lacné letecké spoločnosti</h2>
<p>Wizzair, Ryanair a easyJet ponúkajú veľmi nízke základné ceny, ale účtujú si extra za batožinu. Vždy zarátaj cenu batožiny do celkovej kalkulácie.</p>
<h2>Záver</h2>
<p>Lacné letenky nie sú náhoda – sú výsledok informovaného hľadania v správny čas. Google Flights, Price Alert a flexibilné dátumy sú tvoji najlepší priatelia.</p>`,
},
{
  slug: "websupport-akcie-lacny-webhosting",
  title: "Websupport akcie - lacný webhosting",
  description: "Promo kódy a akcie pre Websupport. Ako získať lacný webhosting, domény a SSL certifikát.",
  date: TODAY, category: "kupony", shop: "websupport",
  content: `<h2>Websupport – slovenský líder webhostingu</h2>
<p>Websupport je najväčší slovenský hosting provider s desaťtisíckami zákazníkov. Ponúka webhosting, VPS, domény, SSL certifikáty a WordPress hosting. Tu sú tipy ako nakúpiť lacnejšie.</p>
<h2>Promo kódy pre Websupport</h2>
<p>Websupport pravidelne vydáva promo kódy s 20–30% zľavou na nové služby. Aktuálne kódy nájdeš na Zlavickovo.sk. Kódy fungujú zvyčajne pre nové zákazníky alebo nové objednávky.</p>
<h2>Ročné vs. mesačné predplatné</h2>
<p>Ročné predplatné hostingu je 20–30% lacnejšie ako mesačné. Pre akýkoľvek plán, ktorý plánuješ dlhodobo používať, je ročná platba výhodnejšia.</p>
<h2>Doménová registrácia zadarmo</h2>
<p>Pri niektorých hosting plánoch dostaneš doménu zadarmo na prvý rok. To je úspora 8–15€ hneď na začiatku. Po roku je cena domény bežná trhová cena.</p>
<h2>Black Friday akcie</h2>
<p>Websupport každoročne ponúka Black Friday zľavy 30–50% na hosting plány. Toto je najlepší čas na upgrade alebo nákup nového plánu. Akcie zvyčajne trvajú 1 týždeň.</p>
<h2>Tipy pre výber správneho plánu</h2>
<ul>
<li><strong>Start plán</strong> – jeden web, ideálny pre blog alebo malú firmu</li>
<li><strong>Profi plán</strong> – neobmedzené weby, vhodný pre webdizajnérov</li>
<li><strong>VPS</strong> – pre väčšie projekty s vyššou návštevnosťou</li>
</ul>
<h2>SSL certifikát zadarmo</h2>
<p>Websupport zahŕňa bezplatný Let's Encrypt SSL certifikát vo všetkých plánoch. Netreba platiť extra za SSL – je to štandard v roku 2026.</p>
<h2>Záver</h2>
<p>Pre slovenské weby a e-shopy je Websupport spoľahlivou voľbou. S promo kódom z Zlavickovo.sk a ročným predplatným ušetríš 40–50% oproti mesačnej platbe bez kódu.</p>`,
},
{
  slug: "about-you-moda-so-zlavu",
  title: "About You móda so zľavou",
  description: "Zľavové kódy a tipy pre About You. Ako nakúpiť módne oblečenie lacnejšie na about-you.sk.",
  date: TODAY, category: "kupony", shop: "about-you",
  content: `<h2>About You – personalizovaná módna platforma</h2>
<p>About You je európska módna platforma, ktorá sa odlišuje personalizovaným zážitkom. Algoritmus odporúča oblečenie podľa tvojho vkusu. S promo kódmi a akciami môžeš nakúpiť lacnejšie.</p>
<h2>Zľavové kódy pre About You</h2>
<p>Aktuálne promo kódy pre About You nájdeš na Zlavickovo.sk. Nové zákazníčky zvyčajne dostanú 15–20% zľavu na prvý nákup. Kódy sú viazané na minimálnu hodnotu košíka.</p>
<h2>SALE sekcia About You</h2>
<p>About You má rozsiahlu SALE sekciu s tisíckami produktov za 20–70% zľavu. Najlepšie výpredaje sú v januári a júli, podobne ako Zalando. Ich vlastná značka YAS je cenovo veľmi výhodná.</p>
<h2>About You App</h2>
<p>Stiahnutie About You aplikácie prináša exkluzívne app-only ponuky a push notifikácie o flash predajoch. V appke nájdeš aj exkluzívne kolekcie od influencerov.</p>
<h2>Vrátenie tovaru zadarmo</h2>
<p>About You ponúka bezplatné vrátenie podobne ako Zalando. To ti dáva slobodu objednať viac kusov, vyskúšať a vrátiť nehodiacse.</p>
<h2>Najlepšie kategórie na About You</h2>
<ul>
<li><strong>Dámska móda</strong> – obrovský výber od základných kúskov po trendové kúsky</li>
<li><strong>Obuv</strong> – všetky hlavné značky s bezplatným vrátením</li>
<li><strong>Športové oblečenie</strong> – Nike, Adidas, Puma za konkurenčné ceny</li>
<li><strong>Plus size móda</strong> – About You má jeden z najširších výberov veľkých veľkostí</li>
</ul>
<h2>Záver</h2>
<p>About You je skvelou alternatívou k Zalandu, obzvlášť pre dámsku módu. S promo kódmi z Zlavickovo.sk a SALE sekciou môžeš nakúpiť štýlovo bez vysokého výdavku.</p>`,
},
{
  slug: "dr-max-lekarnen-akcie-zlavy",
  title: "Dr. Max lekáreň - akcie a zľavy",
  description: "Ako ušetriť v Dr. Max lekárni. Vernostný program, promo kódy a online nákup liekov lacnejšie.",
  date: TODAY, category: "kupony", shop: "dr-max",
  content: `<h2>Dr. Max – najväčšia lekárenská sieť</h2>
<p>Dr. Max je najväčšia lekárenská sieť na Slovensku s stovkami pobočiek a silným online obchodom. Lieky, vitamíny, kozmetika a zdravotnícke potreby – a to všetko môžeš nakúpiť lacnejšie.</p>
<h2>Dr. Max vernostný program</h2>
<p>Dr. Max Karta je bezplatná vernostná karta s množstvom výhod. Za každý nákup zbieraš body (1 bod za každé euro), ktoré môžeš vymeniť za zľavy. Členovia navyše dostávajú špeciálne cenové akcie.</p>
<h2>Týždenné akcie a letáky</h2>
<p>Dr. Max vydáva každý týždeň leták s akciovými produktmi. Zľavy sú zvyčajne 20–50% na vybrané vitamíny, kozmetiku alebo zdravotnícke potreby. Sleduj aktuálny leták na Zlavickovo.sk.</p>
<h2>Online lekáreň – lacnejšie ako kamenná</h2>
<p>Nákup cez dr-max.sk je zvyčajne lacnejší ako v kamennej lekárni, pretože online ceny môžu byť nižšie a nájdeš viac akciových produktov. Lieky bez predpisu (OTC), vitamíny a doplnky stravy sú dostupné s doručením do 24 hodín.</p>
<h2>Kategórie s najlepšími zľavami</h2>
<ul>
<li><strong>Vitamíny a minerály</strong> – pravidelné 2+1 akcie a bundle zľavy</li>
<li><strong>Kozmetika a dermokozmetika</strong> – akcie značiek Vichy, La Roche-Posay, Eucerin</li>
<li><strong>Zdravotné pomôcky</strong> – merače tlaku, terometre v akcii</li>
<li><strong>Detské produkty</strong> – plienkové balíčky, detská kozmetika</li>
</ul>
<h2>2+1 akcie</h2>
<p>Dr. Max pravidelne ponúka akcie "kúp 2 zaplať za 1" na vitamíny a doplnky. Ak tieto produkty používaš pravidelne (multivitamíny, vitamín D), nakúp počas akcie zásobu na niekoľko mesiacov.</p>
<h2>Záver</h2>
<p>Dr. Max vernostná karta a pravidelné sledovanie akcií ti ušetria 15–25% ročne na nákupoch liekov a kozmetiky. Pre ešte väčšiu úsporu kombinuj s promo kódmi z Zlavickovo.sk.</p>`,
},
];

let saved = 0;
for (const article of articles) {
  const file = path.join(OUT, `${article.slug}.json`);
  fs.writeFileSync(file, JSON.stringify(article, null, 2), "utf8");
  saved++;
}
console.log(`Saved ${saved} articles to ${OUT}`);
