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

function ItemSlot({ url, isTrinket }: { url: string | null; isTrinket?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        width: 52,
        height: 52,
        borderRadius: 8,
        overflow: "hidden",
        background: "#1f2230",
        border: `1px solid ${isTrinket ? "#a78bfa55" : "#2b2d35"}`,
        marginRight: 6,
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={52} height={52} alt="" />
      )}
    </div>
  );
}

function SpellSlot({ url }: { url: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        width: 38,
        height: 38,
        borderRadius: 6,
        overflow: "hidden",
        background: "#1f2230",
        border: "1px solid #2b2d35",
        marginBottom: 4,
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={38} height={38} alt="" />
      )}
    </div>
  );
}

function RuneSlot({ url, size = 38, ringColor }: { url: string | null; size?: number; ringColor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        background: "#1f2230",
        border: ringColor ? `2px solid ${ringColor}` : "1px solid #2b2d35",
        marginRight: 6,
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={size} height={size} alt="" />
      )}
    </div>
  );
}

interface PlayerRowData {
  player: DetailPlayerEntry;
  champIconUrl: string;
  spell1Url: string | null;
  spell2Url: string | null;
  keystoneUrl: string | null;
  subTreeUrl: string | null;
  itemUrls: (string | null)[];
}

function MiniIcon({ url, size, ring }: { url: string | null; size: number; ring?: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: 4,
        overflow: "hidden",
        background: "#1f2230",
        border: ring ? `1px solid ${ring}` : "1px solid #2b2d35",
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={size} height={size} alt="" />
      )}
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
      {/* Champion icon w/ level overlay */}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 38,
          height: 38,
          marginRight: 4,
        }}
      >
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
            bottom: -3,
            right: -3,
            background: "#0f1117",
            border: "1px solid #2b2d35",
            color: "#ffffff",
            fontSize: 9,
            fontWeight: 700,
            padding: "0 3px",
            borderRadius: 4,
            minWidth: 14,
            justifyContent: "center",
          }}
        >
          {p.champLevel}
        </div>
      </div>

      {/* Spells stacked */}
      <div style={{ display: "flex", flexDirection: "column", marginRight: 3 }}>
        <div style={{ marginBottom: 2 }}>
          <MiniIcon url={data.spell1Url} size={18} />
        </div>
        <MiniIcon url={data.spell2Url} size={18} />
      </div>

      {/* Runes stacked */}
      <div style={{ display: "flex", flexDirection: "column", marginRight: 6 }}>
        <div style={{ marginBottom: 2 }}>
          <MiniIcon url={data.keystoneUrl} size={18} ring="#a78bfa55" />
        </div>
        <MiniIcon url={data.subTreeUrl} size={18} />
      </div>

      {/* Name + KDA */}
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
        <div style={{ display: "flex", color: "#ffffff", fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          <div style={{ display: "flex" }}>{p.kills}</div>
          <div style={{ display: "flex", color: "#9aa0b4", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex", color: "#ef4444" }}>{p.deaths}</div>
          <div style={{ display: "flex", color: "#9aa0b4", margin: "0 2px" }}>/</div>
          <div style={{ display: "flex" }}>{p.assists}</div>
        </div>
      </div>

      {/* CS */}
      <div style={{ display: "flex", flexDirection: "column", width: 38, marginRight: 4, alignItems: "flex-end" }}>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>CS</div>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{p.cs}</div>
      </div>

      {/* Items */}
      <div style={{ display: "flex" }}>
        {data.itemUrls.map((u, i) => (
          <div key={i} style={{ marginRight: i === 5 ? 4 : 2 }}>
            <MiniIcon url={u} size={22} ring={i === 6 ? "#a78bfa55" : undefined} />
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
  const champSplashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${input.player.championIdName}_0.jpg`;
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

  // Runes: keystone + primary tree icon + secondary tree icon
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
            background: "linear-gradient(135deg, #0f1117 0%, #161823 100%)",
            padding: "20px 28px",
            fontFamily: "Noto Sans Thai, sans-serif",
          }}
        >
          {/* Header banner */}
          <div
            style={{
              display: "flex",
              position: "relative",
              alignItems: "center",
              borderRadius: 14,
              overflow: "hidden",
              padding: "16px 20px",
              marginBottom: 14,
              border: `2px solid ${resultColor}`,
              background: "#0f1117",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={champSplashUrl}
              alt=""
              width={1100}
              height={140}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.5,
              }}
            />
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, rgba(15,17,23,0.95) 0%, rgba(15,17,23,0.7) 60%, rgba(15,17,23,0.3) 100%)",
              }}
            />

            <div
              style={{
                display: "flex",
                width: 84,
                height: 84,
                borderRadius: 12,
                overflow: "hidden",
                border: `2px solid ${resultColor}`,
                marginRight: 18,
                zIndex: 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={champIconUrl} width={84} height={84} alt="" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
              <div style={{ display: "flex", color: resultColor, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
                {`${resultLabel} · ${resultLabelTh.toUpperCase()}`}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 26, fontWeight: 700 }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: "#cbd0db", fontSize: 18, marginLeft: 4 }}>
                  {`#${input.tagLine}`}
                </div>
              </div>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 13, marginTop: 3 }}>
                {`เล่น ${input.player.championDisplayName} · ${ROLE_LABEL[p.individualPosition] ?? p.individualPosition} · ${input.gameMode} · ${Math.floor(input.gameDurationMinutes)} นาที`}
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>KDA</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 22, fontWeight: 700, marginTop: 2, alignItems: "baseline" }}>
                <div style={{ display: "flex" }}>{p.kills}</div>
                <div style={{ display: "flex", color: "#9aa0b4", margin: "0 4px" }}>/</div>
                <div style={{ display: "flex", color: "#ef4444" }}>{p.deaths}</div>
                <div style={{ display: "flex", color: "#9aa0b4", margin: "0 4px" }}>/</div>
                <div style={{ display: "flex" }}>{p.assists}</div>
              </div>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 12, marginTop: 2 }}>{`${kda}:1`}</div>
            </div>
          </div>

          {/* Loadout row: spells + runes + items + stats */}
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
            {/* Summoner spells */}
            <div style={{ display: "flex", flexDirection: "column", marginRight: 12 }}>
              <SpellSlot url={spell1} />
              <SpellSlot url={spell2} />
            </div>

            {/* Runes */}
            <div style={{ display: "flex", alignItems: "center", marginRight: 14 }}>
              <RuneSlot url={keystoneUrl} size={48} ringColor="#a78bfa" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <RuneSlot url={primaryTreeUrl} size={24} />
                <RuneSlot url={subTreeUrl} size={24} />
              </div>
            </div>

            <div style={{ display: "flex", width: 1, height: 56, background: "#2b2d35", marginRight: 14 }} />

            {/* Items 0-5 + trinket */}
            <div style={{ display: "flex" }}>
              <ItemSlot url={item0} />
              <ItemSlot url={item1} />
              <ItemSlot url={item2} />
              <ItemSlot url={item3} />
              <ItemSlot url={item4} />
              <ItemSlot url={item5} />
              <ItemSlot url={item6} isTrinket />
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CS</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{totalCs}</div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11 }}>{`${csPerMin.toFixed(1)}/min`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>VISION</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{p.visionScore}</div>
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

          {/* Both team scoreboards */}
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
        height: 680,
        fonts: thaiFont
          ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
          : undefined,
      }
    ).arrayBuffer()
  );
}
