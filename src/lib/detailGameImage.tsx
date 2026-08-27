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

function PlayerRow({ data }: { data: PlayerRowData }) {
  const p = data.player;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "5px 6px",
        background: p.isMe ? "rgba(200,170,110,0.10)" : "transparent",
        borderLeft: p.isMe ? "2px solid #C8AA6E" : "2px solid transparent",
        borderRadius: 2,
        marginBottom: 2,
      }}
    >
      <div style={{ display: "flex", position: "relative", width: 42, height: 42, marginRight: 6 }}>
        <div
          style={{
            display: "flex",
            width: 38,
            height: 38,
            borderRadius: 2,
            overflow: "hidden",
            background: "#04101C",
            border: "1px solid #463714",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.champIconUrl} width={38} height={38} alt="" />
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
          <IconBox url={data.spell1Url} size={18} />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.spell2Url} size={18} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginRight: 6 }}>
        <div style={{ display: "flex", marginBottom: 2 }}>
          <IconBox url={data.keystoneUrl} size={18} ring="#4D9BE655" />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.subTreeUrl} size={18} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 100, marginRight: 4 }}>
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

      <div style={{ display: "flex", flexDirection: "column", width: 38, marginRight: 4, alignItems: "flex-end" }}>
        <div style={{ display: "flex", color: "#A09B8C", fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>CS</div>
        <div style={{ display: "flex", color: "#F0E6D2", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{`${p.cs}`}</div>
      </div>

      <div style={{ display: "flex" }}>
        {data.itemUrls.map((u, i) => (
          <div key={i} style={{ display: "flex", marginRight: i === 5 ? 4 : 2 }}>
            <IconBox url={u} size={22} ring={i === 6 ? "#4D9BE655" : undefined} />
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
        padding: "10px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, paddingLeft: 6 }}>
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
            padding: "20px 28px",
            fontFamily: BODY_FONT,
            border: "1px solid #463714",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 3,
              padding: "16px 20px",
              marginBottom: 14,
              border: `2px solid ${resultColor}`,
              backgroundColor: "#010A13",
              backgroundImage: `linear-gradient(90deg, rgba(1,10,19,0.96) 0%, rgba(1,10,19,0.7) 55%, rgba(1,10,19,0.35) 100%), url(${champSplashUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
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

          <div
            style={{
              display: "flex",
              background: "#0A1428",
              border: "1px solid #463714",
              borderRadius: 3,
              padding: "12px 14px",
              marginBottom: 14,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", marginRight: 12 }}>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <IconBox url={spell1} size={38} />
              </div>
              <div style={{ display: "flex" }}>
                <IconBox url={spell2} size={38} />
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
                <IconBox url={item0} size={52} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item1} size={52} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item2} size={52} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item3} size={52} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item4} size={52} />
              </div>
              <div style={{ display: "flex", marginRight: 6 }}>
                <IconBox url={item5} size={52} />
              </div>
              <div style={{ display: "flex" }}>
                <IconBox url={item6} size={52} ring="#4D9BE655" />
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

          <div style={{ display: "flex", marginBottom: 14 }}>
            <GoldRule width={1044} />
          </div>

          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flex: 1, marginRight: 6 }}>
              <TeamColumn label="BLUE TEAM" color="#4D9BE6" rows={blueRows} />
            </div>
            <div style={{ display: "flex", flex: 1, marginLeft: 6 }}>
              <TeamColumn label="RED TEAM" color="#C6443E" rows={redRows} />
            </div>
          </div>
        </div>
      ),
      {
        width: 1100,
        height: 643,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
