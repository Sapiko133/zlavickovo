/**
 * Facebook content engine — výber, cooldowny, diverzita, copywriting, fronta,
 * idempotentné publikovanie (žiadny duplicitný post pri retry/páde).
 * Spustenie: npx tsx scripts/test-facebook-engine.ts  (bez siete, in-memory KV)
 */
import assert from "node:assert/strict";
import { createMemoryKv } from "../lib/kv.ts";
import { buildPost, HOOKS } from "../lib/social/fb-copy.ts";
import { cooldownReason, scoreCandidate, selectPosts, titleKey, type FbCandidate, type FbHistoryEntry } from "../lib/social/fb-select.ts";
import { FB_QUEUE_KEY, localSlotMs, planDay, publishDue, type FbDeps, type FbQueueItem, type FbSettings } from "../lib/social/fb-queue.ts";
import { GraphError } from "../lib/social/fb-graph.ts";

const DAY = 86_400_000;
// 2026-09-24 10:00 v Bratislave (UTC+2)
let clock = Date.parse("2026-09-24T08:00:00Z");

function cand(p: Partial<FbCandidate> & { key: string; shopSlug: string }): FbCandidate {
  return {
    slug: p.key,
    shopName: p.shopSlug.toUpperCase(),
    title: `${p.shopSlug}: Akcia ${p.key} na vybraný sortiment`,
    discountPct: null,
    validTo: null,
    firstSeenAt: new Date(clock - 10 * DAY).toISOString(),
    imageSource: "dognet-banner",
    affiliateUrl: `https://go.dognet.com/?chid=x&url=https%3A%2F%2F${p.shopSlug}.sk`,
    categoryId: null,
    shopClicks: 0,
    ...p,
  };
}

function hist(p: Partial<FbHistoryEntry> & { key: string; daysAgo: number }): FbHistoryEntry {
  return { slug: p.key, shopSlug: null, categoryId: null, titleKey: null, hookId: null, templateId: null, textHash: null, publishedAt: new Date(clock - p.daysAgo * DAY).toISOString(), ...p };
}

