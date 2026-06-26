const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;;

async function getToken() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mirosamud@gmail.com",
      password: "Sshady1339267.",
    }),
  });
  const data = await res.json();
  return data.token || data.data?.token;
}

async function getAvailableCampaigns(token: string) {
  const res = await fetch(`${API_BASE}/campaigns/available`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  const data = await res.json();
  return data.data || [];
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
      note: "Kupónový portál zlavickovo.vercel.app – zobrazujeme aktuálne zľavové kódy a akcie.",
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

  console.log("📋 Sťahujem dostupné kampane...");
  const campaigns = await getAvailableCampaigns(token);
  console.log(`✅ Nájdených ${campaigns.length} kampaní`);

  if (campaigns.length === 0) {
    console.log("ℹ️ Žiadne dostupné kampane na joinovanie");
    process.exit(0);
  }

  console.log("\n🚀 Joinujem kampane...\n");
  let success = 0;
  let failed = 0;

  for (const campaign of campaigns) {
    try {
      const result = await joinCampaign(token, campaign.id);
      if (result.error) {
        console.log(`⚠️  ${campaign.name} – ${result.error}`);
        failed++;
      } else {
        console.log(`✅ ${campaign.name}`);
        success++;
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.log(`❌ ${campaign.name} – ${e.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Výsledok: ${success} úspešných, ${failed} neúspešných`);
}

main();