import { ImageResponse } from "next/og";
import { getChampionIconUrl, getChampionSplashUrl } from "./ddragon";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT, LOL } from "./imageCommon";
import { GoldRule } from "./imageParts";

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
}

export interface VersusImageInput {
  a: VersusSideInput;
  b: VersusSideInput;
  winner: "a" | "b";
  verdict: string;
  loserTitle: string;
}

const WIDTH = 1100;
const HEIGHT = 700;
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
  const [iconA, iconB, splashUrl, fonts] = await Promise.all([
    getChampionIconUrl(input.a.topChampion),
    getChampionIconUrl(input.b.topChampion),
    getChampionSplashUrl(input.winner === "a" ? input.a.topChampion : input.b.topChampion),
    loadImageFonts(),
  ]);

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

          <div
            style={{
              display: "flex",
              position: "relative",
              flexDirection: "column",
              marginTop: 14,
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
