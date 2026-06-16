import { Jimp } from "jimp";
import { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } from "./ddragon";
import { BuildRecommendation } from "./gemini";

const ROW_COLORS: Record<string, number> = {
  starter: 0x4ade80ff,
  core: 0x60a5faff,
  situational: 0xfbbf24ff,
  runes: 0xa78bfaff,
  strong: 0x22c55eff,
  weak: 0xef4444ff,
};

async function readImageSafely(url: string | null): Promise<any | null> {
  if (!url) return null;
  try {
    return await Jimp.read(url);
  } catch (e) {
    console.warn(`Failed to load image from ${url}:`, e);
    return null;
  }
}

function drawRect(image: any, x: number, y: number, w: number, h: number, color: number) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      image.setPixelColor(color, x + dx, y + dy);
    }
  }
}

async function drawIconsRow(
  image: any,
  urls: (string | null)[],
  y: number,
  startX: number = 60,
  spacing: number = 56
) {
  let currentX = startX;
  for (const url of urls) {
    if (!url) continue;
    const icon = await readImageSafely(url);
    if (icon) {
      icon.resize({ w: 48, h: 48 });
      image.composite(icon, currentX, y);
      currentX += spacing;
    }
  }
}

export async function generateBuildImage(buildInfo: BuildRecommendation): Promise<Buffer> {
  const image = new Jimp({ width: 600, height: 440, color: 0x111217ff });

  const rows: { key: keyof typeof ROW_COLORS; y: number }[] = [
    { key: "starter", y: 20 },
    { key: "core", y: 90 },
    { key: "situational", y: 160 },
    { key: "runes", y: 230 },
    { key: "strong", y: 300 },
    { key: "weak", y: 370 },
  ];

  // Left color marker bar per row (replaces text labels)
  for (const { key, y } of rows) {
    drawRect(image, 20, y, 6, 48, ROW_COLORS[key]);
  }

  // Thin dividers between rows
  const dividerColor = 0x2b2d35ff;
  for (const dividerY of [78, 148, 218, 288, 358]) {
    drawRect(image, 20, dividerY, 560, 1, dividerColor);
  }

  const starterUrls = await Promise.all(buildInfo.starterItems.map(getItemIconUrl));
  await drawIconsRow(image, starterUrls, 20);

  const coreUrls = await Promise.all(buildInfo.coreItems.map(getItemIconUrl));
  await drawIconsRow(image, coreUrls, 90);

  const situationalUrls = await Promise.all(buildInfo.situationalItems.map(getItemIconUrl));
  await drawIconsRow(image, situationalUrls, 160);

  const runeUrls: (string | null)[] = [];
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.keystone));
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.primaryTree));
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.secondaryTree));
  for (const r of buildInfo.runes.details) {
    runeUrls.push(await getRuneIconUrl(r));
  }
  await drawIconsRow(image, runeUrls, 230, 60, 52);

  const strongUrls = await Promise.all(buildInfo.strongAgainst.map(getChampionIconUrl));
  await drawIconsRow(image, strongUrls, 300);

  const weakUrls = await Promise.all(buildInfo.weakAgainst.map(getChampionIconUrl));
  await drawIconsRow(image, weakUrls, 370);

  return await image.getBuffer("image/png");
}
