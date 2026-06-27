# Design Brief: Home Page Redesign (tipli.sk style)

## Problem

The current homepage feels heavy and editorial — a purple gradient hero with a tech-startup badge, glowing radial background, and large gradient buttons. Users land on a coupon portal and feel like they're on a SaaS product page. The visual noise (gradients, shadows, dark mode variables) works against the primary job: "quickly find a discount code and get on with my shopping."

## Solution

Replace the current aesthetic with a clean, catalogue-style layout inspired by tipli.sk: white background, prominent search bar, tightly-organised shop and coupon grids, and a single warm accent colour (orange). The page should feel like a well-organised discount directory, not a startup landing page.

## Experience Principles

1. **Utility over decoration** — every visual element earns its place by helping the user find deals faster. No decorative gradients, no ambient glows.
2. **Scannable over scrollable** — compact cards in a grid let users survey many options at once. Horizontal scroll carousels are replaced or supplemented with grid layouts.
3. **Warm confidence over cool tech** — orange accent communicates savings and urgency without feeling aggressive. Flat design signals reliability and clarity.

## Aesthetic Direction

- **Philosophy**: Clean catalogue / marketplace flat design (tipli.sk, heureka.sk, zlutozelena.cz)
- **Tone**: Friendly, practical, warm — a helpful neighbour who knows all the best deals
- **Reference points**: tipli.sk (primary), heureka.sk (shop grid), kupon.cz
- **Anti-references**: Current Zlavickovo (SaaS purple gradients), Vercel.com, Apple.com (too editorial/premium)

## Existing Patterns

- **Typography**: Geist Sans (Next.js font), body: Arial fallback. Keep Geist Sans.
- **Colors (current)**: `--text: #1d1d1f`, `--bg: #fff`, `--border: #e0e0e0`, accent: `#7C3AED` (purple) → **replace with `#F97316` (orange)**
- **Spacing**: inline styles, no consistent scale. New design should use 8px base grid (8, 12, 16, 20, 24, 32, 48, 64px).
- **Tailwind v4**: imported but most styles are inline. Continue inline approach for consistency with existing code.
- **Components to reuse**: `Nav`, `Footer`, `SearchBar`, `CouponCard`, `TopCodes`, `AdBanner`, `AiCoupons`
- **Data sources**: `getCouponsFeed`, `getSalesCoupons`, `getLatestSales`, `getActiveFeaturedDynamic`, `getLatestPosts`

## Token Changes

| Token | Old value | New value |
|-------|-----------|-----------|
| Primary accent | `#7C3AED` (purple) | `#F97316` (orange) |
| Primary dark | `#2563EB` (blue) | `#EA580C` (orange-700) |
| Button gradient | `linear-gradient(135deg, #7C3AED, #2563EB)` | solid `#F97316` |
| Hero background | `linear-gradient(180deg, #f5f3ff, #eff6ff, #fff)` | `#fff` (pure white) |
| Badge background | `rgba(124,58,237,0.08)` | `rgba(249,115,22,0.1)` |

## Component Inventory

| Component | Status | Notes |
|-----------|--------|-------|
| `Nav` | Modify | Change logo gradient from purple/blue → orange; keep structure |
| `Footer` | Modify | Make footer dark (`#111` bg, white text) like tipli.sk |
| `SearchBar` | Modify | Larger, more prominent; rounded-full pill style; orange search button |
| `CouponCard` | Modify | Change accent from purple → orange; add discount % badge top-left |
| `ShopGrid` (inline in page.tsx) | Modify | Add "N kupónov" count under shop name; remove colored letter avatars → use initials on light gray bg |
| `Hero section` | Modify | Remove gradient + glow; white bg; orange pill badge; simpler copy |
| `FeaturedShops` | Modify | Keep colored gradient cards but use shop's own color, not purple default |
| `TrendingCodes` | Keep | Minimal change: orange accent on hover |
| `AdBanner` | Keep | Unchanged |
| `LetakyPreview` | Keep | Unchanged |
| `SalesSection` | Keep | Orange accent on "Prejsť na akciu" links |

## Key Interactions

**Search**: User types in central search → orange magnifier button. On focus, the input gains a subtle orange border (`#F97316`). Existing SearchBar component handles the logic.

**Shop card hover**: White card lifts slightly (`box-shadow` increases) and shop name turns orange. "Zobraziť kupóny" text-link appears or becomes visible.

**Coupon card "Získať kód" button**: Solid orange (`#F97316`) with white text. On click: opens affiliate link + reveals code (existing logic in CouponCard).

**Mobile nav**: Hamburger → slide-down menu. Same structure as current.

## Layout Structure (top → bottom)

```
[Nav — white, sticky, logo + links]
[Hero — white bg, centered search, orange badge, 3 trust signals]
[Shop category pills — horizontal scroll, clickable filters]
[Featured shops — colored gradient cards, 2-3 col grid]  
[Popular shops — white card grid, 4-6 col, logo initial + name + "N kódov"]
[Trending codes — horizontal scroll chips (TopCodes)]
[Latest coupons — 3-4 col grid of CouponCards with orange CTA]
[Ad banner]
[Latest sales — compact list or grid]
[Letáky preview — 4 col grid]
[Blog preview — 3 col grid]
[Footer — dark #111 bg, white text]
```

## Responsive Behavior

| Breakpoint | Shops grid | Coupons grid | Hero padding |
|------------|-----------|--------------|--------------|
| Mobile (<640px) | 2 col | 1 col | 40px 16px |
| Tablet (640–1024px) | 3 col | 2 col | 64px 24px |
| Desktop (>1024px) | 5-6 col | 3-4 col | 80px 24px |

Nav collapses to hamburger at <768px (existing behaviour).

## Accessibility Requirements

- Contrast ratio ≥ 4.5:1 for all body text (current `#666` on white = 5.74:1 ✓)
- Orange `#F97316` on white = 2.84:1 — **only use for large text/icons/decorative**, not body copy
- Buttons: minimum 44×44px tap target on mobile
- All interactive cards: `href` anchor (existing), not `onClick` on divs
- `alt` text on any images added

## Out of Scope

- Dark mode (removed per user direction, tipli.sk has none)
- `/kupony/[slug]` shop page (separate task)
- New components beyond modifications listed above
- Actual logo image (keeping text logo for now)
- Backend/API changes
