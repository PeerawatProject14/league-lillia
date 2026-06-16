import { ImageResponse } from "next/og";
import { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } from "./ddragon";
import { BuildRecommendation } from "./gemini";
import { getLatestVersion } from "./champions";

const SECTIONS = {
  starter: { label: "STARTER", sub: "ไอเทมเริ่มต้น", color: "#4ade80" },
  core: { label: "CORE", sub: "ไอเทมหลัก", color: "#60a5fa" },
  boots: { label: "BOOTS", sub: "รองเท้า", color: "#fb923c" },
  situational: { label: "SITUATIONAL", sub: "ตามสถานการณ์", color: "#fbbf24" },
  optional: { label: "OPTIONAL", sub: "ทางเลือก", color: "#2dd4bf" },
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

function IconCell({ url, size = 48 }: { url: string | null; size?: number }) {
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
        marginRight: 6,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
    </div>
  );
}

type Section = { label: string; sub: string; color: string };

function SectionLabel({ section, labelWidth = 150 }: { section: Section; labelWidth?: number }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          width: 5,
          height: 48,
          background: section.color,
          borderRadius: 3,
          marginRight: 12,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", width: labelWidth, marginRight: 12 }}>
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {section.label}
        </div>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12, marginTop: 1 }}>
          {section.sub}
        </div>
      </div>
    </>
  );
}

function FullRow({ section, urls }: { section: Section; urls: (string | null)[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1f222b",
      }}
    >
      <SectionLabel section={section} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", flexWrap: "wrap" }}>
        {urls.filter(Boolean).map((u, i) => (
          <IconCell key={i} url={u} />
        ))}
      </div>
    </div>
  );
}

function HalfCell({ section, urls }: { section: Section; urls: (string | null)[] }) {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
      <SectionLabel section={section} labelWidth={120} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
        {urls.filter(Boolean).map((u, i) => (
          <IconCell key={i} url={u} size={42} />
        ))}
      </div>
    </div>
  );
}

function SplitRow({
  left,
  right,
  leftUrls,
  rightUrls,
}: {
  left: Section;
  right: Section;
  leftUrls: (string | null)[];
  rightUrls: (string | null)[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1f222b",
      }}
    >
      <HalfCell section={left} urls={leftUrls} />
      <div style={{ display: "flex", width: 1, height: 48, background: "#2b2d35", marginRight: 12 }} />
      <HalfCell section={right} urls={rightUrls} />
    </div>
  );
}

function RuneRow({
  section,
  keystone,
  primary,
  secondary,
  details,
}: {
  section: Section;
  keystone: string | null;
  primary: string | null;
  secondary: string | null;
  details: (string | null)[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1f222b",
      }}
    >
      <SectionLabel section={section} />
      {keystone && (
        <div
          style={{
            display: "flex",
            width: 54,
            height: 54,
            borderRadius: 27,
            overflow: "hidden",
            background: "#1f2230",
            border: `2px solid ${section.color}`,
            marginRight: 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={keystone} width={54} height={54} alt="" />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginRight: 12 }}>
        {[primary, secondary].filter(Boolean).map((u, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              width: 24,
              height: 24,
              borderRadius: 12,
              overflow: "hidden",
              background: "#1f2230",
              marginBottom: i === 0 ? 4 : 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u!} width={24} height={24} alt="" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", width: 1, height: 44, background: "#2b2d35", marginRight: 10 }} />
      <div style={{ display: "flex", flex: 1, flexWrap: "wrap", alignItems: "center" }}>
        {details.filter(Boolean).map((u, i) => (
          <IconCell key={i} url={u} size={40} />
        ))}
      </div>
    </div>
  );
}

export async function generateBuildImage(buildInfo: BuildRecommendation): Promise<Buffer> {
  const latestVersion = await getLatestVersion();
  const champIconUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${buildInfo.championIdName}.png`;

  const boots = buildInfo.boots ?? [];
  const optionalItems = buildInfo.optionalItems ?? [];

  const [
    starterUrls,
    coreUrls,
    bootsUrls,
    situationalUrls,
    optionalUrls,
    strongUrls,
    weakUrls,
    runeKey,
    runePrim,
    runeSec,
    ...runeDetails
  ] = await Promise.all([
    Promise.all(buildInfo.starterItems.map(getItemIconUrl)),
    Promise.all(buildInfo.coreItems.map(getItemIconUrl)),
    Promise.all(boots.map(getItemIconUrl)),
    Promise.all(buildInfo.situationalItems.map(getItemIconUrl)),
    Promise.all(optionalItems.map(getItemIconUrl)),
    Promise.all(buildInfo.strongAgainst.map(getChampionIconUrl)),
    Promise.all(buildInfo.weakAgainst.map(getChampionIconUrl)),
    getRuneIconUrl(buildInfo.runes.keystone),
    getRuneIconUrl(buildInfo.runes.primaryTree),
    getRuneIconUrl(buildInfo.runes.secondaryTree),
    ...buildInfo.runes.details.map(getRuneIconUrl),
  ]);

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
          padding: "20px 28px",
          fontFamily: "Noto Sans Thai, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 12,
              overflow: "hidden",
              border: "2px solid #f1c40f",
              marginRight: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={champIconUrl} width={64} height={64} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#f1c40f",
                fontSize: 14,
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
                fontSize: 28,
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              {buildInfo.displayName}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: "#6b7280", fontSize: 13 }}>by Gemini AI</div>
        </div>

        <FullRow section={SECTIONS.starter} urls={starterUrls} />
        <FullRow section={SECTIONS.core} urls={coreUrls} />
        <FullRow section={SECTIONS.boots} urls={bootsUrls} />
        <SplitRow
          left={SECTIONS.situational}
          right={SECTIONS.optional}
          leftUrls={situationalUrls}
          rightUrls={optionalUrls}
        />
        <RuneRow
          section={SECTIONS.runes}
          keystone={runeKey}
          primary={runePrim}
          secondary={runeSec}
          details={runeDetails}
        />
        <SplitRow
          left={SECTIONS.strong}
          right={SECTIONS.weak}
          leftUrls={strongUrls}
          rightUrls={weakUrls}
        />
      </div>
    ),
    {
      width: 1100,
      height: 560,
      fonts: thaiFont
        ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
        : undefined,
    }
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
