let championMap: Record<string, string> = {};

/**
 * Resolves a League of Legends champion ID to its readable name.
 * Uses Riot's Data Dragon API with in-memory caching.
 */
export async function getChampionName(id: number | string): Promise<string> {
  const targetId = String(id);
  if (championMap[targetId]) {
    return championMap[targetId];
  }

  try {
    // Fetch latest Data Dragon version
    const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (!versionRes.ok) throw new Error("Failed to fetch DDragon versions");
    const versions = await versionRes.json();
    const latestVersion = versions[0] || "14.12.1";

    // Fetch champion data for the latest version
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    if (!res.ok) throw new Error("Failed to fetch champion data");
    const data = await res.json();
    
    const newMap: Record<string, string> = {};
    for (const key of Object.keys(data.data)) {
      const champ = data.data[key];
      newMap[String(champ.key)] = champ.name;
    }
    championMap = newMap;
    return championMap[targetId] || `Unknown (${targetId})`;
  } catch (error) {
    console.error("Failed to fetch champion data from DDragon:", error);
    return `Champion #${targetId}`;
  }
}
