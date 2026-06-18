import { getLatestVersion } from "./champions";

let championByNameMap: Record<string, string> = {};
let itemByNameMap: Record<string, string> = {};
let itemByIdMap: Record<string, string> = {}; // id -> display name
let runeByNameMap: Record<string, string> = {};
let runeTreeByNameMap: Record<string, string> = {};
let summonerSpellByNameMap: Record<string, string> = {};
let summonerSpellByKeyMap: Record<string, string> = {}; // numeric id (key) -> image file
let runeByIdMap: Record<string, string> = {}; // perk id -> icon path

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
        const idMap: Record<string, string> = {};
        for (const itemId of Object.keys(data.data)) {
          const item = data.data[itemId];
          map[cleanName(item.name)] = itemId;
          idMap[itemId] = item.name;
        }
        itemByNameMap = map;
        itemByIdMap = idMap;
      }
    } catch (e) {
      console.error("Failed to cache items from DDragon:", e);
    }
  }

  // 2b. Load Summoner Spells
  if (Object.keys(summonerSpellByNameMap).length === 0) {
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/summoner.json`);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        const byKey: Record<string, string> = {};
        for (const key of Object.keys(data.data)) {
          const spell = data.data[key];
          map[cleanName(spell.name)] = spell.image.full;
          map[cleanName(spell.id)] = spell.image.full;
          map[cleanName(spell.id.replace(/^Summoner/, ""))] = spell.image.full;
          if (spell.key) byKey[String(spell.key)] = spell.image.full;
        }
        summonerSpellByNameMap = map;
        summonerSpellByKeyMap = byKey;
      }
    } catch (e) {
      console.error("Failed to cache summoner spells from DDragon:", e);
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
        const idMap: Record<string, string> = {};
        for (const tree of data) {
          // Map rune tree icons
          tMap[cleanName(tree.name)] = tree.icon;
          tMap[cleanName(tree.key)] = tree.icon;
          if (tree.id) idMap[String(tree.id)] = tree.icon;

          for (const slot of tree.slots) {
            for (const rune of slot.runes) {
              rMap[cleanName(rune.name)] = rune.icon;
              rMap[cleanName(rune.key)] = rune.icon;
              if (rune.id) idMap[String(rune.id)] = rune.icon;
            }
          }
        }
        runeByNameMap = rMap;
        runeTreeByNameMap = tMap;
        runeByIdMap = idMap;
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

export async function getChampionSplashUrl(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const key = championByNameMap[cleanName(name)];
  if (!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`;
}

export async function getItemIconUrl(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const version = await getLatestVersion();
  const id = itemByNameMap[cleanName(name)];
  if (!id) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
}

export async function getSummonerSpellIcon(name: string): Promise<string | null> {
  await loadDataDragonCache();
  const version = await getLatestVersion();
  const file = summonerSpellByNameMap[cleanName(name)];
  if (!file) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${file}`;
}

export async function getSummonerSpellIconById(id: number): Promise<string | null> {
  await loadDataDragonCache();
  const version = await getLatestVersion();
  const file = summonerSpellByKeyMap[String(id)];
  if (!file) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${file}`;
}

export async function getItemIconById(id: number): Promise<string | null> {
  if (!id) return null;
  const version = await getLatestVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
}

export async function getItemNameById(id: number): Promise<string | null> {
  if (!id) return null;
  await loadDataDragonCache();
  return itemByIdMap[String(id)] ?? null;
}

export async function getRuneIconById(id: number): Promise<string | null> {
  await loadDataDragonCache();
  const path = runeByIdMap[String(id)];
  if (!path) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
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
