/**
 * Observability background jobov — každý beh (feed, články, Facebook, link health,
 * alerty, tick) zapíše started/finished/duration/status/counts/error.
 * Umožní spätne zistiť "čo sa stalo dnes o 03:00" bez debugovania servera.
 *
 * Úložisko: Redis list `jobs:runs` (posledných MAX_RUNS behov, najnovší prvý)
 * + hash `jobs:last` (posledný beh každého jobu).
 */
import { redisKv, type Kv } from "@/lib/kv";

export type JobStatus = "ok" | "warning" | "error" | "skipped";

export interface JobRun {
  id: string;
  job: string;
  trigger: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: JobStatus;
  counts: Record<string, number>;
  error: string | null;
  dryRun?: boolean;
}

const RUNS_KEY = "jobs:runs";
const LAST_KEY = "jobs:last";
const MAX_RUNS = 600;

/** Chybová správa bez URL a tokenov (logy nesmú obsahovať credentials). */
export function safeErrorMessage(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason ?? "");
  return raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/(api[_-]?key|token|password|secret|access_token)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300) || "Neznáma chyba";
}

export interface JobHandle {
  readonly job: string;
  finish(status: JobStatus, counts?: Record<string, number>, error?: unknown): Promise<JobRun>;
}

export function startJob(job: string, opts: { trigger?: string; dryRun?: boolean; kv?: Kv; now?: () => number } = {}): JobHandle {
  const now = opts.now ?? Date.now;
  const kv = opts.kv ?? redisKv;
  const started = now();
  return {
    job,
    async finish(status, counts = {}, error) {
      const finished = now();
      const run: JobRun = {
        id: `${job}:${started}`,
        job,
        trigger: opts.trigger ?? "manual",
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date(finished).toISOString(),
        durationMs: finished - started,
        status,
        counts,
        error: error == null ? null : safeErrorMessage(error),
        ...(opts.dryRun ? { dryRun: true } : {}),
      };
      // Dry-run beh sa nezapisuje — nesmie meniť produkčný stav ani históriu.
      if (!opts.dryRun) {
        try {
          await kv.lpush(RUNS_KEY, run);
          await kv.ltrim(RUNS_KEY, 0, MAX_RUNS - 1);
          await kv.hset(LAST_KEY, { [job]: run });
        } catch (e) {
          console.error(`[jobs] zápis behu ${job} zlyhal:`, safeErrorMessage(e));
        }
      }
      const line = `[job] ${job} ${status} ${run.durationMs}ms ${JSON.stringify(counts)}${run.error ? ` err=${run.error}` : ""}`;
      if (status === "error") console.error(line);
      else console.log(line);
      return run;
    },
  };
}

export async function getRecentJobRuns(limit = 100, kv: Kv = redisKv): Promise<JobRun[]> {
  try {
    return await kv.lrange<JobRun>(RUNS_KEY, 0, Math.max(0, limit - 1));
  } catch {
    return [];
  }
}

export async function getLastJobRuns(kv: Kv = redisKv): Promise<Record<string, JobRun>> {
  try {
    return (await kv.hgetall<JobRun>(LAST_KEY)) ?? {};
  } catch {
    return {};
  }
}
