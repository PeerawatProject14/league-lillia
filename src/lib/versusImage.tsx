import { ImageResponse } from "next/og";
import { getChampionIconUrl, getChampionSplashUrl } from "./ddragon";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT, LOL } from "./imageCommon";
import { GoldRule } from "./imageParts";

export interface ChampionTally {
  name: string;
  games: number;
  wins: number;
}

export interface RoleTally {
  role: string;
  games: number;
}

export interface VersusSideInput {
  gameName: string;
  tagLine: string;
  topChampion: string;
  games: number;
  wins: number;
  avgKda: string;
  avgDeaths: number;
  csPerMin: number;
  visionScore: number;
  damage: number;
  champions: ChampionTally[];
  roles: RoleTally[];
}

export interface VersusImageInput {
  a: VersusSideInput;
  b: VersusSideInput;
  winner: "a" | "b";
  verdict: string;
  loserTitle: string;
}

const WIDTH = 1100;
const HEIGHT = 828;
const COL_W = 420;

interface Row {
  label: string;
  aText: string;
  bText: string;
  aWins: boolean;
  bWins: boolean;
}

function buildRows(a: VersusSideInput, b: VersusSideInput): Row[] {
  const wrA = a.games ? (a.wins / a.games) * 100 : 0;
  const wrB = b.games ? (b.wins / b.games) * 100 : 0;
  const kdaA = parseFloat(a.avgKda) || 0;
  const kdaB = parseFloat(b.avgKda) || 0;

  const cmp = (x: number, y: number, higherIsBetter = true): [boolean, boolean] => {
    if (x === y) return [false, false];
    const aBetter = higherIsBetter ? x > y : x < y;
    return [aBetter, !aBetter];
  };

  const [wa, wb] = cmp(wrA, wrB);
  const [ka, kb] = cmp(kdaA, kdaB);
  const [da, db] = cmp(a.avgDeaths, b.avgDeaths, false);
  const [ca, cb] = cmp(a.csPerMin, b.csPerMin);
  const [va, vb] = cmp(a.visionScore, b.visionScore);
  const [ga, gb] = cmp(a.damage, b.damage);

  return [
    { label: "WIN RATE", aText: `${Math.round(wrA)}%`, bText: `${Math.round(wrB)}%`, aWins: wa, bWins: wb },
    { label: "KDA", aText: a.avgKda, bText: b.avgKda, aWins: ka, bWins: kb },
    { label: "ตาย / เกม", aText: a.avgDeaths.toFixed(1), bText: b.avgDeaths.toFixed(1), aWins: da, bWins: db },
    { label: "CS / MIN", aText: a.csPerMin.toFixed(1), bText: b.csPerMin.toFixed(1), aWins: ca, bWins: cb },
    { label: "VISION", aText: a.visionScore.toFixed(0), bText: b.visionScore.toFixed(0), aWins: va, bWins: vb },
    {
      label: "DAMAGE",
      aText: `${(a.damage / 1000).toFixed(1)}k`,
      bText: `${(b.damage / 1000).toFixed(1)}k`,
      aWins: ga,
      bWins: gb,
    },
  ];
}


const ROLE_LABEL: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SUP",
};

const MAX_POOL = 6;

/** One champion the player actually used, with how it went. */
function ChampionChip({ tally, iconUrl }: { tally: ChampionTally; iconUrl: string | null }) {
  const wr = Math.round((tally.wins / Math.max(tally.games, 1)) * 100);
  const good = wr >= 50;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 62, marginRight: 6 }}>
      <div
        style={{
          display: "flex",
          width: 38,
          height: 38,
          borderRadius: 2,
          overflow: "hidden",
          background: LOL.bgSlot,
          border: `1px solid ${good ? LOL.gold : LOL.goldDim}`,
        }}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} width={38} height={38} alt="" />
        )}
      </div>
      <div style={{ display: "flex", color: LOL.textMuted, fontSize: 10, marginTop: 4 }}>
        {`${tally.games} เกม`}
      </div>
      <div style={{ display: "flex", color: good ? LOL.win : LOL.loss, fontSize: 10, fontWeight: 700 }}>
        {`${wr}%`}
      </div>
    </div>
  );
}

