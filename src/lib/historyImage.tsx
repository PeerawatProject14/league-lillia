import { ImageResponse } from "next/og";
import { getChampionIconUrl } from "./ddragon";
import { fetchThaiFont } from "./imageCommon";

export interface HistoryMatchEntry {
  matchId: string;
  championName: string;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  durationMinutes: number;
}

export interface HistoryImageInput {
  gameName: string;
  tagLine: string;
  matches: HistoryMatchEntry[];
}

const ROLE_LABEL: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SUP",
};

function formatKDA(k: number, d: number, a: number): string {
  if (d === 0) return "Perfect";
  return (((k + a) / d).toFixed(2)) + ":1";
}

function MatchRow({ m, iconUrl }: { m: HistoryMatchEntry; iconUrl: string | null }) {
  const kdaRatio = formatKDA(m.kills, m.deaths, m.assists);
  const role = ROLE_LABEL[m.role] ?? m.role.slice(0, 3);
  const winColor = m.win ? "#22c55e" : "#ef4444";
  const winBg = m.win ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        background: winBg,
        border: `1px solid ${m.win ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", width: 6, height: 48, background: winColor, borderRadius: 3, marginRight: 12 }} />

      <div
        style={{
          display: "flex",
          width: 52,
          height: 52,
          borderRadius: 8,
          overflow: "hidden",
          background: "#1f2230",
          border: "1px solid #2b2d35",
          marginRight: 12,
        }}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} width={52} height={52} alt="" />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 160 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{m.championName}</div>
          <div
            style={{
              display: "flex",
              marginLeft: 8,
              color: "#9aa0b4",
              fontSize: 11,
              fontWeight: 700,
              background: "#1f2230",
              border: "1px solid #2b2d35",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {role}
          </div>
        </div>
        <div style={{ display: "flex", color: winColor, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
          {m.win ? "VICTORY" : "DEFEAT"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 140 }}>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
          {m.kills} / <span style={{ color: "#ef4444" }}>{m.deaths}</span> / {m.assists}
        </div>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12, marginTop: 2 }}>{kdaRatio} KDA</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 130 }}>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 15 }}>{m.cs} CS</div>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12, marginTop: 2 }}>{m.csPerMin.toFixed(1)} / min</div>
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", color: "#9aa0b4", fontSize: 13 }}>{Math.floor(m.durationMinutes)} นาที</div>
    </div>
  );
}

export async function generateHistoryImage(input: HistoryImageInput): Promise<Buffer> {
  const matches = input.matches.slice(0, 10);
  const iconUrls = await Promise.all(matches.map(m => getChampionIconUrl(m.championName)));
  const thaiFont = await fetchThaiFont();

  const wins = matches.filter(m => m.win).length;
  const losses = matches.length - wins;
  const wr = matches.length ? Math.round((wins / matches.length) * 100) : 0;

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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: "#5865f2", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
                MATCH HISTORY
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#ffffff", fontSize: 26, fontWeight: 700 }}>{input.gameName}</div>
                <div style={{ display: "flex", color: "#9aa0b4", fontSize: 18, marginLeft: 4 }}>#{input.tagLine}</div>
              </div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 13, marginTop: 4 }}>
                {matches.length} เกมล่าสุด · เลือกในเมนูด้านล่างเพื่อดูรายละเอียดเกม
              </div>
            </div>
            <div style={{ display: "flex", flex: 1 }} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                background: "#161823",
                border: "1px solid #2b2d35",
                borderRadius: 12,
                padding: "10px 16px",
              }}
            >
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                LAST {matches.length}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#22c55e", fontSize: 22, fontWeight: 700 }}>{wins}W</div>
                <div style={{ display: "flex", color: "#6b7280", fontSize: 18, margin: "0 6px" }}>/</div>
                <div style={{ display: "flex", color: "#ef4444", fontSize: 22, fontWeight: 700 }}>{losses}L</div>
              </div>
              <div style={{ display: "flex", color: wr >= 50 ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                {wr}% WR
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {matches.map((m, i) => (
              <MatchRow key={m.matchId} m={m} iconUrl={iconUrls[i]} />
            ))}
          </div>
        </div>
      ),
      {
        width: 1100,
        height: 1000,
        fonts: thaiFont
          ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
          : undefined,
      }
    ).arrayBuffer()
  );
}
