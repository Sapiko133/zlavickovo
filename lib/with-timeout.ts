/**
 * Bezpečnostný časový strop pre render-path volania (ISR/SSR).
 * Ak sa promise nedokončí do `ms`, vráti `fallback` — stránka sa nikdy nezablokuje
 * na pomalom externom volaní (AI, live affiliate fetch, studená DB/cache).
 * Pôvodný promise beží ďalej (jeho výsledok sa môže medzičasom nacachovať).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
