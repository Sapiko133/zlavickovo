// Spustí všetky scripts/test-*.ts (čisté unit testy bez siete) a zhrnie výsledok.
// Použitie: npm test
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync(new URL(".", import.meta.url)).filter((f) => /^test-.*\.ts$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync("npx", ["tsx", `scripts/${f}`], { encoding: "utf8", shell: process.platform === "win32" });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${f}`);
  if (!ok) console.log((r.stdout + r.stderr).split("\n").filter((l) => !l.includes("[Upstash Redis]")).slice(-25).join("\n"));
}
console.log(`\n${files.length - failed}/${files.length} test súborov prešlo`);
process.exit(failed ? 1 : 0);
