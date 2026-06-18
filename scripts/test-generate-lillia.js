const fs = require("fs");
const path = require("path");

try {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, "utf-8");
    envFileContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const firstEq = trimmed.indexOf("=");
      if (firstEq === -1) return;
      const key = trimmed.substring(0, firstEq).trim();
      const val = trimmed.substring(firstEq + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    });
  }
} catch (e) {
  console.error(e);
}

// We need to override tsconfig/path resolution for local testing
const { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } = require("../src/lib/ddragon");
const { generateBuildImage } = require("../src/lib/imageGenerator");

const buildInfo = {
  championIdName: "Lillia",
  displayName: "Lillia (ลิลเลีย)",
  starterItems: [
    "Gustwalker Hatchling (ลูกสมุน Gustwalker)",
    "Health Potion (ยาเพิ่มพลังชีวิต)"
  ],
  coreItems: [
    "Liandry's Torment (ความทรมานของ Liandry)",
    "Riftmaker (ผู้สร้างรอยแยก)",
    "Zhonya's Hourglass (นาฬิกาทรายของ Zhonya)"
  ],
  situationalItems: [
    "Jak'Sho, The Protean (Jak'Sho ผู้เปลี่ยนรูป)",
    "Rabadon's Deathcap (หมวกมรณะของ Rabadon)",
    "Frozen Heart (หัวใจเยือกเย็น)"
  ],
  runes: {
    keystone: "Conqueror (ผู้พิชิต)",
    primaryTree: "Precision (ความแม่นยำ)",
    secondaryTree: "Sorcery (เวทมนตร์)",
    details: [
      "Presence of Mind (จิตใจที่เบิกบาน)",
      "Legend: Haste (ตำนาน: เร่งความเร็ว)",
      "Coup de Grace (โค่นล้ม)",
      "Celerity (ความว่องไว)",
      "Waterwalking (เดินบนน้ำ)"
    ]
  },
  strongAgainst: ["Udyr", "Sion", "Zac"],
  weakAgainst: ["Kha'Zix", "Rengar", "Kindred"]
};

async function test() {
  try {
    console.log("Resolving URLs...");
    const starterUrls = await Promise.all(buildInfo.starterItems.map(n => getItemIconUrl(n)));
    console.log("Starter URLs:", starterUrls);
    
    const coreUrls = await Promise.all(buildInfo.coreItems.map(n => getItemIconUrl(n)));
    console.log("Core URLs:", coreUrls);

    const runeUrls = [];
    runeUrls.push(await getRuneIconUrl(buildInfo.runes.keystone));
    runeUrls.push(await getRuneIconUrl(buildInfo.runes.primaryTree));
    runeUrls.push(await getRuneIconUrl(buildInfo.runes.secondaryTree));
    for (const d of buildInfo.runes.details) {
      runeUrls.push(await getRuneIconUrl(d));
    }
    console.log("Rune URLs:", runeUrls);

    console.log("Generating image...");
    const buffer = await generateBuildImage(buildInfo);
    console.log("Success! Buffer length:", buffer.length);
    fs.writeFileSync("test-build-lillia.png", buffer);
    console.log("Saved test-build-lillia.png");
  } catch (error) {
    console.error("Failed:", error);
  }
}

test();
