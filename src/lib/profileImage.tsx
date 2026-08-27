import { ImageResponse } from "next/og";
import { getChampionSplashUrl } from "./ddragon";
import { getLatestVersion } from "./champions";
import {
  loadImageFonts,
  DISPLAY_FONT,
  BODY_FONT,
  getRankedEmblemUrl,
  getMasteryCrestUrl,
  rankedEmblemCrop,
  masteryCrestCrop,
  ArtCropBox,
  LOL,
} from "./imageCommon";
import { GoldRule } from "./imageParts";
import { LeagueEntry } from "./riot";

export interface ProfileImageInput {
  gameName: string;
  tagLine: string;
  summonerLevel: number;
  profileIconId: number;
  soloDuo?: LeagueEntry;
  flex?: LeagueEntry;
  masteries: { championName: string; championLevel: number; championPoints: number }[];
}

const WIDTH = 1100;
const HEIGHT = 720;

function winRate(w: number, l: number): number {
  const total = w + l;
  if (total === 0) return 0;
  return Math.round((w / total) * 100);
}

/** 210,000 -> "210K", 1,240,000 -> "1.24M" */
function formatPoints(points: number): string {
  if (points >= 1000000) return (points / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (points >= 1000) return Math.round(points / 1000) + "K";
  return `${points}`;
}

/** Draws Riot art cropped to its real bounds instead of its padded canvas. */
function ArtCrop({ url, box }: { url: string; box: ArtCropBox }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: box.width,
        height: box.height,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        width={box.imgWidth}
        height={box.imgHeight}
        alt=""
        style={{ position: "absolute", left: box.left, top: box.top }}
      />
    </div>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", width: 3, height: 20, background: LOL.gold, marginRight: 10 }} />
      <div
        style={{
          display: "flex",
          color: LOL.text,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2,
          fontFamily: DISPLAY_FONT,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12, marginLeft: 10 }}>{subtitle}</div>
    </div>
  );
}

