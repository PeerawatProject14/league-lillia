import { ImageResponse } from "next/og";
import {
  getItemIconById,
  getSummonerSpellIconById,
  getRuneIconById,
} from "./ddragon";
import { getLatestVersion } from "./champions";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT } from "./imageCommon";
import { GoldRule } from "./imageParts";
import { MatchParticipant } from "./riot";

// Hero banner: 1040 wide inside the card's 1044px content box (2px border each
// side). The splash is 1215x717, so covering 1040 wide makes it 614 tall; the
// offset puts the art's 30% line on the banner's centre.
const BANNER_W = 852;
const BANNER_H = 96;
const BANNER_ART_H = Math.round(BANNER_W * (717 / 1215));
const BANNER_ART_TOP = Math.round(BANNER_H / 2 - BANNER_ART_H * 0.3);

export interface DetailPlayerEntry {
  name: string;
  championDisplayName: string;
  championIdName: string;
  kills: number;
  deaths: number;
  assists: number;
  champLevel: number;
  cs: number;
  isMe: boolean;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  keystoneId: number | null;
  subStyleId: number | null;
  visionScore: number;
  damage: number;
  gold: number;
  role: string;
  win: boolean;
  pentaKills: number;
  soloKills: number;
  teamDamageShare: number;
  /** Earned badges for this match, filled in by the handler. */
  titles?: { text: string; tone: "good" | "bad" | "neutral"; top: boolean; legendary: boolean }[];
}

export interface DetailGameImageInput {
  gameName: string;
  tagLine: string;
  matchId: string;
  gameMode: string;
  gameDurationMinutes: number;
  player: MatchParticipant & { championDisplayName: string; championIdName: string };
  teamBlue: DetailPlayerEntry[];
  teamRed: DetailPlayerEntry[];
}

const ROLE_LABEL: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SUP",
};

interface PlayerRowData {
  player: DetailPlayerEntry;
  champIconUrl: string;
  spell1Url: string | null;
  spell2Url: string | null;
  keystoneUrl: string | null;
  subTreeUrl: string | null;
  itemUrls: (string | null)[];
}

function IconBox({
  url,
  size,
  ring,
  rounded,
}: {
  url: string | null;
  size: number;
  ring?: string;
  rounded?: boolean;
}) {
  const isEmpty = !url;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: rounded ? size / 2 : 2,
        overflow: "hidden",
        background: isEmpty ? "rgba(4,16,28,0.5)" : "#04101C",
        border: isEmpty
          ? "1px dashed rgba(70,55,20,0.45)"
          : ring
          ? `1px solid ${ring}`
          : "1px solid #463714",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={size} height={size} alt="" />
      ) : null}
    </div>
  );
}


const BADGE_PURPLE = "#B084E8";
const BADGE_GOLD = "#C8AA6E";
const BADGE_GREEN = "#4FCF8B";
const BADGE_RED = "#C6443E";
const BADGE_GREY = "#5B5A56";

/** Inline SVG so the star does not depend on the font having the glyph. */
const STAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>" +
  "<path d='M5 0 L6.2 3.6 L10 3.6 L6.9 5.85 L8.1 9.5 L5 7.2 L1.9 9.5 L3.1 5.85 L0 3.6 L3.8 3.6 Z' fill='%23C8AA6E'/></svg>";

/** Crown marks the rare purple tier, the way the star marks gold. */
const CROWN_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'>" +
  "<path d='M0 2.2 L2.6 5 L6 0.6 L9.4 5 L12 2.2 L10.6 9.4 L1.4 9.4 Z' fill='%23B084E8'/></svg>";

