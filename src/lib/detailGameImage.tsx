import { ImageResponse } from "next/og";
import {
  getChampionIconUrl,
  getItemIconById,
  getSummonerSpellIconById,
  getRuneIconById,
} from "./ddragon";
import { getLatestVersion } from "./champions";
import { fetchThaiFont } from "./imageCommon";
import { MatchParticipant } from "./riot";

export interface DetailGameImageInput {
  gameName: string;
  tagLine: string;
  matchId: string;
  gameMode: string;
  gameDurationMinutes: number;
  player: MatchParticipant & { championDisplayName: string; championIdName: string };
  teamBlue: { name: string; championDisplayName: string; kills: number; deaths: number; assists: number; isMe: boolean }[];
  teamRed: { name: string; championDisplayName: string; kills: number; deaths: number; assists: number; isMe: boolean }[];
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

function TeamColumn({
  label,
  color,
  players,
}: {
  label: string;
  color: string;
  players: { name: string; championDisplayName: string; kills: number; deaths: number; assists: number; isMe: boolean }[];
  iconUrls: (string | null)[];
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
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", width: 4, height: 20, background: color, borderRadius: 2, marginRight: 8 }} />
        <div style={{ display: "flex", color: "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
          {label}
        </div>
      </div>
      {players.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "5px 0",
            background: p.isMe ? "rgba(241,196,15,0.08)" : "transparent",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "flex", color: "#ffffff", fontSize: 13, fontWeight: p.isMe ? 700 : 500, width: 130 }}>
            {p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name}
          </div>
          <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12, width: 90 }}>{p.championDisplayName}</div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: "#ffffff", fontSize: 13, fontWeight: 700 }}>
            {p.kills}/<span style={{ color: "#ef4444" }}>{p.deaths}</span>/{p.assists}
          </div>
        </div>
      ))}
    </div>
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

  const blueIcons = await Promise.all(input.teamBlue.map(b => getChampionIconUrl(b.championDisplayName)));
  const redIcons = await Promise.all(input.teamRed.map(r => getChampionIconUrl(r.championDisplayName)));

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
          {/* Header with splash bg */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 14,
              background: `linear-gradient(90deg, rgba(15,17,23,0.95) 0%, rgba(15,17,23,0.6) 60%, rgba(15,17,23,0.2) 100%), url(${champSplashUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              padding: "16px 20px",
              marginBottom: 14,
              border: `2px solid ${resultColor}`,
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
                {resultLabel} · {resultLabelTh.toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 26, fontWeight: 700 }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: "#cbd0db", fontSize: 18, marginLeft: 4 }}>
                  #{input.tagLine}
                </div>
              </div>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 13, marginTop: 3 }}>
                เล่น {input.player.championDisplayName} · {ROLE_LABEL[p.individualPosition] ?? p.individualPosition} · {input.gameMode} · {Math.floor(input.gameDurationMinutes)} นาที
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>KDA</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                {p.kills} / <span style={{ color: "#ef4444" }}>{p.deaths}</span> / {p.assists}
              </div>
              <div style={{ display: "flex", color: "#cbd0db", fontSize: 12, marginTop: 2 }}>{kda}:1</div>
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
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11 }}>{csPerMin.toFixed(1)}/min</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>VISION</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{p.visionScore}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 16, alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>DMG</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
                {(p.totalDamageDealtToChampions / 1000).toFixed(1)}k
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>GOLD</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
                {(p.goldEarned / 1000).toFixed(1)}k
              </div>
            </div>
          </div>

          {/* Both team scoreboards */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flex: 1, marginRight: 6 }}>
              <TeamColumn label="BLUE TEAM" color="#60a5fa" players={input.teamBlue} iconUrls={blueIcons} />
            </div>
            <div style={{ display: "flex", flex: 1, marginLeft: 6 }}>
              <TeamColumn label="RED TEAM" color="#ef4444" players={input.teamRed} iconUrls={redIcons} />
            </div>
          </div>
        </div>
      ),
      {
        width: 1100,
        height: 640,
        fonts: thaiFont
          ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
          : undefined,
      }
    ).arrayBuffer()
  );
}