function RankCard({
  title,
  subtitle,
  entry,
  accent,
}: {
  title: string;
  subtitle: string;
  entry: LeagueEntry | undefined;
  accent: string;
}) {
  const wr = entry ? winRate(entry.wins, entry.losses) : 0;
  const emblemUrl = getRankedEmblemUrl(entry?.tier);
  const emblemBox = rankedEmblemCrop(190);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 506,
        height: 214,
        background: "rgba(4,16,28,0.72)",
        border: `1px solid ${LOL.goldDim}`,
        borderRadius: 3,
        padding: "16px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", width: 3, height: 26, background: accent, marginRight: 10 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: LOL.text,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2,
              fontFamily: DISPLAY_FONT,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      {entry && emblemUrl ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
            <ArtCrop url={emblemUrl} box={emblemBox} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
              <div
                style={{
                  display: "flex",
                  color: LOL.text,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 1,
                  fontFamily: DISPLAY_FONT,
                }}
              >
                {`${entry.tier} ${entry.rank}`}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
                <div style={{ display: "flex", color: LOL.gold, fontSize: 30, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                  {`${entry.leaguePoints}`}
                </div>
                <div style={{ display: "flex", color: LOL.textMuted, fontSize: 14, marginLeft: 6 }}>LP</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
                <div style={{ display: "flex", color: LOL.textMuted, fontSize: 13 }}>
                  {`${entry.wins}W / ${entry.losses}L`}
                </div>
                <div
                  style={{
                    display: "flex",
                    color: wr >= 50 ? LOL.win : LOL.loss,
                    fontSize: 13,
                    fontWeight: 700,
                    marginLeft: 8,
                  }}
                >
                  {`${wr}%`}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 150 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                color: LOL.textFaint,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 3,
                fontFamily: DISPLAY_FONT,
              }}
            >
              UNRANKED
            </div>
            <div style={{ display: "flex", color: LOL.textFaint, fontSize: 12, marginTop: 6 }}>ยังไม่จัดอันดับ</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasteryCard({
  rank,
  name,
  level,
  points,
  splashUrl,
  crestUrl,
}: {
  rank: number;
  name: string;
  level: number;
  points: number;
  splashUrl: string | null;
  crestUrl: string;
}) {
  const isTop = rank === 1;
  const crestBox = masteryCrestCrop(112);
  const CARD_W = 332;
  const CARD_H = 168;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: LOL.bgPanel,
        border: `1px solid ${isTop ? LOL.gold : LOL.goldDim}`,
        borderRadius: 3,
      }}
    >
      {splashUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={splashUrl}
          width={CARD_W}
          height={196}
          alt=""
          style={{ position: "absolute", top: -22, left: 0, objectFit: "cover" }}
        />
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: CARD_W,
          height: CARD_H,
          background:
            "linear-gradient(180deg, rgba(1,10,19,0.35) 0%, rgba(1,10,19,0.80) 55%, rgba(1,10,19,0.97) 100%)",
        }}
      />

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          flexDirection: "column",
          alignItems: "center",
          width: CARD_W,
          height: CARD_H,
          padding: "10px 0 12px 0",
        }}
      >
        <ArtCrop url={crestUrl} box={crestBox} />

        <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
          <div style={{ display: "flex", color: LOL.text, fontSize: 20, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
            {name}
          </div>
          {level > 10 && (
            <div
              style={{
                display: "flex",
                marginLeft: 8,
                color: LOL.gold,
                fontSize: 11,
                fontWeight: 700,
                border: `1px solid ${LOL.goldDim}`,
                background: "rgba(1,10,19,0.7)",
                padding: "1px 6px",
                fontFamily: DISPLAY_FONT,
              }}
            >
              {`LV ${level}`}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
          <div style={{ display: "flex", color: LOL.gold, fontSize: 22, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
            {formatPoints(points)}
          </div>
          <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginLeft: 6 }}>แต้ม</div>
        </div>
      </div>
    </div>
  );
}

export async function generateProfileImage(input: ProfileImageInput): Promise<Buffer> {
  const version = await getLatestVersion();
  const profileIconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${input.profileIconId}.png`;
  const soloEmblemUrl = getRankedEmblemUrl(input.soloDuo?.tier) ?? getRankedEmblemUrl(input.flex?.tier);

  const topMasteries = input.masteries.slice(0, 3);
  const [masterySplashes, fonts] = await Promise.all([
    Promise.all(topMasteries.map(m => getChampionSplashUrl(m.championName))),
    loadImageFonts(),
  ]);

  // the signature champion sets the mood of the whole card
  const heroSplash = masterySplashes[0];
  const headerEmblem = rankedEmblemCrop(250);
  const rankLine = input.soloDuo
    ? `${input.soloDuo.tier} ${input.soloDuo.rank}`
    : input.flex
    ? `${input.flex.tier} ${input.flex.rank}`
    : "UNRANKED";

  const response = new ImageResponse(
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
          padding: "26px 32px",
          fontFamily: BODY_FONT,
        }}
      >
        {/* signature champion splash behind the header, faded into the page */}
        {heroSplash && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroSplash}
            width={WIDTH}
            height={649}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
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
              "linear-gradient(180deg, rgba(1,10,19,0.80) 0%, rgba(1,10,19,0.90) 26%, rgba(1,10,19,0.99) 46%, #010A13 62%)",
          }}
        />

        {/* hextech corner accents */}
        <div style={{ display: "flex", position: "absolute", top: 8, left: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
        <div style={{ display: "flex", position: "absolute", top: 8, right: 8, width: 28, height: 28, borderTop: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />
        <div style={{ display: "flex", position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderLeft: `2px solid ${LOL.goldDark}` }} />
        <div style={{ display: "flex", position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderBottom: `2px solid ${LOL.goldDark}`, borderRight: `2px solid ${LOL.goldDark}` }} />

        {/* ---------- header ---------- */}
        <div style={{ display: "flex", position: "relative", alignItems: "center", height: 200 }}>
          <div
            style={{
              display: "flex",
              position: "relative",
              width: headerEmblem.width,
              height: headerEmblem.height,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 24,
            }}
          >
            {soloEmblemUrl && <ArtCrop url={soloEmblemUrl} box={headerEmblem} />}
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: Math.round(headerEmblem.height / 2) - 44,
                left: Math.round(headerEmblem.width / 2) - 41,
                width: 82,
                height: 82,
                borderRadius: 41,
                overflow: "hidden",
                border: `3px solid ${LOL.gold}`,
                background: LOL.bgDeep,
              }}
            >
              {/* satori will not clip an img to the parent's rounded corners when
                  that parent also has a border, so round the image itself */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profileIconUrl} width={82} height={82} alt="" style={{ borderRadius: 41 }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: LOL.gold,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 5,
                fontFamily: DISPLAY_FONT,
              }}
            >
              SUMMONER PROFILE
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
              <div style={{ display: "flex", color: LOL.text, fontSize: 44, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                {input.gameName}
              </div>
              <div style={{ display: "flex", color: LOL.goldDark, fontSize: 24, marginLeft: 8, fontFamily: DISPLAY_FONT }}>
                #{input.tagLine}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  color: LOL.gold,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  border: `1px solid ${LOL.goldDim}`,
                  background: "rgba(1,10,19,0.6)",
                  padding: "3px 10px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                {rankLine}
              </div>
              <div
                style={{
                  display: "flex",
                  color: LOL.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  border: `1px solid ${LOL.divider}`,
                  background: "rgba(1,10,19,0.6)",
                  padding: "3px 10px",
                  marginLeft: 8,
                  fontFamily: DISPLAY_FONT,
                }}
              >
                {`LEVEL ${input.summonerLevel}`}
              </div>
              <div
                style={{
                  display: "flex",
                  color: LOL.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  border: `1px solid ${LOL.divider}`,
                  background: "rgba(1,10,19,0.6)",
                  padding: "3px 10px",
                  marginLeft: 8,
                  fontFamily: DISPLAY_FONT,
                }}
              >
                TH
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", position: "relative", marginTop: 4, marginBottom: 18 }}>
          <GoldRule width={WIDTH - 64} />
        </div>

        {/* ---------- ranked queues ---------- */}
        <div style={{ display: "flex", position: "relative", justifyContent: "space-between" }}>
          <RankCard title="RANKED SOLO/DUO" subtitle="แรงค์เดี่ยว" entry={input.soloDuo} accent={LOL.gold} />
          <RankCard title="RANKED FLEX" subtitle="แรงค์ทีม" entry={input.flex} accent={LOL.win} />
        </div>

        {/* ---------- mastery ---------- */}
        <div style={{ display: "flex", position: "relative", marginTop: 20, marginBottom: 10 }}>
          <SectionLabel title="TOP MASTERY" subtitle="แชมเปี้ยนช่ำชองสูงสุด" />
        </div>

        <div style={{ display: "flex", position: "relative", justifyContent: "space-between" }}>
          {topMasteries.length > 0 ? (
            topMasteries.map((m, i) => (
              <MasteryCard
                key={i}
                rank={i + 1}
                name={m.championName}
                level={m.championLevel}
                points={m.championPoints}
                splashUrl={masterySplashes[i]}
                crestUrl={getMasteryCrestUrl(m.championLevel)}
              />
            ))
          ) : (
            <div style={{ display: "flex", color: LOL.textFaint, fontSize: 15 }}>ไม่มีข้อมูลความช่ำชอง</div>
          )}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts.length ? fonts : undefined,
    }
  );

  return Buffer.from(await response.arrayBuffer());
}
