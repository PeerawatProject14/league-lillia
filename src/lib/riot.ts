const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Region configuration (defaulting to TH / Asia)
const PLATFORM_URL = "https://th2.api.riotgames.com"; // For TH server endpoint
const REGION_URL = "https://asia.api.riotgames.com";   // For Account & Match v5

function getHeaders(): HeadersInit {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not defined in environment variables");
  }
  return {
    "X-Riot-Token": RIOT_API_KEY,
  };
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

export interface MatchParticipant {
  puuid: string;
  summonerId: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championId: number;
  championName: string;
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
}

export interface MatchDetail {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameMode: string;
    gameDuration: number; // in seconds
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
  const url = `${REGION_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Riot ID ${gameName}#${tagLine} not found`);
    }
    throw new Error(`Riot Account API returned status ${res.status}`);
  }
  
  return res.json();
}

/**
 * Gets summoner profile information using PUUID
 */
export async function getSummonerByPuuid(puuid: string): Promise<Summoner> {
  const url = `${PLATFORM_URL}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    throw new Error(`Summoner API returned status ${res.status} for PUUID ${puuid}`);
  }
  
  return res.json();
}

/**
 * Gets league entries (ranks) for a given summoner ID
 */
export async function getLeagueEntries(summonerId: string): Promise<LeagueEntry[]> {
  const url = `${PLATFORM_URL}/lol/league/v4/entries/by-summoner/${summonerId}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    throw new Error(`League API returned status ${res.status} for Summoner ID ${summonerId}`);
  }
  
  return res.json();
}

/**
 * Gets top champion masteries for a PUUID
 */
export async function getTopChampionMasteries(puuid: string, count: number = 3): Promise<ChampionMastery[]> {
  const url = `${PLATFORM_URL}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    throw new Error(`Champion Mastery API returned status ${res.status} for PUUID ${puuid}`);
  }
  
  return res.json();
}

/**
 * Gets match IDs list for a PUUID
 */
export async function getMatchIds(puuid: string, count: number = 5): Promise<string[]> {
  const url = `${REGION_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    throw new Error(`Match IDs API returned status ${res.status} for PUUID ${puuid}`);
  }
  
  return res.json();
}

/**
 * Gets specific match details by Match ID
 */
export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const url = `${REGION_URL}/lol/match/v5/matches/${matchId}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    throw new Error(`Match Detail API returned status ${res.status} for Match ID ${matchId}`);
  }
  
  return res.json();
}

/**
 * Gets active spectator game info for a PUUID
 */
export async function getActiveGame(puuid: string): Promise<ActiveGameInfo | null> {
  const url = `${PLATFORM_URL}/lol/spectator/v5/active-games/by-puuid/${puuid}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (res.status === 404) {
    return null; // Not currently in a game
  }
  
  if (!res.ok) {
    throw new Error(`Spectator API returned status ${res.status} for PUUID ${puuid}`);
  }
  
  return res.json();
}
