import { getChampionName, getChampionInternalId } from "./champions";

export type TierLetter = "S+" | "S" | "A" | "B" | "C" | "D";
export type RoleKey = "top" | "jungle" | "mid" | "adc" | "support";

export interface TierEntry {
  championId: number;
  championName: string;
  championIdName: string;
  winRate: number; // 0-100
  pickRate: number; // 0-100
  banRate: number; // 0-100
  tier: TierLetter;
  score: number;
}

const UGG_ROLE: Record<RoleKey, string> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  adc: "adc",
  support: "support",
};

const UGG_ROLE_IN_JSON: Record<RoleKey, string> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  adc: "adc",
  support: "support",
};

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

interface RawEntry {
  win_rate: number;
  pick_rate: number;
  ban_rate: number;
  champion_id: string | number;
  role: string;
}

function assignTier(sorted: { score: number }[], idx: number): TierLetter {
  const ratio = idx / sorted.length;
  if (ratio < 0.05) return "S+";
  if (ratio < 0.15) return "S";
  if (ratio < 0.3) return "A";
  if (ratio < 0.55) return "B";
  if (ratio < 0.8) return "C";
  return "D";
}

export async function fetchTierList(role: RoleKey): Promise<TierEntry[]> {
  const uggRole = UGG_ROLE[role];
  const url = `https://u.gg/lol/${uggRole}-tier-list?rank=master_plus`;

  const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`u.gg returned ${res.status} for ${uggRole}`);
  }
  const html = await res.text();

  // Pull every `{ ... "win_rate":N,"pick_rate":N,"ban_rate":N ... "champion_id":"X","role":"R" ...`
  const entryRegex =
    /\{[^{}]*"win_rate":([0-9.]+),"pick_rate":([0-9.]+),"ban_rate":([0-9.]+)[^{}]*?"champion_id":"?(\d+)"?,"role":"([a-z]+)"/g;

  const raws: RawEntry[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(html)) !== null) {
    const champId = m[4];
    const r = m[5];
    if (r !== UGG_ROLE_IN_JSON[role]) continue;
    if (seen.has(champId)) continue;
    seen.add(champId);
    raws.push({
      win_rate: parseFloat(m[1]),
      pick_rate: parseFloat(m[2]),
      ban_rate: parseFloat(m[3]),
      champion_id: champId,
      role: r,
    });
  }

  if (raws.length === 0) {
    throw new Error(
      `Could not extract champion stats from u.gg (role=${role}). Page may have changed or returned a challenge.`
    );
  }

  // Keep only champions with meaningful pick rate (>=0.2%) — drops 100%-winrate noise from 1-game samples
  const filtered = raws.filter(r => r.pick_rate >= 0.2);

  // Composite score: weighted blend of win/pick/ban
  // Win rate dominates (~50% as 0-100), pick rate matters (popularity), ban rate signals strength
  const scored = filtered.map(r => ({
    raw: r,
    score: (r.win_rate - 50) * 6 + r.pick_rate * 3 + r.ban_rate * 1.5,
  }));
  scored.sort((a, b) => b.score - a.score);

  // Resolve champion names via DDragon and assign tier letters
  const entries: TierEntry[] = [];
  for (let i = 0; i < scored.length; i++) {
    const { raw, score } = scored[i];
    const idNum = typeof raw.champion_id === "string" ? parseInt(raw.champion_id, 10) : raw.champion_id;
    const name = await getChampionName(idNum);
    const idName = await getChampionInternalId(idNum);
    entries.push({
      championId: idNum,
      championName: name,
      championIdName: idName,
      winRate: raw.win_rate,
      pickRate: raw.pick_rate,
      banRate: raw.ban_rate,
      tier: assignTier(scored, i),
      score,
    });
  }

  return entries;
}
