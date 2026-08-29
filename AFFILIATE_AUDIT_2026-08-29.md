# Affiliate audit — 29. 8. 2026

Cieľ (zadanie): prejsť affiliate partnerov, **doplniť nové schválené feedy** na web a
pripraviť **zoznam programov, o ktoré treba požiadať**. Podľa dohody = len zoznam,
žiadosti podáva používateľ ručne v portáloch.

## Metóda a obmedzenie
- API kľúče Dognet/eHub/CJ **nie sú v lokálnom `.env.local`** (žijú len vo Vercel
  Production — pozri memory `vercel-env-sensitive`). Audit preto číta **živé Redis
  cache** produkcie (KV token je lokálne), ktoré prod už plní z týchto sietí.
- **Dôsledok:** viem presne, čo máme **schválené/joinnuté a monetizované**. Zoznam
  „joinovateľné, ale ešte nejoinnuté" (skutočné „požiadať") sa dá vytiahnuť len z
  `GET /campaigns/available` (Dognet) resp. portálov eHub/CJ — tie potrebujú prod
  credentials. Riešenie nižšie v sekcii „Čo potrebujem".

## 1. Pokrytie sietí (čo už MÁME, z cache)

| Sieť | Joinnuté programy | Z toho s aktívnymi kupónmi/kódmi |
|------|------------------:|---------------------------------:|
| **Dognet** (ch33415) | 294 | 124 |
| **eHub** (85c7b80f) | 73 | 16 |
| **CJ** (101812521) | 17 | 27* |
| **Affial** | account-level + 5 produktových feedov | `affial-coupons.ts` (statické) |

\* CJ má viac obchodov s kupónmi než „joined" v cache — kupónový feed vracia aj
advertiserov mimo joined zoznamu (napr. Footshop, Dermacol, Lekarna.cz).

**Kľúčové zistenie:** máme **~384 schválených programov**, ale kurátorský povrch
webu (`lib/top-shops.ts` = homepage grid + autocomplete) obsahuje len **28 obchodov**,
z ktorých s joinnutými programami reálne súhlasí len **Alza a Lidl**. Väčšina
monetizovaného inventára je dostupná cez `/kupony/[slug]`, ale **nie je zviditeľnená**.

## 2. GAP A — schválené, ale NEZVIDITEĽNENÉ (najväčší rýchly zisk)

Doplniť do kurátorského povrchu (`TOP_SHOPS`, homepage grid, `taxonomy.featuredShops`).
Priorita = **SK obchody s aktívnymi kódmi** (78 kusov, hotová monetizácia):

`4fstore.sk, 4Home.sk, Allegro.sk, Artmie.sk, Autovybava.sk, Avita.sk, Balabim.sk,
Benulekaren.sk, Boel.sk, Bonprix.sk, Bubulákovo.sk, Budchlap.sk, CisteOblecenie.sk,
Coffeein.sk, Dekoria.sk, Desirel.sk, Dobrá-miska.sk, DobrýTextil.sk, Dyson.sk, eJoy.sk,
Eros.sk, eyerim.sk, Faxcopy.sk, Feelpearls.sk, Fexi.sk, GSklub.sk, Herbatica.sk,
HomePoint.sk, Houseland.sk, Incacollagen.sk, Inpostele.sk, IronAesthetics.sk,
KampotskeKorenie.sk, Kitos.sk, Kloubus.sk, Larabags.sk, Lieky24.sk, Lumories.sk,
Medosviecky.sk, Milenialcafe.sk, Mobilego.sk, Mojnabytok.sk, nabbi.sk, Neurinu.sk,
Nutraceutics.sk, OKfish.sk, Oxepower.sk, Papilora.sk, Pobalsa.sk, Real-soft.sk,
Shop.rukahore.sk, Sizeer.sk, Solapoint.sk, Sparkl.sk, Sportby.sk, Stoporex.sk,
Stressfix.sk, Supershape.sk, Tchibo.sk, Tozax.sk, Vegmart.sk, Vitanella.sk,
Vypredaj-regalov.sk, Zoohit.sk …` (+ ďalšie, plný zoznam v audit skripte)

