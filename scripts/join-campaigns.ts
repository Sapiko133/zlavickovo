// Spusti: npx tsx --env-file=.env.local scripts/join-campaigns.ts
const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;

const EMAIL    = process.env.DOGNET_EMAIL;
const PASSWORD = process.env.DOGNET_PASSWORD;

async function getToken() {
  if (!EMAIL || !PASSWORD) {
    console.error("❌ Chýba DOGNET_EMAIL alebo DOGNET_PASSWORD v .env.local");
    process.exit(1);
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  return data.token || data.data?.token;
}

async function getAllAvailableCampaigns(token: string) {
  const allCampaigns: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`📄 Načítavam stránku ${page}...`);
    const res = await fetch(`${API_BASE}/campaigns/available?page=${page}&per-page=100`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
    const data = await res.json();
    const campaigns = data.data || [];

    if (campaigns.length === 0) {
      hasMore = false;
    } else {
      allCampaigns.push(...campaigns);
      page++;
      // Počkaj 500ms aby sme neprekročili rate limit
      await new Promise(r => setTimeout(r, 500));
    }

    // Ak je posledná stránka
    if (data.meta && page > data.meta.last_page) {
      hasMore = false;
    }
  }

  return allCampaigns;
}

async function joinCampaign(token: string, campaignId: number) {
  const res = await fetch(`${API_BASE}/ad-channels-campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      campaign_id: campaignId,
      ad_channel_id: AD_CHANNEL_ID,
      note: "AI kupónový portál zlavickovo.sk - zobrazujeme aktuálne zľavové kódy s affiliate odkazmi pre slovenský a český trh.",
    }),
  });
  return res.json();
}

async function main() {
  console.log("🔑 Prihlasujem sa do Dognet...");
  const token = await getToken();
  if (!token) {
    console.error("❌ Login zlyhal");
    process.exit(1);
  }
  console.log("✅ Prihlásený");

  console.log("📋 Sťahujem VŠETKY dostupné kampane...");
  const campaigns = await getAllAvailableCampaigns(token);
  console.log(`✅ Nájdených ${campaigns.length} kampaní celkovo`);

  if (campaigns.length === 0) {
    console.log("ℹ️ Žiadne dostupné kampane na joinovanie");
    process.exit(0);
  }

  console.log("\n🚀 Joinujem kampane...\n");
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    try {
      const result = await joinCampaign(token, campaign.id);
      if (result.error) {
        if (result.error.includes("already") || result.error.includes("exist")) {
          console.log(`⏭️  ${campaign.name} – už joinnuté`);
          skipped++;
        } else {
          console.log(`⚠️  ${campaign.name} – ${result.error}`);
          failed++;
        }
      } else {
        console.log(`✅ ${campaign.name}`);
        success++;
      }
      // Počkaj 300ms aby sme neprekročili rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e: any) {
      console.log(`❌ ${campaign.name} – ${e.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Výsledok:`);
  console.log(`   ✅ Úspešné: ${success}`);
  console.log(`   ⏭️  Preskočené (už joinnuté): ${skipped}`);
  console.log(`   ❌ Neúspešné: ${failed}`);
  console.log(`   📋 Celkovo: ${campaigns.length}`);
}

main();