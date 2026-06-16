import { getLatestVersion } from "./champions";

let championByNameMap: Record<string, string> = {};
let itemByNameMap: Record<string, string> = {};
let runeByNameMap: Record<string, string> = {};
let runeTreeByNameMap: Record<string, string> = {};

// Strips special characters, spaces, and lowercases for fuzzy match
function cleanName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "") // remove anything in parentheses
    .replace(/['’.\s\-_]/g, "") // remove punctuation and spaces
    .toLowerCase()
    .trim();
}

async function loadDataDragonCache(): Promise<void> {
  const version = await getLatestVersion();
  
  // 1. Load Champions
  if (Object.keys(championByNameMap).length === 0) {
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        for (const key of Object.keys(data.data)) {
          const champ = data.data[key];
          // Map both display name and key (ID)
          map[cleanName(champ.name)] = key;
          map[cleanName(key)] = key;
        }
        championByNameMap = map;
      }
    } catch (e) {
      console.error("Failed to cache champions from DDragon:", e);
    }
  }

  // 2. Load Items
  if (Object.keys(itemByNameMap).length === 0) {
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        for (const itemId of Object.keys(data.data)) {
          const item = data.data[itemId];
          map[cleanName(item.name)] = itemId;
        }
        itemByNameMap = map;
      }
    } catch (e) {
      console.error("Failed to cache items from DDragon:", e);
    }
  }

  // 3. Load Runes
  if (Object.keys(runeByNameMap).length === 0) {
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);
      if (res.ok) {
        const data = await res.json();
        const rMap: Record<string, string> = {};
        const tMap: Record<string, string> = {};
        for (const tree of data) {
          // Map rune tree icons
          tMap[cleanName(tree.name)] = tree.icon;
          tMap[cleanName(tree.key)] = tree.icon;
          
          for (const slot of tree.slots) {
            for (const rune of slot.runes) {
              rMap[cleanName(rune.name)] = rune.icon;
              rMap[cleanName(rune.key)] = rune.icon;
            }
          }
        }
        runeByNameMap = rMap;
        runeTreeByNameMap = tMap;
      }
    } catch (e) {
      console.error("Failed to cache runes from DDragon:", e);
    }
  }
}

export async function getChampionIconUrl(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const version = await getLatestVersion();
  const key = championByNameMap[cleanName(name)];
  if (!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

export async function getItemIconUrl(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const version = await getLatestVersion();
  const id = itemByNameMap[cleanName(name)];
  if (!id) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
}

export async function getRuneIconUrl(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const path = runeByNameMap[cleanName(name)] || runeTreeByNameMap[cleanName(name)];
  if (!path) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
}

const championSpellsCache: Record<string, (string | null)[]> = {};

export async function getChampionSpellIcons(championIdName: string): Promise<(string | null)[]> {
  if (championSpellsCache[championIdName]) return championSpellsCache[championIdName];
  const version = await getLatestVersion();
  try {
    const res = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${championIdName}.json`
    );
    if (!res.ok) return [null, null, null, null];
    const data = await res.json();
    const champData = data.data?.[championIdName];
    if (!champData) return [null, null, null, null];
    const spells = champData.spells ?? [];
    const passive = champData.passive;
    const urls: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const file = spells[i]?.image?.full;
      urls.push(file ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${file}` : null);
    }
    const rFile = spells[3]?.image?.full;
    urls.push(rFile ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${rFile}` : null);
    // also expose passive at index 4 in case we want it later
    const pFile = passive?.image?.full;
    urls.push(pFile ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${pFile}` : null);
    championSpellsCache[championIdName] = urls;
    return urls;
  } catch (e) {
    console.warn(`Failed to fetch spells for ${championIdName}:`, e);
    return [null, null, null, null];
  }
}
