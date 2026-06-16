let latestVersionCache: string = "";
let championMap: Record<string, string> = {};
let championInternalIdMap: Record<string, string> = {};

/**
 * Fetches and caches the latest League of Legends Data Dragon version.
 */
export async function getLatestVersion(): Promise<string> {
  if (latestVersionCache) return latestVersionCache;
  try {
    const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (versionRes.ok) {
      const versions = await versionRes.json();
      latestVersionCache = versions[0] || "14.12.1";
    } else {
      latestVersionCache = "14.12.1";
    }
  } catch (error) {
    console.error("Failed to fetch DDragon versions:", error);
    latestVersionCache = "14.12.1";
  }
  return latestVersionCache;
}

/**
 * Ensures champion maps are populated.
 */
async function ensureChampionMaps(): Promise<void> {
  if (Object.keys(championMap).length > 0) return;
  try {
    const latestVersion = await getLatestVersion();
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    if (!res.ok) throw new Error("Failed to fetch champion data");
    const data = await res.json();
    
    const newDisplayMap: Record<string, string> = {};
    const newInternalMap: Record<string, string> = {};
    for (const key of Object.keys(data.data)) {
      const champ = data.data[key];
      newDisplayMap[String(champ.key)] = champ.name;
      newInternalMap[String(champ.key)] = key; // key is the internal ID, e.g. "MonkeyKing"
    }
    championMap = newDisplayMap;
    championInternalIdMap = newInternalMap;
  } catch (error) {
    console.error("Failed to populate champion maps:", error);
  }
}

/**
 * Resolves a League of Legends champion ID to its readable name.
 */
export async function getChampionName(id: number | string): Promise<string> {
  const targetId = String(id);
  await ensureChampionMaps();
  return championMap[targetId] || `Champion #${targetId}`;
}

/**
 * Resolves a League of Legends champion ID to its internal name (used for images).
 */
export async function getChampionInternalId(id: number | string): Promise<string> {
  const targetId = String(id);
  await ensureChampionMaps();
  return championInternalIdMap[targetId] || "";
}