function Badge({
  text,
  tone,
  top,
  legendary,
}: {
  text: string;
  tone: "good" | "bad" | "neutral";
  top: boolean;
  legendary: boolean;
}) {
  const colour = legendary
    ? BADGE_PURPLE
    : top && tone === "good"
    ? BADGE_GOLD
    : tone === "good"
    ? BADGE_GREEN
    : tone === "bad"
    ? BADGE_RED
    : BADGE_GREY;
  const tint = legendary
    ? "rgba(176,132,232,0.16)"
    : top && tone === "good"
    ? "rgba(200,170,110,0.12)"
    : tone === "good"
    ? "rgba(79,207,139,0.10)"
    : tone === "bad"
    ? "rgba(198,68,62,0.12)"
    : "rgba(1,10,19,0.6)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        color: colour,
        fontSize: 10,
        border: `1px solid ${legendary ? colour : colour + "66"}`,
        background: tint,
        padding: "2px 7px",
        marginRight: 5,
        fontWeight: legendary ? 700 : 400,
      }}
    >
      {legendary && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={CROWN_SVG} width={11} height={9} alt="" style={{ marginRight: 4 }} />
      )}
      {!legendary && top && tone === "good" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={STAR_SVG} width={9} height={9} alt="" style={{ marginRight: 4 }} />
      )}
      {text}
    </div>
  );
}

