import { ImageResponse } from "next/og";
import {
  getItemIconById,
  getSummonerSpellIconById,
  getRuneIconById,
} from "./ddragon";
import { getLatestVersion } from "./champions";
import { fetchThaiFont } from "./imageCommon";
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
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: rounded ? size / 2 : 4,
        overflow: "hidden",
        background: "#1f2230",
        border: ring ? `1px solid ${ring}` : "1px solid #2b2d35",
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
        background: p.isMe ? "rgba(241,196,15,0.10)" : "transparent",
        borderRadius: 6,
        marginBottom: 2,
      }}
    >
      <div style={{ display: "flex", position: "relative", width: 42, height: 42, marginRight: 6 }}>
        <div
          style={{
            display: "flex",
            width: 38,
            height: 38,
            borderRadius: 6,
            overflow: "hidden",
            background: "#1f2230",
            border: "1px solid #2b2d35",
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
            background: "#0f1117",
            color: "#ffffff",
            fontSize: 9,
            fontWeight: 700,
            padding: "0 3px",
            borderRadius: 4,
            border: "1px solid #2b2d35",
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
          <IconBox url={data.keystoneUrl} size={18} ring="#a78bfa55" />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.subTreeUrl} size={18} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 100, marginRight: 4 }}>
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: p.isMe ? 700 : 500,
            overflow: "hidden",
          }}
        >
          {p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}
        </div>
        <div style={{ display: "flex", fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          <div style={{ display: "flex", color: "#ffffff" }}>{`${p.kills}`}</div>
          <div style={{ display: "flex", color: "#9aa0b4", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex", color: "#ef4444" }}>{`${p.deaths}`}</div>
          <div style={{ display: "flex", color: "#9aa0b4", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex", color: "#ffffff" }}>{`${p.assists}`}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 38, marginRight: 4, alignItems: "flex-end" }}>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>CS</div>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{`${p.cs}`}</div>
      </div>

      <div style={{ display: "flex" }}>
        {data.itemUrls.map((u, i) => (
          <div key={i} style={{ display: "flex", marginRight: i === 5 ? 4 : 2 }}>
            <IconBox url={u} size={22} ring={i === 6 ? "#a78bfa55" : undefined} />
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
        background: "#161823",
        border: "1px solid #2b2d35",
        borderRadius: 12,
        padding: "10px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, paddingLeft: 6 }}>
        <div style={{ display: "flex", width: 4, height: 18, background: color, borderRadius: 2, marginRight: 8 }} />
        <div style={{ display: "flex", color: "#ffffff", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
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
  const resultColor = p.win ? "#22c55e" : "#ef4444";
  const resultLabel = p.win ? "VICTORY" : "DEFEAT";
  const resultLabelTh = p.win ? "ชนะ" : "แพ้";
  const role = ROLE_LABEL[p.individualPosition] ?? p.individualPosition;

  const thaiFont = await fetchThaiFont();

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "#0f1117",
            padding: "20px 28px",
            fontFamily: "Noto Sans Thai, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 14,
              border: `2px solid ${resultColor}`,
              background: "#161823",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 84,
                height: 84,
                borderRadius: 12,
                overflow: "hidden",
                border: `2px solid ${resultColor}`,
                marginRight: 18,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={champIconUrl} width={84} height={84} alt="" />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: resultColor, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
                {`${resultLabel} · ${resultLabelTh}`}
              </div>
              <div style={{ display: "flex", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 26, fontWeight: 700 }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: "#9aa0b4", fontSize: 18, marginLeft: 4, alignItems: "center" }}>
                  {`#${input.tagLine}`}
                </div>
              </div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 13, marginTop: 3 }}>
                {`เล่น ${input.player.championDisplayName} · ${role} · ${input.gameMode} · ${Math.floor(input.gameDurationMinutes)} นาที`}
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>KDA</div>
              <div style={{ display: "flex", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 22, fontWeight: 700 }}>{`${p.kills}`}</div>
                <div style={{ display: "flex", color: "#9aa0b4", fontSize: 22, margin: "0 4px" }}>/</div>
                <div style={{ display: "flex", color: "#ef4444", fontSize: 22, fontWeight: 700 }}>{`${p.deaths}`}</div>
                <div style={{ display: "flex", color: "#9aa0b4", fontSize: 22, margin: "0 4px" }}>/</div>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 22, fontWeight: 700 }}>{`${p.assists}`}</div>
              </div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12, marginTop: 2 }}>{`${kda}:1`}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              background: "#161823",
              border: "1px solid #2b2d35",
              borderRadius: 12,
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
                <IconBox url={keystoneUrl} size={48} ring="#a78bfa" rounded />
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

            <div style={{ display: "flex", width: 1, height: 56, background: "#2b2d35", marginRight: 14 }} />

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
                <IconBox url={item6} size={52} ring="#a78bfa55" />
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CS</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{`${totalCs}`}</div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11 }}>{`${csPerMin.toFixed(1)}/min`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>VISION</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{`${p.visionScore}`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>DMG</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
                {`${(p.totalDamageDealtToChampions / 1000).toFixed(1)}k`}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>GOLD</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
                {`${(p.goldEarned / 1000).toFixed(1)}k`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flex: 1, marginRight: 6 }}>
              <TeamColumn label="BLUE TEAM" color="#60a5fa" rows={blueRows} />
            </div>
            <div style={{ display: "flex", flex: 1, marginLeft: 6 }}>
              <TeamColumn label="RED TEAM" color="#ef4444" rows={redRows} />
            </div>
          </div>
        </div>
      ),
      {
        width: 1100,
        height: 620,
        fonts: thaiFont
          ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
          : undefined,
      }
    ).arrayBuffer()
  );
}
