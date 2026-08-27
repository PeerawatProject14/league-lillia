/**
 * Recent-form aggregation shared by /roast, /hall and /versus: one Riot ID in,
 * a normalised set of recent games plus the derived stats those commands need.
 */
import { getRiotAccount, getMatchIds, getMatchDetails } from "./riot";
import { getChampionName } from "./champions";
import { MatchSummary } from "./gemini";
import { VersusSideInput } from "./versusImage";
import { ShameAward } from "./hallOfShameImage";

export interface RecentGame {
  matchId: string;
  championName: string;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  visionScore: number;
  damage: number;
  gold: number;
  durationMinutes: number;
}

export interface RecentForm {
  gameName: string;
  tagLine: string;
  games: RecentGame[];
}

/** Splits "Name#Tag" into its parts, defaulting to the TH tag line. */
export function parseRiotId(input: string): { gameName: string; tagLine: string } {
  const parts = input.split("#");
  if (parts.length < 2) {
    return { gameName: parts[0].trim(), tagLine: "TH2" };
  }
  return {
    gameName: parts[0].trim(),
    tagLine: parts[1].trim(),
  };
}

export async function collectRecentForm(summonerInput: string, count: number): Promise<RecentForm> {
  const { gameName, tagLine } = parseRiotId(summonerInput);
  const account = await getRiotAccount(gameName, tagLine);
  const matchIds = await getMatchIds(account.puuid, count);
  const details = await getMatchDetails(matchIds);

  const games: RecentGame[] = [];
  for (const match of details) {
    const p = match.info.participants.find(x => x.puuid === account.puuid);
    if (!p) continue;
    const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
    const durationMinutes = match.info.gameDuration / 60;
    games.push({
      matchId: match.metadata.matchId,
      championName: await getChampionName(p.championId),
      role: p.individualPosition || "UNKNOWN",
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs,
      csPerMin: durationMinutes > 0 ? cs / durationMinutes : 0,
      visionScore: p.visionScore,
      damage: p.totalDamageDealtToChampions,
      gold: p.goldEarned,
      durationMinutes,
    });
  }

  return { gameName: account.gameName, tagLine: account.tagLine, games };
}

export function kdaRatio(g: { kills: number; deaths: number; assists: number }): number {
  return (g.kills + g.assists) / Math.max(g.deaths, 1);
}

export function averageKda(games: RecentGame[]): string {
  const k = games.reduce((s, g) => s + g.kills, 0);
  const a = games.reduce((s, g) => s + g.assists, 0);
  const d = games.reduce((s, g) => s + g.deaths, 0);
  if (d === 0) return "Perfect";
  return ((k + a) / d).toFixed(2);
}

/** Champion the player leaned on most across the sample. */
export function mostPlayedChampion(games: RecentGame[]): string {
  const tally = new Map<string, number>();
  for (const g of games) tally.set(g.championName, (tally.get(g.championName) ?? 0) + 1);
  let best = games[0]?.championName ?? "Teemo";
  let bestCount = 0;
  for (const [name, n] of tally) {
    if (n > bestCount) {
      best = name;
      bestCount = n;
    }
  }
  return best;
}

export function toMatchSummaries(games: RecentGame[]): MatchSummary[] {
  return games.map(g => ({
    championName: g.championName,
    role: g.role,
    win: g.win,
    kills: g.kills,
    deaths: g.deaths,
    assists: g.assists,
    kda: g.deaths === 0 ? "Perfect" : kdaRatio(g).toFixed(2),
    cs: g.cs,
    csPerMin: g.csPerMin,
    visionScore: g.visionScore,
    damageDealt: g.damage,
    goldEarned: g.gold,
    gameDurationMinutes: g.durationMinutes,
  }));
}

