const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Region configuration (defaulting to TH / Asia / SEA)
const PLATFORM_URL = "https://sg2.api.riotgames.com"; // For TH server endpoint (consolidated to SG2)
const ACCOUNT_REGION_URL = "https://asia.api.riotgames.com"; // For Account v1
const MATCH_REGION_URL = "https://sea.api.riotgames.com";     // For Match v5 (Southeast Asia)

function getHeaders(): HeadersInit {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not defined in environment variables");
  }
  return {
    "X-Riot-Token": RIOT_API_KEY,
  };
}

/**
 * Fetches a Riot endpoint, retrying once when we get rate limited (429).
 * Match history pages fire ~20 requests at a time, so hitting the per-second
 * bucket is realistic — honour Retry-After instead of failing the whole page.
 */
async function riotFetch(url: string): Promise<Response> {
  let res = await fetch(url, { headers: getHeaders() });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    const waitMs = Math.min(Math.max(retryAfter, 1), 10) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitMs));
    res = await fetch(url, { headers: getHeaders() });
  }

  return res;
}

/** Carries the HTTP status so callers can turn it into a human message. */
export class RiotApiError extends Error {
  constructor(public readonly status: number, public readonly endpoint: string) {
    super(`${endpoint} returned status ${status}`);
    this.name = "RiotApiError";
  }
}

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface LeagueEntry {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  summonerId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championPointsSinceLastLevel: number;
  championPointsUntilNextLevel: number;
}

export interface PerkStyleSelection {
  perk: number;
  var1: number;
  var2: number;
  var3: number;
}

export interface PerkStyle {
  description: string; // "primaryStyle" | "subStyle"
  style: number; // tree id
  selections: PerkStyleSelection[];
}

export interface MatchParticipant {
  puuid: string;
  summonerId: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championId: number;
  championName: string;
  champLevel: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  totalMinionsKilled: number;
  neutralMinionsKilled: number; // jungle monsters
  visionScore: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  individualPosition: string; // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  teamId: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number; // trinket
  summoner1Id: number;
  summoner2Id: number;
  perks: {
    styles: PerkStyle[];
    statPerks?: { defense: number; flex: number; offense: number };
  };
  pentaKills: number;
  quadraKills: number;
  /** Riot's derived stats. Present on modern matches but treated as optional. */
  challenges?: {
    teamDamagePercentage?: number;
    killParticipation?: number;
    soloKills?: number;
  };
}

export interface MatchDetail {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameMode: string;
    gameDuration: number; // in seconds
    gameCreation: number; // epoch ms the game started
    queueId: number;
    participants: MatchParticipant[];
  };
}

export interface ActiveGameParticipant {
  summonerId: string;
  championId: number;
  profileIconId: number;
  teamId: number;
  puuid: string;
  riotId: string; // format: gameName#tagLine
  spell1Id: number;
  spell2Id: number;
  bot?: boolean;
  perks?: {
    perkIds: number[];
    perkStyle: number;
    perkSubStyle: number;
  };
}

export interface ActiveGameInfo {
  gameId: number;
  gameType: string;
  gameStartTime: number;
  mapId: number;
  gameLength: number;
  platformId: string;
  gameMode: string;
  participants: ActiveGameParticipant[];
}

/**
 * Gets the PUUID of a Riot account using their Riot ID (gameName#tagLine)
 */
export async function getRiotAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
  const url = `${ACCOUNT_REGION_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Riot Account API");
  }
  
  return res.json();
}

/**
 * Gets summoner profile information using PUUID
 */
export async function getSummonerByPuuid(puuid: string): Promise<Summoner> {
  const url = `${PLATFORM_URL}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Summoner API");
  }
  
  return res.json();
}

/**
 * Gets league entries (ranks) for a given PUUID
 */
export async function getLeagueEntries(puuid: string): Promise<LeagueEntry[]> {
  const url = `${PLATFORM_URL}/lol/league/v4/entries/by-puuid/${puuid}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "League API");
  }
  
  return res.json();
}

/**
 * Gets top champion masteries for a PUUID
 */
export async function getTopChampionMasteries(puuid: string, count: number = 3): Promise<ChampionMastery[]> {
  const url = `${PLATFORM_URL}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Champion Mastery API");
  }
  
  return res.json();
}

/**
 * Gets match IDs list for a PUUID.
 * `start` is the offset into the player's history, used to page further back.
 */
export async function getMatchIds(puuid: string, count: number = 5, start: number = 0): Promise<string[]> {
  const url = `${MATCH_REGION_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Match IDs API");
  }
  
  return res.json();
}

// Finished matches never change, so a warm instance can serve repeat paging
// (and the same match showing up in /history, /coach and /detailgame) for free.
const matchDetailCache = new Map<string, MatchDetail>();
const MATCH_CACHE_LIMIT = 200;

/**
 * Gets specific match details by Match ID
 */
export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const cached = matchDetailCache.get(matchId);
  if (cached) return cached;

  const url = `${MATCH_REGION_URL}/lol/match/v5/matches/${matchId}`;
  const res = await riotFetch(url);
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Match Detail API");
  }
  
  const match: MatchDetail = await res.json();

  if (matchDetailCache.size >= MATCH_CACHE_LIMIT) {
    const oldest = matchDetailCache.keys().next().value;
    if (oldest) matchDetailCache.delete(oldest);
  }
  matchDetailCache.set(matchId, match);

  return match;
}

/**
 * Fetches many match details with a bounded concurrency so we stay inside the
 * Riot rate limit. Matches that fail to load are dropped rather than throwing.
 */
export async function getMatchDetails(matchIds: string[], concurrency: number = 8): Promise<MatchDetail[]> {
  const results: MatchDetail[] = [];

  for (let i = 0; i < matchIds.length; i += concurrency) {
    const chunk = matchIds.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map(async id => {
        try {
          return await getMatchDetail(id);
        } catch (e) {
          console.warn(`Failed to load details for match ${id}:`, e);
          return null;
        }
      })
    );
    for (const match of settled) {
      if (match) results.push(match);
    }
  }

  return results;
}

/**
 * Gets active spectator game info for a PUUID
 */
export async function getActiveGame(puuid: string): Promise<ActiveGameInfo | null> {
  const url = `${PLATFORM_URL}/lol/spectator/v5/active-games/by-puuid/${puuid}`;
  const res = await riotFetch(url);
  
  if (res.status === 404) {
    return null; // Not currently in a game
  }
  
  if (!res.ok) {
    throw new RiotApiError(res.status, "Spectator API");
  }
  
  return res.json();
}
