# Design Tokens: Zlavickovo.sk

## Direction

Tokeny vychádzajú z filozofie **Editorial commerce utility**: presnosť a skenovateľnosť cenového nástroja, čistota moderného e-commerce a zdržanlivá vizuálna energia deals webu.

Hlavná zelená `#22C55E` zostáva rozpoznateľným brand akcentom. Pre primárne CTA v light mode sa používa tmavšia `#15803D`, pretože biely text na pôvodnej svetlej zelenej nemá dostatočný WCAG AA kontrast. V dark mode sa pomer otočí: svetlejšie zelené CTA používa tmavý text.

Zdrojový súbor je `DESIGN_TOKENS.css`. Počas implementácie sa jeho obsah integruje do `app/globals.css`; existujúci `lib/design-tokens.ts` sa bude migrovať po komponentoch, nie prepísaný naraz.

## Usage Rules

- Komponenty používajú sémantické tokeny (`--color-text-primary`), nie primitívne farby (`--slate-900`), ak nejde o definíciu ďalšieho tokenu.
- Zelená označuje brand, interakciu, dôveryhodný saving evidence alebo úspech. Nepoužíva sa ako dekorácia na každej karte.
- Amber označuje dôveryhodnú blízku expiráciu alebo upozornenie, nie umelo vytvorenú urgenciu.
- Červená patrí chybe alebo neplatnému stavu, nie bežnému discount badge.
- `success`, `historical-low`, `expiring` a podobné tokeny neurčujú, či sa badge smie zobraziť. To vždy rozhodujú dáta a confidence pravidlá.
- Štruktúru kariet nesú border a whitespace. Tiene sa používajú iba na skutočnú eleváciu, dropdown alebo hover/focus feedback.
- Primárny font je Geist, ktorý už načítava root layout. Mono font je vyhradený pre kupónové kódy a technické hodnoty.
- Základný spacing krok je 4 px. Bežné dotykové ovládanie používa minimálnu výšku 44 px.
- Dark mode nie je jednoduchá inverzia; používa chladno-zelené tmavé povrchy a upravené accent kontrasty.

## Migration Map

| Current token/value | Target token |
| --- | --- |
| `T.green` / `#22C55E` | `--color-brand-primary`; pre button background `--color-accent-primary` |
| `T.greenDark` / `#16A34A` | podľa významu `--color-accent-primary-hover` alebo `--color-text-saving` |
| `T.greenLight` / `#F0FDF4` | `--color-brand-subtle` alebo status background |
| `T.textPrimary` | `--color-text-primary` |
| `T.textSecond` | `--color-text-secondary` |
| `T.textMuted`, `T.textFaint` | `--color-text-tertiary` / `--color-text-disabled` |
| `T.bg`, `T.bgAlt`, `T.surface` | príslušné `--color-bg-*` / `--color-surface-*` |
| `T.border`, `T.borderLight` | `--color-border-primary` / `--color-border-secondary` |
| `T.rSm` až `T.rFull` | `--radius-sm` až `--radius-full` |
| `T.shadow*` | `--shadow-*`; zelené glow tiene sa nepoužívajú ako default |
| inline `fontFamily` | `--font-family-body` alebo `--font-family-mono` |
| inline transition `all` | konkrétne properties cez `--control-transition` alebo motion tokeny |

## Implementation Boundaries

- Táto fáza nemení aktuálne komponenty ani vzhľad produkcie.
- Integrácia do `globals.css`, Tailwind `@theme` aliases a migrácia komponentov patria do implementačných vertikálnych rezov.
- Manuálny a systémový dark mode sa musia pri integrácii napojiť na existujúci theme mechanizmus; tokeny podporujú `[data-theme]` aj `prefers-color-scheme`.
- Pred nasadením sa overí kontrast reálnych kombinácií, focus, 200 % zoom, reduced motion a mobile touch targets.

