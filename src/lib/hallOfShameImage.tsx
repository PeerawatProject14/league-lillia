import { ImageResponse } from "next/og";
import { getChampionIconUrl } from "./ddragon";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT, LOL } from "./imageCommon";
import { GoldRule } from "./imageParts";

export interface ShameAward {
  title: string; // Thai award name
  subtitle: string; // what earned it
  value: string; // the damning number
  championName: string;
  win: boolean;
}

export interface HallOfShameImageInput {
  gameName: string;
  tagLine: string;
  games: number;
  awards: ShameAward[];
}

const WIDTH = 1100;
const CARD_W = 508;
const CARD_H = 116;
const HEADER_H = 150;

function AwardCard({ award, iconUrl, isRight }: { award: ShameAward; iconUrl: string | null; isRight: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: CARD_W,
        height: CARD_H,
        background: "rgba(4,16,28,0.8)",
        border: `1px solid ${LOL.goldDim}`,
        borderLeft: `3px solid ${LOL.loss}`,
        borderRadius: 3,
        padding: "0 16px",
        marginLeft: isRight ? 12 : 0,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 64,
          height: 64,
          borderRadius: 2,
          overflow: "hidden",
          background: LOL.bgSlot,
          border: `2px solid ${award.win ? LOL.goldDim : LOL.loss}`,
          marginRight: 16,
        }}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} width={64} height={64} alt="" />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 268 }}>
        <div style={{ display: "flex", color: LOL.gold, fontSize: 17, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
          {award.title}
        </div>
        <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12, marginTop: 4 }}>{award.subtitle}</div>
        <div style={{ display: "flex", color: LOL.textFaint, fontSize: 11, marginTop: 4 }}>
          {`${award.championName} · ${award.win ? "ชนะ (แต่ก็เถอะ)" : "แพ้"}`}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", color: LOL.loss, fontSize: 26, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
        {award.value}
      </div>
    </div>
  );
}

export async function generateHallOfShameImage(input: HallOfShameImageInput): Promise<Buffer> {
  const [iconUrls, fonts] = await Promise.all([
    Promise.all(input.awards.map(a => getChampionIconUrl(a.championName))),
    loadImageFonts(),
  ]);

  const rows = Math.ceil(input.awards.length / 2);
  const height = HEADER_H + rows * (CARD_H + 12) + 26;

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
            background: `linear-gradient(160deg, ${LOL.bgDeep} 0%, ${LOL.bgPanel} 55%, ${LOL.bgDeep} 100%)`,
            border: `1px solid ${LOL.goldDim}`,
            padding: "26px 34px",
            fontFamily: BODY_FONT,
          }}
        >
          <div style={{ display: "flex", position: "absolute", top: 8, left: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", top: 8, right: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
          <div style={{ display: "flex", position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                color: LOL.loss,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 6,
                fontFamily: DISPLAY_FONT,
              }}
            >
              HALL OF SHAME
            </div>
            <div style={{ display: "flex", color: LOL.text, fontSize: 30, fontWeight: 700, marginTop: 6, fontFamily: DISPLAY_FONT }}>
              หอเกียรติยศความห่วย
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
              <div style={{ display: "flex", color: LOL.gold, fontSize: 17, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                {input.gameName}
              </div>
              <div style={{ display: "flex", color: LOL.goldDark, fontSize: 13, marginLeft: 4 }}>#{input.tagLine}</div>
              <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12, marginLeft: 10 }}>
                {`· คัดจาก ${input.games} เกมล่าสุด`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 16, marginBottom: 16 }}>
            <GoldRule width={WIDTH - 68} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {input.awards.map((a, i) => (
              <AwardCard key={i} award={a} iconUrl={iconUrls[i]} isRight={i % 2 === 1} />
            ))}
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
