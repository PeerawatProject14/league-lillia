export async function fetchThaiFont(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@600&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const css = await cssRes.text();
    const match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    return await fontRes.arrayBuffer();
  } catch (e) {
    console.warn("Failed to load Thai font:", e);
    return null;
  }
}

export const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  CHALLENGER: { bg: "#f13030", text: "#ffffff" },
  GRANDMASTER: { bg: "#900c3f", text: "#ffffff" },
  MASTER: { bg: "#9e4fff", text: "#ffffff" },
  DIAMOND: { bg: "#3f92ff", text: "#ffffff" },
  EMERALD: { bg: "#00bd5e", text: "#ffffff" },
  PLATINUM: { bg: "#2ab19f", text: "#ffffff" },
  GOLD: { bg: "#dca400", text: "#0f1117" },
  SILVER: { bg: "#87929a", text: "#0f1117" },
  BRONZE: { bg: "#a07d5a", text: "#ffffff" },
  IRON: { bg: "#6c6c6c", text: "#ffffff" },
  UNRANKED: { bg: "#2b2d35", text: "#9aa0b4" },
};

export function getTierStyle(tier: string | undefined) {
  return TIER_COLORS[(tier ?? "UNRANKED").toUpperCase()] ?? TIER_COLORS.UNRANKED;
}
