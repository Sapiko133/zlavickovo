// Vercel Hobby: každý cron záznam beží max. 1×/deň → rovnaký tick pod viacerými
// cestami (/api/cron/tick/a … /d) = viac denných slotov bez plateného plánu.
export { GET } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
