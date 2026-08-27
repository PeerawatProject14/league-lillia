import { ImageResponse } from "next/og";
import { getChampionSplashUrl, getChampionIconUrl } from "./ddragon";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT, LOL } from "./imageCommon";
import { GoldRule } from "./imageParts";

export interface RoastImageInput {
  gameName: string;
  tagLine: string;
  nickname: string;
  burns: string[];
  verdict: string;
  cringeScore: number; // 0-100
  topChampion: string;
  games: number;
  wins: number;
  totalDeaths: number;
  avgKda: string;
}

const WIDTH = 1100;
const HEIGHT = 560;

/** The score bar runs from "ยังพอไหว" to "เลิกเล่นเถอะ" */
function scoreColor(score: number): string {
  if (score >= 75) return LOL.loss;
  if (score >= 45) return "#E0836A";
  return LOL.win;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "เลิกเล่นเถอะ";
  if (score >= 70) return "อินติงระดับตำนาน";
  if (score >= 50) return "ก็อินติงอยู่นะ";
  if (score >= 30) return "พอถูไถ";
  return "ยังพอไหว";
}

function Burn({ text, index }: { text: string; index: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          width: 26,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${LOL.goldDim}`,
          background: "rgba(1,10,19,0.75)",
          color: LOL.gold,
          fontSize: 12,
          fontWeight: 700,
          marginRight: 14,
          fontFamily: DISPLAY_FONT,
        }}
      >
        {`${index + 1}`}
      </div>
      <div style={{ display: "flex", color: LOL.text, fontSize: 19, lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}

function Stat({ label, value, color = LOL.text }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 34 }}>
      <div
        style={{
          display: "flex",
          color: LOL.goldDark,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          fontFamily: DISPLAY_FONT,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", color, fontSize: 22, fontWeight: 700, marginTop: 4, fontFamily: DISPLAY_FONT }}>
        {value}
      </div>
    </div>
  );
}

export async function generateRoastImage(input: RoastImageInput): Promise<Buffer> {
  const [splashUrl, champIconUrl, fonts] = await Promise.all([
    getChampionSplashUrl(input.topChampion),
    getChampionIconUrl(input.topChampion),
    loadImageFonts(),
  ]);

  const score = Math.max(0, Math.min(100, Math.round(input.cringeScore)));
  const barColor = scoreColor(score);
  const winRate = input.games ? Math.round((input.wins / input.games) * 100) : 0;

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
            padding: "26px 34px",
            fontFamily: BODY_FONT,
          }}
        >
          {splashUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={splashUrl}
              width={WIDTH}
              height={649}
              alt=""
              style={{ position: "absolute", top: 0, left: 0 }}
            />
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
                "linear-gradient(180deg, rgba(1,10,19,0.86) 0%, rgba(1,10,19,0.93) 30%, rgba(1,10,19,0.99) 55%, #010A13 75%)",
            }}
          />

          <div style={{ display: "flex", position: "absolute", top: 8, left: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", top: 8, right: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />

          {/* header */}
          <div style={{ display: "flex", position: "relative", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 92,
                height: 92,
                borderRadius: 3,
                overflow: "hidden",
                border: `2px solid ${LOL.loss}`,
                background: LOL.bgSlot,
                marginRight: 20,
              }}
            >
              {champIconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={champIconUrl} width={92} height={92} alt="" />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  color: LOL.loss,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 5,
                  fontFamily: DISPLAY_FONT,
                }}
              >
                ROAST REPORT
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
                <div style={{ display: "flex", color: LOL.text, fontSize: 34, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: LOL.goldDark, fontSize: 20, marginLeft: 6, fontFamily: DISPLAY_FONT }}>
                  #{input.tagLine}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
                <div style={{ display: "flex", color: LOL.textMuted, fontSize: 13, marginRight: 8 }}>ฉายา</div>
                <div
                  style={{
                    display: "flex",
                    color: LOL.gold,
                    fontSize: 20,
                    fontWeight: 700,
                    border: `1px solid ${LOL.goldDim}`,
                    background: "rgba(1,10,19,0.7)",
                    padding: "2px 12px",
                  }}
                >
                  {`"${input.nickname}"`}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", position: "relative", marginTop: 18, marginBottom: 18 }}>
            <GoldRule width={WIDTH - 68} />
          </div>

          {/* burns */}
          <div style={{ display: "flex", position: "relative", flexDirection: "column" }}>
            {input.burns.slice(0, 3).map((b, i) => (
              <Burn key={i} text={b} index={i} />
            ))}
          </div>

          {/* verdict */}
          <div
            style={{
              display: "flex",
              position: "relative",
              marginTop: 6,
              padding: "14px 18px",
              background: "rgba(4,16,28,0.85)",
              border: `1px solid ${LOL.goldDim}`,
              borderLeft: `3px solid ${LOL.loss}`,
            }}
          >
            <div style={{ display: "flex", color: LOL.textMuted, fontSize: 16, lineHeight: 1.5 }}>{input.verdict}</div>
          </div>

          {/* cringe meter */}
          <div style={{ display: "flex", position: "relative", flexDirection: "column", marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
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
                ดัชนีความอินติง
              </div>
              <div style={{ display: "flex", flex: 1 }} />
              <div style={{ display: "flex", color: barColor, fontSize: 14, fontWeight: 700, marginRight: 10 }}>
                {scoreLabel(score)}
              </div>
              <div style={{ display: "flex", color: barColor, fontSize: 20, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                {`${score}`}
              </div>
            </div>
            <div style={{ display: "flex", width: "100%", height: 10, background: "rgba(1,10,19,0.9)", border: `1px solid ${LOL.goldDim}` }}>
              <div style={{ display: "flex", width: `${score}%`, height: 8, background: barColor }} />
            </div>
          </div>

          {/* stat strip */}
          <div style={{ display: "flex", position: "relative", alignItems: "center", marginTop: 22 }}>
            <Stat label="GAMES" value={`${input.games}`} />
            <Stat label="WINRATE" value={`${winRate}%`} color={winRate >= 50 ? LOL.win : LOL.loss} />
            <Stat label="AVG KDA" value={input.avgKda} />
            <Stat label="ตายรวม" value={`${input.totalDeaths}`} color={LOL.loss} />
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", color: LOL.textFaint, fontSize: 11 }}>วิเคราะห์โดย Gemini AI · ขำๆ นะ</div>
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
