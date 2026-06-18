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

const RAW_DATA_URL = (role: RoleKey) =>
  `https://raw.githubusercontent.com/PeerawatProject14/league-lillia/main/data/tier-list-${role}.json`;

interface RawEntry {
  championId: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  role: string;
}

// Score blends win rate (dominant), pick rate (popularity proxy), and ban rate
// (community-perceived strength). This is the formula most public LoL tier sites
// converge on — different weights, but the same three signals.
function computeScore(winRate: number, pickRate: number, banRate: number): number {
  return (winRate - 50) * 5 + pickRate * 1.5 + banRate * 0.8;
}

// Percentile-based tier buckets so the distribution stays consistent across roles
// regardless of how many champs the role has.
function assignTierByRank(idx: number, total: number): TierLetter {
  const ratio = idx / total;
  if (ratio < 0.07) return "S+";
  if (ratio < 0.22) return "S";
  if (ratio < 0.45) return "A";
  if (ratio < 0.68) return "B";
  if (ratio < 0.88) return "C";
  return "D";
}

export async function fetchTierList(role: RoleKey): Promise<TierEntry[]> {
  const url = RAW_DATA_URL(role);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`tier list data unavailable (${res.status}). GitHub Action may not have run yet.`);
  }
  const payload = (await res.json()) as { entries: RawEntry[] };
  const raws = payload.entries ?? [];

  if (raws.length === 0) {
    throw new Error(`No entries in tier list data for ${role}`);
  }

  // Drop noise: champs with very low pick rate (single-game 100% WR samples).
  const filtered = raws.filter(r => r.pickRate >= 0.5);

  const scored = filtered.map(r => ({
    raw: r,
    score: computeScore(r.winRate, r.pickRate, r.banRate),
  }));
  scored.sort((a, b) => b.score - a.score);

  const entries: TierEntry[] = [];
  for (let i = 0; i < scored.length; i++) {
    const { raw, score } = scored[i];
    const name = await getChampionName(raw.championId);
    const idName = await getChampionInternalId(raw.championId);
    entries.push({
      championId: raw.championId,
      championName: name,
      championIdName: idName,
      winRate: raw.winRate,
      pickRate: raw.pickRate,
      banRate: raw.banRate,
      tier: assignTierByRank(i, scored.length),
      score,
    });
  }

  return entries;
}
