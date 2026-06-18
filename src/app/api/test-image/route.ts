import { NextResponse } from "next/server";
import { generateBuildImage } from "@/lib/imageGenerator";

export async function GET() {
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

  try {
    const buffer = await generateBuildImage(buildInfo);
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png"
      }
    });
  } catch (error: any) {
    console.error("Test route error:", error);
    return NextResponse.json({ error: error.message || error });
  }
}
