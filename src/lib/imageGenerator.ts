import { Jimp, loadFont } from "jimp";
import { SANS_16_WHITE } from "jimp/fonts";
import { pathToFileURL } from "node:url";
import { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } from "./ddragon";
import { BuildRecommendation } from "./gemini";

function toFontUrl(p: string): string {
  if (/^[a-z]+:\/\//i.test(p)) return p;
  return pathToFileURL(p).href;
}

async function readImageSafely(url: string | null): Promise<any | null> {
  if (!url) return null;
  try {
    const img = await Jimp.read(url);
    return img;
  } catch (e) {
    console.warn(`Failed to load image from ${url}:`, e);
    return null;
  }
}

async function drawIconsRow(
  image: any,
  urls: (string | null)[],
  y: number,
  startX: number = 160,
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
  // Create blank 600x440 image with dark color #111217
  const image = new Jimp({ width: 600, height: 440, color: 0x111217ff });

  // Load white font for row titles
  const font = await loadFont(toFontUrl(SANS_16_WHITE));

  // Draw English Row Titles
  image.print({ font, x: 20, y: 32, text: "STARTER" });
  image.print({ font, x: 20, y: 102, text: "CORE" });
  image.print({ font, x: 20, y: 172, text: "SITUATIONAL" });
  image.print({ font, x: 20, y: 242, text: "RUNES" });
  image.print({ font, x: 20, y: 312, text: "STRONG VS" });
  image.print({ font, x: 20, y: 382, text: "WEAK VS" });

  // Draw thin divider lines between rows
  const dividerColor = 0x2b2d35ff; // Dark gray line #2b2d35
  for (let dividerY of [78, 148, 218, 288, 358]) {
    for (let x = 20; x < 580; x++) {
      image.setPixelColor(dividerColor, x, dividerY);
    }
  }

  // Row 1: STARTER (y = 20)
  const starterUrls = await Promise.all(
    buildInfo.starterItems.map(name => getItemIconUrl(name))
  );
  await drawIconsRow(image, starterUrls, 20);

  // Row 2: CORE (y = 90)
  const coreUrls = await Promise.all(
    buildInfo.coreItems.map(name => getItemIconUrl(name))
  );
  await drawIconsRow(image, coreUrls, 90);

  // Row 3: SITUATIONAL (y = 160)
  const situationalUrls = await Promise.all(
    buildInfo.situationalItems.map(name => getItemIconUrl(name))
  );
  await drawIconsRow(image, situationalUrls, 160);

  // Row 4: RUNES (y = 230)
  const runeUrls: (string | null)[] = [];
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.keystone));
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.primaryTree));
  runeUrls.push(await getRuneIconUrl(buildInfo.runes.secondaryTree));
  for (const r of buildInfo.runes.details) {
    runeUrls.push(await getRuneIconUrl(r));
  }
  // Allow slightly more spacing for runes if needed, or keep standard
  await drawIconsRow(image, runeUrls, 230, 160, 52);

  // Row 5: STRONG VS (y = 300)
  const strongUrls = await Promise.all(
    buildInfo.strongAgainst.map(name => getChampionIconUrl(name))
  );
  await drawIconsRow(image, strongUrls, 300);

  // Row 6: WEAK VS (y = 370)
  const weakUrls = await Promise.all(
    buildInfo.weakAgainst.map(name => getChampionIconUrl(name))
  );
  await drawIconsRow(image, weakUrls, 370);

  // Return PNG Buffer
  return await image.getBuffer("image/png");
}
