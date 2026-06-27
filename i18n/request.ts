import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED = ["sk", "cs", "en"];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "sk";
  const locale = SUPPORTED.includes(raw) ? raw : "sk";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