const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/** Every champion played in the sample, most games first. */
export function championTallies(games: RecentGame[]): { name: string; games: number; wins: number }[] {
  const byChampion = new Map<string, { name: string; games: number; wins: number }>();
  for (const g of games) {
    const entry = byChampion.get(g.championName) ?? { name: g.championName, games: 0, wins: 0 };
    entry.games += 1;
    if (g.win) entry.wins += 1;
    byChampion.set(g.championName, entry);
  }
  return [...byChampion.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

/** Games per lane, in map order, skipping lanes never played. */
export function roleTallies(games: RecentGame[]): { role: string; games: number }[] {
  const counts = new Map<string, number>();
  for (const g of games) counts.set(g.role, (counts.get(g.role) ?? 0) + 1);
  const known = ROLE_ORDER.filter(r => counts.has(r)).map(r => ({ role: r, games: counts.get(r)! }));
  const other = [...counts.entries()]
    .filter(([r]) => !ROLE_ORDER.includes(r))
    .map(([role, games]) => ({ role, games }));
  return [...known, ...other];
}

export function versusSide(form: RecentForm): VersusSideInput {
  const games = form.games;
  const n = Math.max(games.length, 1);
  return {
    gameName: form.gameName,
    tagLine: form.tagLine,
    topChampion: mostPlayedChampion(games),
    games: games.length,
    wins: games.filter(g => g.win).length,
    avgKda: averageKda(games),
    avgDeaths: games.reduce((s, g) => s + g.deaths, 0) / n,
    csPerMin: games.reduce((s, g) => s + g.csPerMin, 0) / n,
    visionScore: games.reduce((s, g) => s + g.visionScore, 0) / n,
    damage: games.reduce((s, g) => s + g.damage, 0) / n,
    champions: championTallies(games),
    roles: roleTallies(games),
  };
}

/** Picks the single most damning game for each category. */
export function buildShameAwards(games: RecentGame[]): ShameAward[] {
  const awards: ShameAward[] = [];
  const worstBy = (pick: (g: RecentGame) => number, lowest: boolean): RecentGame =>
    games.reduce((worst, g) => {
      const better = lowest ? pick(g) < pick(worst) : pick(g) > pick(worst);
      return better ? g : worst;
    }, games[0]);

  const mostDeaths = worstBy(g => g.deaths, false);
  awards.push({
    title: "ราชาอินติง",
    subtitle: "ตายเยอะที่สุดในเกมเดียว",
    value: `${mostDeaths.deaths} ตาย`,
    championName: mostDeaths.championName,
    win: mostDeaths.win,
  });

  const worstKda = worstBy(g => kdaRatio(g), true);
  awards.push({
    title: "KDA ติดลบทางใจ",
    subtitle: `${worstKda.kills}/${worstKda.deaths}/${worstKda.assists} ในเกมเดียว`,
    value: kdaRatio(worstKda).toFixed(2),
    championName: worstKda.championName,
    win: worstKda.win,
  });

  const worstCs = worstBy(g => g.csPerMin, true);
  awards.push({
    title: "นักสวนแห่งชาติ",
    subtitle: "ฟาร์มน้อยที่สุดต่อนาที",
    value: `${worstCs.csPerMin.toFixed(1)}/min`,
    championName: worstCs.championName,
    win: worstCs.win,
  });

  const worstVision = worstBy(g => g.visionScore, true);
  awards.push({
    title: "ตาบอดแม้มีวอร์ด",
    subtitle: "vision score ต่ำที่สุด",
    value: `${worstVision.visionScore}`,
    championName: worstVision.championName,
    win: worstVision.win,
  });

  const worstDamage = worstBy(g => g.damage, true);
  awards.push({
    title: "ตีเบาเหมือนลูบ",
    subtitle: "ดาเมจใส่ฮีโร่น้อยที่สุด",
    value: `${(worstDamage.damage / 1000).toFixed(1)}k`,
    championName: worstDamage.championName,
    win: worstDamage.win,
  });

  const losses = games.filter(g => !g.win);
  if (losses.length > 0) {
    const longestLoss = losses.reduce((a, b) => (b.durationMinutes > a.durationMinutes ? b : a), losses[0]);
    awards.push({
      title: "เสียเวลาชีวิต",
      subtitle: "เกมที่แพ้แบบยาวนานที่สุด",
      value: `${Math.floor(longestLoss.durationMinutes)} นาที`,
      championName: longestLoss.championName,
      win: false,
    });
  }

  return awards;
}
