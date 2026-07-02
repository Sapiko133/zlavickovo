import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Staré slugy z interných Dognet názvov kampaní (napr. "Allegro.sk (for voucher)")
// → čisté slugy po normalizácii cez cleanDognetShopName (lib/shop-name.ts).
const RENAMED_SHOP_SLUGS: Record<string, string> = {
  "allegrosk-for-voucher": "allegro",
  "bonprixsk-for-voucher-publishers": "bonprix",
  "4fstoresk-voucher-publisher": "4fstore",
  "4fstoresk-cashback-publisher": "4fstore",
  "4fstoresk-content-publisher": "4fstore",
  "4fstorecz-voucher-publisher": "4fstore",
  "4fstorecz-cashback-publisher": "4fstore",
  "4fstorecz-content-publisher": "4fstore",
  "4fstorero-voucher-publisher": "4fstore",
  "4fstorero-cashback-publisher": "4fstore",
  "4fstorero-content-publisher": "4fstore",
  "si-housebrandcom-for-voucher": "si-housebrand",
  "si-housebrandcom-for-content": "si-housebrand",
  "si-housebrandcom-for-cashback": "si-housebrand",
  "balabimsk-povodne-uzasnedarcekysk": "balabim",
  "feelpearlscz-povodne-justpearlscz": "feelpearls",
  "feelpearlssk-povodne-justpearlssk": "feelpearls",
  "desirelro-povodne-desirelcomro": "desirel",
  "desirelsi-povodne-desirelcomsi": "desirel",
  "desirelhr-povodne-desirelcomhr": "desirel",
  "papiloracz-povodne-obraznastenucz": "papilora",
  "papilorask-povodne-obraznastenusk": "papilora",
  "artmiesk-povodne-maliarskeplatnosk": "artmie",
  "zarovkycz-povodne-kupzarovkycz": "zarovky",
  "avitacz-povodne-avitatop": "avita",
  "supershapesk-povodne-eshopcvictesk": "supershape",
  "hairburstcomhu-hu-povodne-huhairburstcom": "hairburstcomhu-hu",
  "bestylehu-shutting-down-2972026": "bestyle",
  "zapatossk-shutting-down-3172026": "zapatos",
  "zapatoscz-shutting-down-3172026": "zapatos",
};

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": ["./public/data/**/*"],
  },
  async redirects() {
    // aj -cz variant — stránka obchodu deklaruje cs alternate /kupony/[slug]-cz
    return Object.entries(RENAMED_SHOP_SLUGS).flatMap(([from, to]) => [
      { source: `/kupony/${from}`, destination: `/kupony/${to}`, permanent: true },
      { source: `/kupony/${from}-cz`, destination: `/kupony/${to}-cz`, permanent: true },
    ]);
  },
};

export default withNextIntl(nextConfig);