function ChampionPool({
  tallies,
  icons,
  alignRight,
}: {
  tallies: ChampionTally[];
  icons: Record<string, string | null>;
  alignRight: boolean;
}) {
  const shown = tallies.slice(0, MAX_POOL);
  const hidden = tallies.length - shown.length;
  return (
    <div
      style={{
        display: "flex",
        width: COL_W,
        justifyContent: alignRight ? "flex-start" : "flex-end",
        alignItems: "flex-start",
      }}
    >
      {shown.map(t => (
        <ChampionChip key={t.name} tally={t} iconUrl={icons[t.name] ?? null} />
      ))}
      {hidden > 0 && (
        <div style={{ display: "flex", alignItems: "center", height: 38, color: LOL.textFaint, fontSize: 11 }}>
          {`+${hidden}`}
        </div>
      )}
    </div>
  );
}

function RoleStrip({ roles, alignRight }: { roles: RoleTally[]; alignRight: boolean }) {
  const top = roles.reduce((best, r) => (r.games > best.games ? r : best), roles[0] ?? { role: "", games: 0 });
  return (
    <div
      style={{
        display: "flex",
        width: COL_W,
        justifyContent: alignRight ? "flex-start" : "flex-end",
        alignItems: "center",
      }}
    >
      {roles.map(r => {
        const isMain = r.role === top.role;
        return (
          <div
            key={r.role}
            style={{
              display: "flex",
              alignItems: "center",
              border: `1px solid ${isMain ? LOL.goldDim : LOL.divider}`,
              background: isMain ? "rgba(200,170,110,0.10)" : "rgba(1,10,19,0.6)",
              padding: "2px 8px",
              marginRight: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                color: isMain ? LOL.gold : LOL.textFaint,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                fontFamily: DISPLAY_FONT,
              }}
            >
              {ROLE_LABEL[r.role] ?? r.role.slice(0, 3)}
            </div>
            <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginLeft: 6 }}>{`${r.games}`}</div>
          </div>
        );
      })}
    </div>
  );
}

function CentreLabel({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", width: 192, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          color: LOL.goldDark,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          fontFamily: DISPLAY_FONT,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function SideHeader({
  side,
  iconUrl,
  isWinner,
  alignRight,
}: {
  side: VersusSideInput;
  iconUrl: string | null;
  isWinner: boolean;
  alignRight: boolean;
}) {
  const accent = isWinner ? LOL.gold : LOL.textFaint;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: alignRight ? "flex-end" : "flex-start",
        width: COL_W,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 88,
          height: 88,
          borderRadius: 3,
          overflow: "hidden",
          background: LOL.bgSlot,
          border: `2px solid ${accent}`,
        }}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} width={88} height={88} alt="" />
        )}
      </div>
      <div style={{ display: "flex", color: LOL.text, fontSize: 26, fontWeight: 700, marginTop: 10, fontFamily: DISPLAY_FONT }}>
        {side.gameName}
      </div>
      <div style={{ display: "flex", color: LOL.textMuted, fontSize: 13, marginTop: 2 }}>
        {`#${side.tagLine} · ${side.topChampion} · ${side.games} เกม`}
      </div>
      {isWinner && (
        <div
          style={{
            display: "flex",
            color: LOL.gold,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 3,
            border: `1px solid ${LOL.goldDim}`,
            background: "rgba(200,170,110,0.10)",
            padding: "2px 10px",
            marginTop: 8,
            fontFamily: DISPLAY_FONT,
          }}
        >
          WINNER
        </div>
      )}
    </div>
  );
}

function StatRow({ row }: { row: Row }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 46 }}>
      <div
        style={{
          display: "flex",
          width: COL_W,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            color: row.aWins ? LOL.gold : LOL.textMuted,
            fontSize: row.aWins ? 22 : 19,
            fontWeight: 700,
            fontFamily: DISPLAY_FONT,
          }}
        >
          {row.aText}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: 192,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            color: LOL.goldDark,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            fontFamily: DISPLAY_FONT,
          }}
        >
          {row.label}
        </div>
      </div>

      <div style={{ display: "flex", width: COL_W, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            color: row.bWins ? LOL.gold : LOL.textMuted,
            fontSize: row.bWins ? 22 : 19,
            fontWeight: 700,
            fontFamily: DISPLAY_FONT,
          }}
        >
          {row.bText}
        </div>
      </div>
    </div>
  );
}

