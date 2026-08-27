import { ImageResponse } from "next/og";
import {
  getChampionIconUrl,
  getItemIconUrl,
  getRuneIconUrl,
  getChampionSpellIcons,
  getSummonerSpellIcon,
} from "./ddragon";
import { BuildRecommendation } from "./gemini";
import { getLatestVersion } from "./champions";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT } from "./imageCommon";
import { GoldRule } from "./imageParts";

const SECTIONS = {
  starter: { label: "STARTER", sub: "ไอเทมเริ่มต้น", color: "#0AC8B9" },
  core: { label: "CORE", sub: "ช่อง 1-3 (ของใหญ่-รองเท้า-ของใหญ่)", color: "#C8AA6E" },
  situational: { label: "SITUATIONAL", sub: "ช่อง 4-6 ตามรูปเกม", color: "#4D9BE6" },
  optional: { label: "OPTIONAL", sub: "ทางเลือกสำรอง", color: "#0397AB" },
  runes: { label: "RUNES", sub: "รูนแนะนำ", color: "#9D8CD8" },
  skills: { label: "SKILL ORDER", sub: "ลำดับการอัพสกิล", color: "#E0836A" },
  strong: { label: "STRONG VS", sub: "ชนะทาง", color: "#0AC8B9" },
  weak: { label: "WEAK VS", sub: "แพ้ทาง", color: "#C6443E" },
};

function IconCell({ url, size = 48 }: { url: string | null; size?: number }) {
  if (!url) return null;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: 2,
        overflow: "hidden",
        background: "#04101C",
        border: "1px solid #463714",
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
            color: "#F0E6D2",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 1, fontFamily: DISPLAY_FONT,
          }}
        >
          {section.label}
        </div>
        <div style={{ display: "flex", color: "#A09B8C", fontSize: 12, marginTop: 1 }}>
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
        borderBottom: "1px solid #04101C",
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

function Arrow() {
  return (
    <div
      style={{
        display: "flex",
        color: "#5B5A56",
        fontSize: 24,
        marginRight: 6,
        alignItems: "center",
      }}
    >
      ›
    </div>
  );
}

function CoreRow({
  section,
  urls,
  bootsIndex,
}: {
  section: Section;
  urls: (string | null)[];
  bootsIndex: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #04101C",
      }}
    >
      <SectionLabel section={section} />
      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        {urls.map((u, i) => {
          if (!u) return null;
          const isBoots = i === bootsIndex;
          const cell = (
            <div
              key={`cell-${i}`}
              style={{
                display: "flex",
                width: 52,
                height: 52,
                borderRadius: 2,
                overflow: "hidden",
                background: "#04101C",
                border: isBoots ? "2px solid #E0836A" : "1px solid #463714",
                marginRight: 6,
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} width={isBoots ? 48 : 52} height={isBoots ? 48 : 52} alt="" />
            </div>
          );
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <Arrow />}
              {cell}
            </div>
          );
        })}
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
        borderBottom: "1px solid #04101C",
      }}
    >
      <HalfCell section={left} urls={leftUrls} />
      <div style={{ display: "flex", width: 1, height: 48, background: "#463714", marginRight: 12 }} />
      <HalfCell section={right} urls={rightUrls} />
    </div>
  );
}

function SkillIcon({ url, letter }: { url: string | null; letter: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginRight: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 48,
          height: 48,
          borderRadius: 2,
          overflow: "hidden",
          background: "#04101C",
          border: "1px solid #463714",
          position: "relative",
        }}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} width={48} height={48} alt="" />
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            background: "#000000cc",
            color: "#F0E6D2",
            fontSize: 11,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
            borderTopLeftRadius: 4,
          }}
        >
          {letter}
        </div>
      </div>
    </div>
  );
}

