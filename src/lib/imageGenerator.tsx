import { ImageResponse } from "next/og";
import { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } from "./ddragon";
import { BuildRecommendation } from "./gemini";
import { getLatestVersion } from "./champions";

const SECTIONS = {
  starter: { label: "STARTER", sub: "ไอเทมเริ่มต้น", color: "#4ade80" },
  core: { label: "CORE", sub: "ไอเทมหลัก", color: "#60a5fa" },
  situational: { label: "SITUATIONAL", sub: "ตามสถานการณ์", color: "#fbbf24" },
  runes: { label: "RUNES", sub: "รูนแนะนำ", color: "#a78bfa" },
  strong: { label: "STRONG VS", sub: "ชนะทาง", color: "#22c55e" },
  weak: { label: "WEAK VS", sub: "แพ้ทาง", color: "#ef4444" },
};

async function fetchThaiFont(): Promise<ArrayBuffer | null> {
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

function IconCell({ url, size = 56 }: { url: string | null; size?: number }) {
  if (!url) return null;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: 8,
        overflow: "hidden",
        background: "#1f2230",
        border: "1px solid #2b2d35",
        marginRight: 8,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
    </div>
  );
}

function Row({
  section,
  urls,
}: {
  section: { label: string; sub: string; color: string };
  urls: (string | null)[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #1f222b",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 6,
          height: 56,
          background: section.color,
          borderRadius: 3,
          marginRight: 16,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", width: 170, marginRight: 16 }}>
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {section.label}
        </div>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 14, marginTop: 2 }}>
          {section.sub}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, flexWrap: "wrap" }}>
        {urls.filter(Boolean).map((u, i) => (
          <IconCell key={i} url={u} />
        ))}
      </div>
    </div>
  );
}

export async function generateBuildImage(buildInfo: BuildRecommendation): Promise<Buffer> {
  const latestVersion = await getLatestVersion();
  const champIconUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${buildInfo.championIdName}.png`;

  const [starter, core, situational, strong, weak, runeKey, runePrim, runeSec, ...runeDetails] =
    await Promise.all([
      Promise.all(buildInfo.starterItems.map(getItemIconUrl)),
      Promise.all(buildInfo.coreItems.map(getItemIconUrl)),
      Promise.all(buildInfo.situationalItems.map(getItemIconUrl)),
      Promise.all(buildInfo.strongAgainst.map(getChampionIconUrl)),
      Promise.all(buildInfo.weakAgainst.map(getChampionIconUrl)),
      getRuneIconUrl(buildInfo.runes.keystone),
      getRuneIconUrl(buildInfo.runes.primaryTree),
      getRuneIconUrl(buildInfo.runes.secondaryTree),
      ...buildInfo.runes.details.map(getRuneIconUrl),
    ]);

  const runeUrls = [runeKey, runePrim, runeSec, ...runeDetails];

  const thaiFont = await fetchThaiFont();

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f1117 0%, #161823 100%)",
          padding: "24px 32px",
          fontFamily: "Noto Sans Thai, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              width: 72,
              height: 72,
              borderRadius: 12,
              overflow: "hidden",
              border: "2px solid #f1c40f",
              marginRight: 20,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={champIconUrl} width={72} height={72} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#f1c40f",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              BUILD GUIDE
            </div>
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontSize: 32,
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              {buildInfo.displayName}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: "#6b7280", fontSize: 14 }}>by Gemini AI</div>
        </div>

        <Row section={SECTIONS.starter} urls={starter} />
        <Row section={SECTIONS.core} urls={core} />
        <Row section={SECTIONS.situational} urls={situational} />
        <Row section={SECTIONS.runes} urls={runeUrls} />
        <Row section={SECTIONS.strong} urls={strong} />
        <Row section={SECTIONS.weak} urls={weak} />
      </div>
    ),
    {
      width: 1000,
      height: 760,
      fonts: thaiFont
        ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
        : undefined,
    }
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