export async function generateVersusImage(input: VersusImageInput): Promise<Buffer> {
  const poolNames = [
    ...new Set([
      ...input.a.champions.slice(0, MAX_POOL).map(c => c.name),
      ...input.b.champions.slice(0, MAX_POOL).map(c => c.name),
    ]),
  ];

  const [iconA, iconB, splashUrl, fonts, poolIconList] = await Promise.all([
    getChampionIconUrl(input.a.topChampion),
    getChampionIconUrl(input.b.topChampion),
    getChampionSplashUrl(input.winner === "a" ? input.a.topChampion : input.b.topChampion),
    loadImageFonts(),
    Promise.all(poolNames.map(n => getChampionIconUrl(n))),
  ]);

  const poolIcons: Record<string, string | null> = {};
  poolNames.forEach((n, i) => {
    poolIcons[n] = poolIconList[i];
  });

  const rows = buildRows(input.a, input.b);
  const loser = input.winner === "a" ? input.b : input.a;

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            width: "100%",
            height: "100%",
            background: LOL.bgDeep,
            border: `1px solid ${LOL.goldDim}`,
            padding: "24px 34px",
            fontFamily: BODY_FONT,
          }}
        >
          {splashUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={splashUrl} width={WIDTH} height={649} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
          )}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: WIDTH,
              height: HEIGHT,
              background:
                "linear-gradient(180deg, rgba(1,10,19,0.88) 0%, rgba(1,10,19,0.95) 32%, #010A13 60%)",
            }}
          />

          <div style={{ display: "flex", position: "absolute", top: 8, left: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", top: 8, right: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />

          <div style={{ display: "flex", position: "relative", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                color: LOL.gold,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 6,
                fontFamily: DISPLAY_FONT,
              }}
            >
              STAT DUEL
            </div>
          </div>

          <div style={{ display: "flex", position: "relative", alignItems: "flex-start", marginTop: 16 }}>
            <SideHeader side={input.a} iconUrl={iconA} isWinner={input.winner === "a"} alignRight={false} />
            <div
              style={{
                display: "flex",
                width: 192,
                height: 160,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", color: LOL.loss, fontSize: 52, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                VS
              </div>
            </div>
            <SideHeader side={input.b} iconUrl={iconB} isWinner={input.winner === "b"} alignRight={true} />
          </div>

          <div style={{ display: "flex", position: "relative", marginTop: 14, marginBottom: 8 }}>
            <GoldRule width={WIDTH - 68} />
          </div>

          <div style={{ display: "flex", position: "relative", flexDirection: "column" }}>
            {rows.map((r, i) => (
              <StatRow key={i} row={r} />
            ))}
          </div>

          {/* every champion played in the sample, not just the headline one */}
          <div style={{ display: "flex", position: "relative", alignItems: "flex-start", marginTop: 14 }}>
            <ChampionPool tallies={input.a.champions} icons={poolIcons} alignRight={false} />
            <CentreLabel text="แชมป์ที่เล่น" />
            <ChampionPool tallies={input.b.champions} icons={poolIcons} alignRight={true} />
          </div>

          <div style={{ display: "flex", position: "relative", alignItems: "center", marginTop: 12 }}>
            <RoleStrip roles={input.a.roles} alignRight={false} />
            <CentreLabel text="ตำแหน่ง" />
            <RoleStrip roles={input.b.roles} alignRight={true} />
          </div>

          <div
            style={{
              display: "flex",
              position: "relative",
              flexDirection: "column",
              marginTop: 16,
              padding: "14px 18px",
              background: "rgba(4,16,28,0.85)",
              border: `1px solid ${LOL.goldDim}`,
              borderLeft: `3px solid ${LOL.gold}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12, marginRight: 8 }}>ฉายาผู้แพ้</div>
              <div style={{ display: "flex", color: LOL.loss, fontSize: 17, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                {`${loser.gameName} — "${input.loserTitle}"`}
              </div>
            </div>
            <div style={{ display: "flex", color: LOL.text, fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
              {input.verdict}
            </div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