function PlayerRow({ data }: { data: PlayerRowData }) {
  const p = data.player;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "3px 6px",
        background: p.isMe ? "rgba(200,170,110,0.10)" : "transparent",
        borderLeft: p.isMe ? "2px solid #C8AA6E" : "2px solid transparent",
        borderRadius: 2,
        marginBottom: 2,
      }}
    >
      <div style={{ display: "flex", position: "relative", width: 38, height: 38, marginRight: 6 }}>
        <div
          style={{
            display: "flex",
            width: 34,
            height: 34,
            borderRadius: 2,
            overflow: "hidden",
            background: "#04101C",
            border: "1px solid #463714",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.champIconUrl} width={34} height={34} alt="" />
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            right: 0,
            background: "#010A13",
            color: "#F0E6D2",
            fontSize: 9,
            fontWeight: 700,
            padding: "0 3px",
            borderRadius: 2,
            border: "1px solid #463714",
            justifyContent: "center",
          }}
        >
          {p.champLevel}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginRight: 4 }}>
        <div style={{ display: "flex", marginBottom: 2 }}>
          <IconBox url={data.spell1Url} size={16} />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.spell2Url} size={16} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginRight: 6 }}>
        <div style={{ display: "flex", marginBottom: 2 }}>
          <IconBox url={data.keystoneUrl} size={16} ring="#4D9BE655" />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.subTreeUrl} size={16} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 126, marginRight: 6 }}>
        <div
          style={{
            display: "flex",
            color: "#F0E6D2",
            fontSize: 11,
            fontWeight: p.isMe ? 700 : 500,
            overflow: "hidden",
          }}
        >
          {p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}
        </div>
        <div style={{ display: "flex", fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          <div style={{ display: "flex", color: "#F0E6D2" }}>{`${p.kills}`}</div>
          <div style={{ display: "flex", color: "#A09B8C", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex", color: "#C6443E" }}>{`${p.deaths}`}</div>
          <div style={{ display: "flex", color: "#A09B8C", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex", color: "#F0E6D2" }}>{`${p.assists}`}</div>
        </div>
      </div>

      {/* one line only: the teams stack vertically so there is room for it */}
      <div style={{ display: "flex", alignItems: "center", width: 330, overflow: "hidden", marginRight: 4 }}>
        {(p.titles ?? []).map((t, i) => (
          <Badge key={i} text={t.text} tone={t.tone} top={t.top} legendary={t.legendary} />
        ))}
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", width: 36, marginRight: 6, alignItems: "flex-end" }}>
        <div style={{ display: "flex", color: "#A09B8C", fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>CS</div>
        <div style={{ display: "flex", color: "#F0E6D2", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{`${p.cs}`}</div>
      </div>

      <div style={{ display: "flex" }}>
        {data.itemUrls.map((u, i) => (
          <div key={i} style={{ display: "flex", marginRight: i === 5 ? 4 : 2 }}>
            <IconBox url={u} size={21} ring={i === 6 ? "#4D9BE655" : undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamColumn({
  label,
  color,
  rows,
}: {
  label: string;
  color: string;
  rows: PlayerRowData[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "#0A1428",
        border: `1px solid ${color}40`,
        borderTop: `3px solid ${color}`,
        borderRadius: 3,
        padding: "8px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6, paddingLeft: 6 }}>
        <div style={{ display: "flex", color, fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: DISPLAY_FONT }}>
          {label}
        </div>
      </div>
      {rows.map((r, i) => (
        <PlayerRow key={i} data={r} />
      ))}
    </div>
  );
}

async function buildPlayerRows(players: DetailPlayerEntry[], version: string): Promise<PlayerRowData[]> {
  return Promise.all(
    players.map(async p => {
      const [spell1Url, spell2Url, keystoneUrl, subTreeUrl, ...itemUrls] = await Promise.all([
        getSummonerSpellIconById(p.summoner1Id),
        getSummonerSpellIconById(p.summoner2Id),
        p.keystoneId ? getRuneIconById(p.keystoneId) : Promise.resolve(null),
        p.subStyleId ? getRuneIconById(p.subStyleId) : Promise.resolve(null),
        getItemIconById(p.item0),
        getItemIconById(p.item1),
        getItemIconById(p.item2),
        getItemIconById(p.item3),
        getItemIconById(p.item4),
        getItemIconById(p.item5),
        getItemIconById(p.item6),
      ]);
      return {
        player: p,
        champIconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championIdName}.png`,
        spell1Url,
        spell2Url,
        keystoneUrl,
        subTreeUrl,
        itemUrls,
      };
    })
  );
}

export async function generateDetailGameImage(input: DetailGameImageInput): Promise<Buffer> {
  const version = await getLatestVersion();
  const champIconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${input.player.championIdName}.png`;
  const champSplashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${input.player.championIdName}_0.jpg`;

  const p = input.player;

  const [item0, item1, item2, item3, item4, item5, item6, spell1, spell2] = await Promise.all([
    getItemIconById(p.item0),
    getItemIconById(p.item1),
    getItemIconById(p.item2),
    getItemIconById(p.item3),
    getItemIconById(p.item4),
    getItemIconById(p.item5),
    getItemIconById(p.item6),
    getSummonerSpellIconById(p.summoner1Id),
    getSummonerSpellIconById(p.summoner2Id),
  ]);

  const primaryStyle = p.perks?.styles?.find(s => s.description === "primaryStyle");
  const subStyle = p.perks?.styles?.find(s => s.description === "subStyle");
  const keystoneId = primaryStyle?.selections?.[0]?.perk;
  const [keystoneUrl, primaryTreeUrl, subTreeUrl] = await Promise.all([
    keystoneId ? getRuneIconById(keystoneId) : Promise.resolve(null),
    primaryStyle?.style ? getRuneIconById(primaryStyle.style) : Promise.resolve(null),
    subStyle?.style ? getRuneIconById(subStyle.style) : Promise.resolve(null),
  ]);

  const [blueRows, redRows] = await Promise.all([
    buildPlayerRows(input.teamBlue, version),
    buildPlayerRows(input.teamRed, version),
  ]);

  const totalCs = p.totalMinionsKilled + p.neutralMinionsKilled;
  const csPerMin = input.gameDurationMinutes > 0 ? totalCs / input.gameDurationMinutes : 0;
  const kda = p.deaths === 0 ? "Perfect" : ((p.kills + p.assists) / p.deaths).toFixed(2);
  const resultColor = p.win ? "#0AC8B9" : "#C6443E";
  const resultLabel = p.win ? "VICTORY" : "DEFEAT";
  const resultLabelTh = p.win ? "ชนะ" : "แพ้";
  const role = ROLE_LABEL[p.individualPosition] ?? p.individualPosition;

  const fonts = await loadImageFonts();

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "#010A13",
            padding: "14px 22px",
            fontFamily: BODY_FONT,
            border: "1px solid #463714",
          }}
        >
          {/* Banner art is a real <img>: satori applies backgroundSize to the
              first background layer only, so a gradient + url() pair left the
              splash at natural size and tiled it. */}
          <div
            style={{
              display: "flex",
              position: "relative",
              width: BANNER_W,
              height: BANNER_H,
              overflow: "hidden",
              borderRadius: 3,
              marginBottom: 10,
              border: `2px solid ${resultColor}`,
              background: "#010A13",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={champSplashUrl}
              width={BANNER_W}
              height={BANNER_ART_H}
              alt=""
              style={{ position: "absolute", left: 0, top: BANNER_ART_TOP }}
            />
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: 0,
                left: 0,
                width: BANNER_W,
                height: BANNER_H,
                background:
                  "linear-gradient(90deg, rgba(1,10,19,0.96) 0%, rgba(1,10,19,0.72) 55%, rgba(1,10,19,0.38) 100%)",
              }}
            />
            <div
              style={{
                display: "flex",
                position: "relative",
                alignItems: "center",
                width: BANNER_W,
                height: BANNER_H,
                padding: "0 20px",
              }}
            >
            <div
              style={{
                display: "flex",
                width: 84,
                height: 84,
                borderRadius: 3,
                overflow: "hidden",
                border: `2px solid ${resultColor}`,
                marginRight: 18,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={champIconUrl} width={84} height={84} alt="" />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: resultColor, fontSize: 14, fontWeight: 700, letterSpacing: 2, fontFamily: DISPLAY_FONT }}>
                {`${resultLabel} · ${resultLabelTh}`}
              </div>
              <div style={{ display: "flex", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#F0E6D2", fontSize: 26, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: "#A09B8C", fontSize: 18, marginLeft: 4, alignItems: "center" }}>
                  {`#${input.tagLine}`}
                </div>
              </div>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 13, marginTop: 3 }}>
                {`เล่น ${input.player.championDisplayName} · ${role} · ${input.gameMode} · ${Math.floor(input.gameDurationMinutes)} นาที`}
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>KDA</div>
              <div style={{ display: "flex", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#F0E6D2", fontSize: 22, fontWeight: 700, fontFamily: DISPLAY_FONT }}>{`${p.kills}`}</div>
                <div style={{ display: "flex", color: "#A09B8C", fontSize: 22, margin: "0 4px" }}>/</div>
                <div style={{ display: "flex", color: "#C6443E", fontSize: 22, fontWeight: 700, fontFamily: DISPLAY_FONT }}>{`${p.deaths}`}</div>
                <div style={{ display: "flex", color: "#A09B8C", fontSize: 22, margin: "0 4px" }}>/</div>
                <div style={{ display: "flex", color: "#F0E6D2", fontSize: 22, fontWeight: 700, fontFamily: DISPLAY_FONT }}>{`${p.assists}`}</div>
              </div>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 12, marginTop: 2 }}>{`${kda}:1`}</div>
            </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              background: "#0A1428",
              border: "1px solid #463714",
              borderRadius: 3,
              padding: "10px 14px",
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", marginRight: 12 }}>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <IconBox url={spell1} size={32} />
              </div>
              <div style={{ display: "flex" }}>
                <IconBox url={spell2} size={32} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginRight: 14 }}>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={keystoneUrl} size={48} ring="#4D9BE6" rounded />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <IconBox url={primaryTreeUrl} size={24} rounded />
                </div>
                <div style={{ display: "flex" }}>
                  <IconBox url={subTreeUrl} size={24} rounded />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", width: 1, height: 56, background: "#463714", marginRight: 14 }} />

            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item0} size={44} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item1} size={44} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item2} size={44} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item3} size={44} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item4} size={44} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item5} size={44} />
              </div>
              <div style={{ display: "flex" }}>
                <IconBox url={item6} size={44} ring="#4D9BE655" />
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>CS</div>
              <div style={{ display: "flex", color: "#F0E6D2", fontSize: 16, fontWeight: 700 }}>{`${totalCs}`}</div>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11 }}>{`${csPerMin.toFixed(1)}/min`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>VISION</div>
              <div style={{ display: "flex", color: "#F0E6D2", fontSize: 16, fontWeight: 700 }}>{`${p.visionScore}`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>DMG</div>
              <div style={{ display: "flex", color: "#F0E6D2", fontSize: 16, fontWeight: 700 }}>
                {`${(p.totalDamageDealtToChampions / 1000).toFixed(1)}k`}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>GOLD</div>
              <div style={{ display: "flex", color: "#F0E6D2", fontSize: 16, fontWeight: 700 }}>
                {`${(p.goldEarned / 1000).toFixed(1)}k`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", marginBottom: 10 }}>
            <GoldRule width={852} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", marginBottom: 8 }}>
              <TeamColumn label="BLUE TEAM" color="#4D9BE6" rows={blueRows} />
            </div>
            <div style={{ display: "flex" }}>
              <TeamColumn label="RED TEAM" color="#C6443E" rows={redRows} />
            </div>
          </div>
        </div>
      ),
      {
        width: 900,
        height: 806,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