async function main() {
  // ── Skóre: väčšia zľava, čerstvosť, obrázok a popularita obchodu pomáhajú ──
  {
    const base = cand({ key: "a", shopSlug: "alpha" });
    const better = cand({ key: "b", shopSlug: "beta", discountPct: 40, firstSeenAt: new Date(clock - 0.5 * DAY).toISOString(), shopClicks: 50 });
    const s1 = scoreCandidate(base, [], clock, 50).score;
    const s2 = scoreCandidate(better, [], clock, 50).score;
    assert.ok(s2 > s1, "zľava + čerstvosť + popularita = vyššie skóre");
    const generic = cand({ key: "g", shopSlug: "gamma", title: "Akčná ponuka produktov" });
    assert.ok(scoreCandidate(generic, [], clock, 0).parts.quality < 0, "generický titulok je penalizovaný");
  }

  // ── Cooldowny: ponuka, obchod, rovnaký titulok ──
  {
    const c = cand({ key: "x1", shopSlug: "tchibo" });
    assert.equal(cooldownReason(c, [hist({ key: "x1", daysAgo: 10 })], clock), "offer-cooldown");
    assert.equal(cooldownReason(c, [hist({ key: "other", shopSlug: "tchibo", daysAgo: 1 })], clock), "merchant-cooldown");
    assert.equal(cooldownReason(c, [hist({ key: "other", shopSlug: "tchibo", daysAgo: 5 })], clock), null, "po 3 dňoch obchod znova môže");
    assert.equal(cooldownReason(c, [hist({ key: "y", titleKey: titleKey("tchibo", c.title), shopSlug: "x", daysAgo: 20 })], clock), "title-cooldown");
    assert.equal(cooldownReason({ ...c, affiliateUrl: "" }, [], clock), "no-link");
  }

  // ── Výber dňa: diverzita obchodov a kategórií, nová ponuka vstupuje do poolu ──
  {
    const pool = [
      cand({ key: "t1", shopSlug: "tchibo", discountPct: 50, categoryId: "byvanie" }),
      cand({ key: "t2", shopSlug: "tchibo", discountPct: 45, categoryId: "byvanie" }),
      cand({ key: "t3", shopSlug: "tchibo", discountPct: 44, categoryId: "byvanie" }),
      cand({ key: "m1", shopSlug: "sizeer", discountPct: 30, categoryId: "moda" }),
      cand({ key: "m2", shopSlug: "zoot", discountPct: 29, categoryId: "moda" }),
      cand({ key: "e1", shopSlug: "mobilego", discountPct: 10, categoryId: "elektronika" }),
    ];
    const { selected } = selectPosts(pool, [], { count: 3, now: clock });
    const shops = selected.map((s) => s.candidate.shopSlug);
    assert.equal(new Set(shops).size, 3, "žiadny obchod 2× za deň");
    assert.equal(new Set(selected.map((s) => s.candidate.categoryId)).size, 3, "3 rôzne kategórie");
    assert.equal(shops[0], "tchibo");

    // nová ponuka (čerstvá, bez histórie) sa dostane do výberu
    const fresh = cand({ key: "new", shopSlug: "novy", discountPct: 35, categoryId: "sport", firstSeenAt: new Date(clock - 3600_000).toISOString() });
    const withNew = selectPosts([...pool, fresh], [hist({ key: "t1", shopSlug: "tchibo", daysAgo: 1 })], { count: 3, now: clock });
    assert.ok(withNew.selected.some((s) => s.candidate.key === "new"), "nová ponuka môže vstúpiť do výberu");
    assert.ok(!withNew.selected.some((s) => s.candidate.shopSlug === "tchibo"), "merchant cooldown platí");
  }

  // ── Copywriting: iba reálne dáta, varianty, cooldown hookov ──
  {
    const data = { shopName: "Tchibo", title: "Tchibo: Jesenná kolekcia za výhodné ceny", discountPct: 30, validTo: "2026-09-30", categoryId: "moda", firstSeenAt: new Date(clock - DAY).toISOString(), link: "https://go.dognet.com/?url=x" };
    const p1 = buildPost(data, { seed: "a|2026-09-24", now: clock });
    assert.ok(p1.text.includes("Tchibo"));
    assert.ok(p1.text.includes(data.title) || p1.text.includes(`„${data.title}“`), "telo = reálny titulok");
    assert.ok(p1.text.includes(data.link), "odkaz v poste");
    assert.ok(p1.text.includes("30"), "reálna zľava");
    assert.ok(!/garant|určite funguje|100 %/i.test(p1.text), "žiadne tvrdenie o garancii");
    assert.ok(/Platí do 30\. ?9\. ?2026/.test(p1.text), "platnosť z dát");
    const texts = new Set(Array.from({ length: 12 }, (_, i) => buildPost(data, { seed: `s${i}`, now: clock }).templateId));
    assert.ok(texts.size >= 5, `šablóny sa striedajú (${texts.size})`);
    const avoid = new Set(HOOKS.map((h) => h.id).filter((id) => id !== "tip"));
    assert.equal(buildPost(data, { seed: "z", now: clock, avoidHooks: avoid }).hookId, "tip", "nedávno použité hooky sa vynechajú");
    // hook s % sa použije len keď zľavu máme
    const noPct = buildPost({ ...data, discountPct: null, validTo: null }, { seed: "q", now: clock, avoidHooks: new Set(HOOKS.map((h) => h.id).filter((id) => id !== "pct" && id !== "cheaper")) });
    assert.ok(!/zľava až/.test(noPct.text), "bez zľavy sa zľava nevymýšľa");
    assert.ok(noPct.text.includes("Podmienky a platnosť si over priamo v obchode."));
  }

  // ── Fronta: plán raz za deň, publikovanie max 1 za tick, rozostup ──
  const settings: FbSettings = { postsPerDay: 3, slots: ["08:00", "12:00", "17:00"], minGapMin: 120, maxPerTick: 1, quietStartHour: 22, quietEndHour: 7 };
  function deps(kv = createMemoryKv(), over: Partial<FbDeps> = {}) {
    const published: string[] = [];
    const d: FbDeps & { published: string[] } = {
      kv,
      now: () => clock,
      published,
      loadCandidates: async () => [
        cand({ key: "k1", shopSlug: "s1", discountPct: 40, categoryId: "moda" }),
        cand({ key: "k2", shopSlug: "s2", discountPct: 30, categoryId: "sport" }),
        cand({ key: "k3", shopSlug: "s3", discountPct: 20, categoryId: "deti" }),
        cand({ key: "k4", shopSlug: "s4", discountPct: 10, categoryId: "knihy" }),
      ],
      loadLegacyHistory: async () => [],
      checkEligible: async () => null,
      publish: async (item) => { published.push(item.id); return `post_${item.id}`; },
      verify: async () => null,
      imageUrlFor: (slug) => `https://www.zlavickovo.sk/akcie/${slug}/opengraph-image`,
      linkFor: (c) => `https://www.zlavickovo.sk/akcie/${c.slug}`,
      ...over,
    };
    return d;
  }

  {
    clock = Date.parse("2026-09-24T05:30:00Z"); // 07:30 lokálne
    const d = deps();
    const plan = await planDay(d, settings);
    assert.equal(plan.status, "planned");
    assert.equal(plan.items.length, 3);
    assert.equal(new Set(plan.items.map((i) => i.shopSlug)).size, 3);
    assert.equal(plan.items[0].scheduledAt, new Date(localSlotMs("2026-09-24", "08:00")).toISOString());
    assert.equal(plan.items[0].scheduledAt, "2026-09-24T06:00:00.000Z", "08:00 v Bratislave = 06:00 UTC (letný čas)");
    for (const it of plan.items) {
      assert.equal(it.link, `https://www.zlavickovo.sk/akcie/${it.slug}`, "post vedie na stránku akcie");
      assert.ok(it.text.includes(it.link) && !/dognet|ehub|cj\.com|affial/i.test(it.text), "v texte nie je affiliate URL");
    }
    const again = await planDay(d, settings);
    assert.equal(again.status, "already-planned", "plán dňa je idempotentný");

    // 07:30 — slot 08:00 ešte nie je splatný
    assert.equal((await publishDue(d, settings)).status, "idle");
    clock = Date.parse("2026-09-24T06:10:00Z");
    const p1 = await publishDue(d, settings);
    assert.equal(p1.status, "published");
    assert.equal(d.published.length, 1, "max 1 post za tick");
    // hneď ďalší tick — rozostup 120 min
    clock = Date.parse("2026-09-24T10:05:00Z");
    assert.equal((await publishDue(d, settings)).status, "published");
    clock = Date.parse("2026-09-24T10:30:00Z");
    assert.equal((await publishDue(d, settings)).status, "gap", "min. rozostup medzi postami");
    // tichý čas
    clock = Date.parse("2026-09-24T21:00:00Z"); // 23:00 lokálne
    assert.equal((await publishDue(d, settings)).status, "quiet-hours");
    assert.equal(d.published.length, 2);
  }

  // ── Ukončená ponuka pred publikovaním → skipped, nepublikuje sa ──
  {
    clock = Date.parse("2026-09-25T05:30:00Z");
    const d = deps(createMemoryKv(), { checkEligible: async () => "akcia skončila" });
    await planDay(d, settings);
    clock = Date.parse("2026-09-25T06:05:00Z");
    const r = await publishDue(d, settings);
    assert.equal(r.status, "skipped");
    assert.equal(d.published.length, 0, "expirovaná ponuka sa nepublikuje");
    const items = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!);
    assert.ok(items.some((i) => i.status === "skipped" && i.error === "akcia skončila"));
  }

  // ── Pád/timeout po odoslaní → žiadny duplicitný post pri retry ──
  {
    clock = Date.parse("2026-09-26T05:30:00Z");
    let publishCalls = 0;
    const d = deps(createMemoryKv(), {
      publish: async () => { publishCalls++; throw new GraphError("Facebook publish: timeout", { ambiguous: true, retryable: true }); },
      verify: async () => "post_found_123",
    });
    await planDay(d, settings);
    clock = Date.parse("2026-09-26T06:05:00Z");
    const r1 = await publishDue(d, settings);
    assert.equal(r1.status, "unknown", "nejasný výsledok");
    assert.equal(publishCalls, 1);
    // tick o 5 min — položka je "publishing", nesmie sa publikovať znova
    clock += 5 * 60_000;
    await publishDue(d, settings);
    assert.equal(publishCalls, 1, "počas publishing sa neopakuje");
    // tick po 15 min — overenie cez Graph API nájde post → published, bez repostu
    clock += 15 * 60_000;
    const r3 = await publishDue(d, settings);
    assert.equal(r3.recovered, 1);
    assert.equal(publishCalls, 1, "overený post sa nereposlal");
    const items = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!);
    const done = items.find((i) => i.postId === "post_found_123");
    assert.ok(done && done.status === "published");
  }

  // ── Overenie nemožné → failed (manuálna kontrola), nikdy slepý repost ──
  {
    clock = Date.parse("2026-09-27T05:30:00Z");
    let publishCalls = 0;
    const d = deps(createMemoryKv(), {
      publish: async () => { publishCalls++; throw new GraphError("Facebook publish: timeout", { ambiguous: true, retryable: true }); },
      verify: async () => { throw new GraphError("Facebook verify: (200) permission", { code: 200 }); },
    });
    await planDay(d, settings);
    clock = Date.parse("2026-09-27T06:05:00Z");
    await publishDue(d, settings);
    clock += 30 * 60_000;
    await publishDue(d, settings);
    const items = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!);
    assert.ok(items.some((i) => i.status === "failed" && /manuálne|ručne/.test(i.error ?? "")));
    assert.equal(publishCalls, 1);
  }

  // ── Dočasná chyba API (nie nejasná) → preplánovanie s backoffom, max 3 pokusy ──
  {
    clock = Date.parse("2026-09-28T05:30:00Z");
    const d = deps(createMemoryKv(), { publish: async () => { throw new GraphError("Facebook publish: (2) temporary", { code: 2, retryable: true }); } });
    await planDay(d, settings);
    clock = Date.parse("2026-09-28T06:05:00Z");
    const r = await publishDue(d, settings);
    assert.equal(r.status, "retry");
    const it = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!).find((i) => i.retryCount === 1)!;
    assert.ok(Date.parse(it.scheduledAt) > clock, "retry je naplánovaný neskôr");
    // token neplatný (190) → failed bez retry
    const d2 = deps(createMemoryKv(), { publish: async () => { throw new GraphError("Facebook publish: token expired (190)", { code: 190 }); } });
    clock = Date.parse("2026-09-29T05:30:00Z");
    await planDay(d2, settings);
    clock = Date.parse("2026-09-29T06:05:00Z");
    assert.equal((await publishDue(d2, settings)).status, "failed");
  }

  // ── Položka naplánovaná so starým affiliate odkazom → pred publikovaním prepísaná na Zlavickovo ──
  {
    clock = Date.parse("2026-10-01T05:30:00Z");
    const d = deps();
    await planDay(d, settings);
    const queued = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!);
    const aff = "https://go.dognet.com/?chid=x&url=https%3A%2F%2Fs1.sk";
    const legacy = queued[0];
    const publicLink = legacy.link;
    legacy.text = legacy.text.split(publicLink).join(aff);
    legacy.link = aff;
    await d.kv.hset(FB_QUEUE_KEY, { [legacy.id]: legacy });
    const sent: FbQueueItem[] = [];
    d.publish = async (item) => { sent.push({ ...item }); return "post_x"; };
    clock = Date.parse("2026-10-01T06:05:00Z");
    assert.equal((await publishDue(d, settings)).status, "published");
    assert.equal(sent[0].link, publicLink);
    assert.ok(sent[0].text.includes(publicLink) && !sent[0].text.includes("dognet"), "legacy affiliate odkaz prepísaný");
    // cudzí odkaz, ktorý nejde prepísať → nepublikuje sa
    const other = Object.values((await d.kv.hgetall<FbQueueItem>(FB_QUEUE_KEY))!).find((i) => i.status === "scheduled")!;
    other.text += "\nhttps://www.awin1.com/cread.php?x=1";
    other.scheduledAt = new Date(clock).toISOString();
    await d.kv.hset(FB_QUEUE_KEY, { [other.id]: other });
    clock += 3 * 3600_000;
    const r = await publishDue(d, settings);
    assert.equal(r.status, "skipped");
    assert.equal(r.error, "externý odkaz v texte postu");
    assert.equal(sent.length, 1);
  }

  // ── Dry-run: nič sa nezapíše ani nepublikuje ──
  {
    clock = Date.parse("2026-09-30T05:30:00Z");
    const kv = createMemoryKv();
    const d = deps(kv);
    const plan = await planDay(d, settings, { dryRun: true });
    assert.equal(plan.items.length, 3);
    assert.equal(kv.writes, 0);
    assert.equal(d.published.length, 0);
  }

  console.log("Facebook engine tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
