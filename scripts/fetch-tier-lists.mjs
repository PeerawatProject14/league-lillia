// Fetches tier list data for all 5 roles from u.gg and writes JSON to data/.
// Designed to be run on a schedule by .github/workflows/update-tier-lists.yml.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");

const ROLES = ["top", "jungle", "mid", "adc", "support"];
const UGG_SLUG = {
  top: "top-lane",
  jungle: "jungle",
  mid: "mid-lane",
  adc: "adc",
  support: "support",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

const ENTRY_REGEX =
  /\{[^{}]*"win_rate":([0-9.]+),"pick_rate":([0-9.]+),"ban_rate":([0-9.]+)[^{}]*?"champion_id":"?(\d+)"?,"role":"([a-z]+)"/g;

function curlGet(url) {
  // Node fetch gets Cloudflare-403'd because of TLS fingerprint; shell curl works.
  return new Promise((resolve, reject) => {
    const args = [
      "-sS",
      "--fail",
      "--compressed",
      ...Object.entries(BROWSER_HEADERS).flatMap(([k, v]) => ["-H", `${k}: ${v}`]),
      url,
    ];
    const child = spawn("curl", args);
    const chunks = [];
    const errChunks = [];
    child.stdout.on("data", c => chunks.push(c));
    child.stderr.on("data", c => errChunks.push(c));
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`curl exited ${code}: ${Buffer.concat(errChunks).toString().slice(0, 200)}`));
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

async function fetchWithRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await curlGet(url);
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
  throw lastErr;
}

async function fetchRole(role) {
  const slug = UGG_SLUG[role] ?? role;
  const url = `https://u.gg/lol/${slug}-tier-list?rank=master_plus`;
  const html = await fetchWithRetry(url);

  const entries = [];
  const seen = new Set();
  let m;
  while ((m = ENTRY_REGEX.exec(html)) !== null) {
    const champId = m[4];
    const r = m[5];
    if (r !== role) continue;
    if (seen.has(champId)) continue;
    seen.add(champId);
    entries.push({
      championId: parseInt(champId, 10),
      winRate: parseFloat(m[1]),
      pickRate: parseFloat(m[2]),
      banRate: parseFloat(m[3]),
      role: r,
    });
  }
  ENTRY_REGEX.lastIndex = 0;

  if (entries.length === 0) throw new Error(`No entries parsed for ${role}`);
  return entries;
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const summary = { fetchedAt: new Date().toISOString(), roles: {} };

  for (const role of ROLES) {
    try {
      const entries = await fetchRole(role);
      const filename = path.join(DATA_DIR, `tier-list-${role}.json`);
      const payload = {
        role,
        fetchedAt: new Date().toISOString(),
        source: "u.gg",
        rank: "master_plus",
        entries,
      };
      await fs.writeFile(filename, JSON.stringify(payload, null, 2));
      summary.roles[role] = entries.length;
      console.log(`✓ ${role}: ${entries.length} champions`);
    } catch (e) {
      console.error(`✗ ${role}: ${e.message}`);
      summary.roles[role] = `error: ${e.message}`;
    }
    // small delay between fetches so u.gg doesn't flag us
    await new Promise(r => setTimeout(r, 1500));
  }

  await fs.writeFile(path.join(DATA_DIR, "tier-list-summary.json"), JSON.stringify(summary, null, 2));
  console.log("Summary:", summary);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