> **Pozor (PROJECT_VISION / homepage filter):** vynechať 18+/alkohol/tabak/vape —
> Alkoshop.sk, 69shop.sk, Eros.sk, IntímneNákupy.sk, Lovesexshop.sk, Erexan.sk sú v
> dátach, ale `isRestrictedForHome()` ich už filtruje z homepage. Do curated ich nedávať.

**eHub s kódmi (16):** Asiafood.cz, iPhoneMarket.cz, KrásneVône.sk, Manumi.cz,
Nakupujzdravo.sk, Nakupzdrave.cz, NejlevnějšíPodlahy.cz, Ochranná-skla.cz, PetExpert.cz/sk,
Počítače24.cz, Vitahit.cz, Vodafone.cz …

**CJ s kódmi (27):** Footshop.cz/sk, Dermacol, Lekarna.cz, MojaLekaren.sk, Marionnaud CZ/SK,
Homeandcook.cz/sk, ASKO-NABYTOK.SK, KvetinyExpres.cz, Impresi, E-armyshop.cz …

## 3. GAP B — flagship obchody, ktoré PROPAGUJEME, ale nemáme joinnutý program

Tieto sú v `TOP_SHOPS` (homepage), ale **nenašli sa v žiadnej joinnutej sieti** →
buď sú monetizované mimo cache (Affial account-level / direct), alebo **nemajú program
a treba oň požiadať / overiť**:

`Mall, Datart, NAY, Zalando, Shein, About You, Zara, H&M, Dedoles, ZOOT, ASOS, Notino,
GymBeam, Dr. Max, Sportisimo, Decathlon, Belda Sport, Dadaboom, Kojenecké oblečenie,
Nike, Adidas, IKEA, Martinus, Kaufland, Temu`

> Viaceré (GymBeam, Decathlon = direct; Notino/Answear/Bonprix cez CJ/Affial) sú
> podľa memory monetizované inak — treba **overiť per-shop**, nie slepo žiadať.
> Reálne „chýbajúce" veľké značky na požiadanie: **Zalando, About You, Zara, H&M,
> ASOS, Sportisimo, Decathlon, Nike, Adidas, IKEA, Kaufland, Temu** (globálne značky,
> často cez Awin/TradeTracker/vlastný program — nie v našich 4 sieťach).

## 4. Affial — tenké pokrytie
Cache má len **5 produktových feedov** (topgrily, medosviecky, vaporism, remoska,
designpropaganda) + statický `affial-coupons.ts`. Affial ponúka viac cez
`kupony_feed.xml` — treba re-scrape/rozšíriť (pozri memory `feed-discovery-expansion`).

## 5. Odporúčané akcie
1. **Rozšíriť `lib/top-shops.ts` + `taxonomy.featuredShops`** o SK obchody z GAP A
   (schválené, s kódmi) — čistý zisk viditeľnosti bez nových žiadostí. *(môžem urobiť hneď)*
2. **Overiť GAP B flagship** — ktoré reálne nemajú program; pripraviť žiadosti.
3. **Dognet: enumerovať joinovateľné-nejoinnuté** cez `/campaigns/available`
   (`scripts/join-campaigns.ts` to vie, ale auto-joinuje — treba read-only variant).
4. **Affial**: re-scrape `kupony_feed.xml`, doplniť feedy.

## 6. Čo potrebujem od teba
- Aby som vytiahol **skutočný „požiadať" zoznam** (joinovateľné-nejoinnuté), potrebujem
  buď (a) Dognet/eHub/CJ credentials lokálne (`DOGNET_EMAIL/PASSWORD`, `EHUB_API_KEY/PARTNER_ID`,
  `CJ_API_KEY/CJ_WEBSITE_ID`), alebo (b) povolenie pridať **read-only admin endpoint**
  na prod (`/api/admin/affiliate-coverage`), ktorý to spočíta s prod env a vráti JSON.
- Potvrď, či mám rovno **rozšíriť `TOP_SHOPS`** o SK obchody z GAP A (bod 5.1).
