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

/**
 * Display face for headings. Cinzel is the closest thing on Google Fonts to
 * Beaufort/Trajan, the serif Riot uses across the LoL client.
 * Latin-only, so it is always paired with Noto Sans Thai as the fallback.
 */
export async function fetchDisplayFont(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const css = await cssRes.text();
    const match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    return await fontRes.arrayBuffer();
  } catch (e) {
    console.warn("Failed to load display font:", e);
    return null;
  }
}

export type ImageFont = { name: string; data: ArrayBuffer; weight: 600 | 700; style: "normal" };

/** Font set every generated image uses: Cinzel for display, Noto Sans Thai for body/Thai. */
export async function loadImageFonts(): Promise<ImageFont[]> {
  const [thai, display] = await Promise.all([fetchThaiFont(), fetchDisplayFont()]);
  const fonts: ImageFont[] = [];
  if (display) fonts.push({ name: "Cinzel", data: display, weight: 700, style: "normal" });
  if (thai) fonts.push({ name: "Noto Sans Thai", data: thai, weight: 600, style: "normal" });
  return fonts;
}

/** Headings / uppercase labels */
export const DISPLAY_FONT = "Cinzel, Noto Sans Thai";
/** Body copy, Thai included */
export const BODY_FONT = "Noto Sans Thai, Cinzel";

/**
 * Shared palette pulled from the League client: deep blue-black backgrounds,
 * hextech gold for frames and headings, teal for wins and Riot red for losses.
 */
export const LOL = {
  // backgrounds
  bgDeep: "#010A13",
  bgPanel: "#0A1428",
  bgSlot: "#04101C",
  // hextech gold
  gold: "#C8AA6E",
  goldBright: "#F0E6D2",
  goldDark: "#785A28",
  goldDim: "#463714",
  // text
  text: "#F0E6D2",
  textMuted: "#A09B8C",
  textFaint: "#5B5A56",
  // outcome
  win: "#0AC8B9",
  winDeep: "#0397AB",
  loss: "#C6443E",
  lossDeep: "#8C2F2A",
  // misc accents
  divider: "#1E2328",
  gold_translucent: "rgba(200,170,110,0.35)",
} as const;

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

const CDRAGON_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images";

export function getRankedEmblemUrl(tier: string | undefined): string | null {
  if (!tier) return null;
  const key = tier.toLowerCase();
  const VALID = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"];
  if (!VALID.includes(key)) return null;
  return `${CDRAGON_BASE}/ranked-emblem/emblem-${key}.png`;
}

/**
 * Champion mastery crest artwork. Riot ships crests for levels 1-10; anything
 * above that reuses the level 10 crest with the real number shown alongside.
 */
/**
 * Riot ships this art centred inside a mostly transparent canvas, so drawing it
 * with objectFit makes it tiny while scaling it up clips the wings. These
 * helpers return an exact crop window instead — measured from the real assets:
 *   ranked emblem   1280x720, art centred at (0.500, 0.478), at most 0.26 x 0.35
 *   mastery crest    800x900, art centred at (0.500, 0.564), at most 0.98 x 0.61
 */
export interface ArtCropBox {
  width: number;
  height: number;
  imgWidth: number;
  imgHeight: number;
  left: number;
  top: number;
}

function cropBox(
  displayWidth: number,
  windowW: number,
  windowH: number,
  centerX: number,
  centerY: number,
  aspect: number
): ArtCropBox {
  const imgWidth = Math.round(displayWidth / windowW);
  const imgHeight = Math.round(imgWidth * aspect);
  const height = Math.round(imgHeight * windowH);
  return {
    width: displayWidth,
    height,
    imgWidth,
    imgHeight,
    left: Math.round(displayWidth / 2 - centerX * imgWidth),
    top: Math.round(height / 2 - centerY * imgHeight),
  };
}

/** Crop window for a ranked emblem rendered at `displayWidth` px wide. */
export function rankedEmblemCrop(displayWidth: number): ArtCropBox {
  return cropBox(displayWidth, 0.3, 0.42, 0.5, 0.478, 720 / 1280);
}

/** Crop window for a champion mastery crest rendered at `displayWidth` px wide. */
export function masteryCrestCrop(displayWidth: number): ArtCropBox {
  return cropBox(displayWidth, 1.0, 0.66, 0.5, 0.564, 900 / 800);
}

export function getMasteryCrestUrl(level: number): string {
  const clamped = Math.min(Math.max(Math.floor(level) || 1, 1), 10);
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/mastery-${clamped}.png`;
}