function SkillOrderRow({
  section,
  spellUrls,
  priority,
}: {
  section: Section;
  spellUrls: (string | null)[];
  priority: string[];
}) {
  const KEYS = ["Q", "W", "E", "R"] as const;
  const urlByKey: Record<string, string | null> = {
    Q: spellUrls[0] ?? null,
    W: spellUrls[1] ?? null,
    E: spellUrls[2] ?? null,
    R: spellUrls[3] ?? null,
  };
  const safePriority = (priority.length === 3 ? priority : ["Q", "E", "W"]).filter(k => k !== "R");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #04101C",
      }}
    >
      <SectionLabel section={section} />
      <div style={{ display: "flex", alignItems: "center" }}>
        {KEYS.map((k) => (
          <SkillIcon key={k} url={urlByKey[k]} letter={k} />
        ))}
      </div>
      <div style={{ display: "flex", width: 1, height: 44, background: "#463714", marginRight: 14 }} />
      <div style={{ display: "flex", alignItems: "center" }}>
        {safePriority.map((k, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  display: "flex",
                  color: "#5B5A56",
                  fontSize: 20,
                  margin: "0 6px",
                }}
              >
                ›
              </div>
            )}
            <div
              style={{
                display: "flex",
                width: 32,
                height: 32,
                borderRadius: 4,
                background: i === 0 ? section.color : "#04101C",
                color: i === 0 ? "#010A13" : "#F0E6D2",
                fontSize: 14,
                fontWeight: 700,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {k}
            </div>
          </div>
        ))}
      </div>
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
        borderBottom: "1px solid #04101C",
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
            background: "#04101C",
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
              borderRadius: 3,
              overflow: "hidden",
              background: "#04101C",
              marginBottom: i === 0 ? 4 : 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u!} width={24} height={24} alt="" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", width: 1, height: 44, background: "#463714", marginRight: 10 }} />
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
  const vsChampIconUrl = buildInfo.vsChampionIdName
    ? `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${buildInfo.vsChampionIdName}.png`
    : null;
  const isMatchup = Boolean(buildInfo.vsChampionIdName && buildInfo.vsChampionDisplayName);

  const optionalItems = buildInfo.optionalItems ?? [];
  const bootsIndex = typeof buildInfo.bootsIndex === "number" ? buildInfo.bootsIndex : 1;

  const [
    starterUrls,
    coreUrls,
    situationalUrls,
    optionalUrls,
    strongUrls,
    weakUrls,
    spellUrls,
    summonerUrls,
    runeKey,
    runePrim,
    runeSec,
    ...runeDetails
  ] = await Promise.all([
    Promise.all(buildInfo.starterItems.map(getItemIconUrl)),
    Promise.all(buildInfo.coreItems.map(getItemIconUrl)),
    Promise.all(buildInfo.situationalItems.map(getItemIconUrl)),
    Promise.all(optionalItems.map(getItemIconUrl)),
    Promise.all(buildInfo.strongAgainst.map(getChampionIconUrl)),
    Promise.all(buildInfo.weakAgainst.map(getChampionIconUrl)),
    getChampionSpellIcons(buildInfo.championIdName),
    Promise.all((buildInfo.summonerSpells ?? []).map(getSummonerSpellIcon)),
    getRuneIconUrl(buildInfo.runes.keystone),
    getRuneIconUrl(buildInfo.runes.primaryTree),
    getRuneIconUrl(buildInfo.runes.secondaryTree),
    ...buildInfo.runes.details.map(getRuneIconUrl),
  ]);

  const skillPriority = buildInfo.skillPriority ?? ["Q", "E", "W"];

  const fonts = await loadImageFonts();

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #010A13 0%, #0A1428 100%)",
          padding: "20px 28px",
          fontFamily: BODY_FONT,
          border: "1px solid #463714",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 3,
              overflow: "hidden",
              border: "2px solid #C8AA6E",
              marginRight: isMatchup ? 12 : 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={champIconUrl} width={64} height={64} alt="" />
          </div>

          {isMatchup && vsChampIconUrl ? (
            <div style={{ display: "flex", alignItems: "center", marginRight: 16 }}>
              <div
                style={{
                  display: "flex",
                  color: "#C6443E",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 2, fontFamily: DISPLAY_FONT,
                  margin: "0 10px",
                }}
              >
                VS
              </div>
              <div
                style={{
                  display: "flex",
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "2px solid #C6443E",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={vsChampIconUrl} width={64} height={64} alt="" />
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: isMatchup ? "#C6443E" : "#C8AA6E",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 2, fontFamily: DISPLAY_FONT,
              }}
            >
              {isMatchup ? "MATCHUP BUILD" : "BUILD GUIDE"}
            </div>
            <div
              style={{
                display: "flex",
                color: "#F0E6D2",
                fontSize: isMatchup ? 22 : 28,
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              {isMatchup
                ? `${buildInfo.displayName} vs ${buildInfo.vsChampionDisplayName}`
                : buildInfo.displayName}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 16 }}>
            <div
              style={{
                display: "flex",
                color: "#A09B8C",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1, fontFamily: DISPLAY_FONT,
                marginBottom: 4,
              }}
            >
              SUMMONER SPELLS
            </div>
            <div style={{ display: "flex" }}>
              {summonerUrls.filter(Boolean).map((u, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    overflow: "hidden",
                    background: "#04101C",
                    border: "1px solid #463714",
                    marginLeft: i === 0 ? 0 : 6,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u!} width={40} height={40} alt="" />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", color: "#5B5A56", fontSize: 13 }}>by Gemini AI</div>
        </div>

          <div style={{ display: "flex", marginBottom: 6 }}>
            <GoldRule width={1044} />
          </div>

        <FullRow section={SECTIONS.starter} urls={starterUrls} />
        <CoreRow section={SECTIONS.core} urls={coreUrls} bootsIndex={bootsIndex} />
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
        <SkillOrderRow
          section={SECTIONS.skills}
          spellUrls={spellUrls}
          priority={skillPriority}
        />
        <SplitRow
          left={SECTIONS.strong}
          right={SECTIONS.weak}
          leftUrls={strongUrls}
          rightUrls={weakUrls}
        />

        {isMatchup && buildInfo.matchupTip ? (
          <div
            style={{
              display: "flex",
              marginTop: 12,
              padding: "10px 14px",
              background: "rgba(198,68,62,0.08)",
              border: "1px solid rgba(198,68,62,0.35)",
              borderRadius: 2,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#C6443E",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1, fontFamily: DISPLAY_FONT,
                width: 110,
                marginRight: 12,
              }}
            >
              TIP เลน
            </div>
            <div style={{ display: "flex", color: "#F0E6D2", fontSize: 13, flex: 1 }}>
              {buildInfo.matchupTip}
            </div>
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1100,
      height: isMatchup ? 655 : 595,
      fonts: fonts.length ? fonts : undefined,
    }
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
