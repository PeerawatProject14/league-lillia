import { ImageResponse } from "next/og";
import { getChampionIconUrl, getItemIconById, getSummonerSpellIconById } from "./ddragon";
import { loadImageFonts, LOL } from "./imageCommon";
import { GoldRule } from "./imageParts";

export interface HistoryMatchEntry {
  matchId: string;
  championName: string;
  champLevel: number;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  durationMinutes: number;
  damage: number;
  gold: number;
  visionScore: number;
  itemIds: number[]; // item0..item6 (last one is the trinket)
  spell1Id: number;
  spell2Id: number;
  queueLabel: string;
  gameCreation: number; // epoch ms
}

export interface HistoryImageInput {
  gameName: string;
  tagLine: string;
  matches: HistoryMatchEntry[];
  page?: number; // zero-based
  pageSize?: number; // games per page, used for the global game numbering
}

const ROLE_LABEL: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SUP",
};

const ROW_HEIGHT = 76; // row content + margin, used to size the canvas
const HEADER_HEIGHT = 150;

// Serif display face for headings; falls back to the Thai face for Thai glyphs
const DISPLAY = "Cinzel, Noto Sans Thai";
const BODY = "Noto Sans Thai, Cinzel";

function formatKDA(k: number, d: number, a: number): string {
  if (d === 0) return "Perfect";
  return (((k + a) / d).toFixed(2)) + ":1";
}

function formatCompact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return `${n}`;
}

function formatAgo(timestamp: number, now: number): string {
  if (!timestamp) return "";
  const diffMin = Math.max(0, Math.round((now - timestamp) / 60000));
  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชม.ที่แล้ว`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} วันที่แล้ว`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth} เดือนที่แล้ว`;
}

/** Small rotated square used as a hextech-style ornament */
function Diamond({ size = 6, color = LOL.gold }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        background: color,
        transform: "rotate(45deg)",
      }}
    />
  );
}

function ItemSlot({ url, size, round = false }: { url: string | null; size: number; round?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 2,
        overflow: "hidden",
        background: LOL.bgSlot,
        border: `1px solid ${url ? LOL.goldDim : LOL.divider}`,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} width={size} height={size} alt="" />
      ) : null}
    </div>
  );
}

function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          width: 38,
          color: LOL.goldDark,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          fontFamily: DISPLAY,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", color, fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function MatchRow({
  m,
  iconUrl,
  itemUrls,
  spellUrls,
  index,
  now,
}: {
  m: HistoryMatchEntry;
  iconUrl: string | null;
  itemUrls: (string | null)[];
  spellUrls: (string | null)[];
  index: number;
  now: number;
}) {
  const kdaRatio = formatKDA(m.kills, m.deaths, m.assists);
  const role = ROLE_LABEL[m.role] ?? m.role.slice(0, 3);
  const accent = m.win ? LOL.win : LOL.loss;
  const rowBg = m.win
    ? "linear-gradient(90deg, rgba(10,200,185,0.10) 0%, rgba(10,200,185,0.03) 45%, rgba(1,10,19,0) 100%)"
    : "linear-gradient(90deg, rgba(198,68,62,0.10) 0%, rgba(198,68,62,0.03) 45%, rgba(1,10,19,0) 100%)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 68,
        padding: "0 12px",
        background: rowBg,
        borderTop: `1px solid ${m.win ? "rgba(10,200,185,0.18)" : "rgba(198,68,62,0.18)"}`,
        borderRight: `1px solid ${LOL.divider}`,
        borderBottom: `1px solid ${m.win ? "rgba(10,200,185,0.18)" : "rgba(198,68,62,0.18)"}`,
        borderLeft: `3px solid ${accent}`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 24,
          color: LOL.textFaint,
          fontSize: 12,
          fontWeight: 700,
          justifyContent: "center",
          marginRight: 8,
          fontFamily: DISPLAY,
        }}
      >
        {`${index + 1}`}
      </div>

      {/* champion portrait with level badge */}
      <div style={{ display: "flex", position: "relative", marginRight: 8 }}>
        <div
          style={{
            display: "flex",
            width: 48,
            height: 48,
            borderRadius: 2,
            overflow: "hidden",
            background: LOL.bgSlot,
            border: `2px solid ${m.win ? LOL.gold : LOL.goldDim}`,
          }}
        >
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} width={48} height={48} alt="" />
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -5,
            left: -5,
            width: 20,
            height: 20,
            borderRadius: 10,
            background: LOL.bgDeep,
            border: `1px solid ${LOL.goldDark}`,
            color: LOL.text,
            fontSize: 10,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {`${m.champLevel}`}
        </div>
      </div>

      {/* summoner spells */}
      <div style={{ display: "flex", flexDirection: "column", marginRight: 12 }}>
        <div style={{ display: "flex", marginBottom: 3 }}>
          <ItemSlot url={spellUrls[0]} size={22} />
        </div>
        <div style={{ display: "flex" }}>
          <ItemSlot url={spellUrls[1]} size={22} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 162 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", color: LOL.text, fontSize: 15, fontWeight: 700, fontFamily: DISPLAY }}>
            {m.championName}
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 7,
              color: LOL.gold,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              background: "rgba(200,170,110,0.08)",
              border: `1px solid ${LOL.goldDim}`,
              padding: "1px 5px",
              fontFamily: DISPLAY,
            }}
          >
            {role}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
          <div
            style={{
              display: "flex",
              color: accent,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              fontFamily: DISPLAY,
            }}
          >
            {m.win ? "VICTORY" : "DEFEAT"}
          </div>
          <div style={{ display: "flex", color: LOL.textFaint, fontSize: 11, margin: "0 6px" }}>|</div>
          <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11 }}>{m.queueLabel}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 116 }}>
        <div style={{ display: "flex", fontSize: 15, fontWeight: 700 }}>
          <div style={{ display: "flex", color: LOL.text }}>{`${m.kills}`}</div>
          <div style={{ display: "flex", color: LOL.textFaint, margin: "0 4px" }}>/</div>
          <div style={{ display: "flex", color: LOL.loss }}>{`${m.deaths}`}</div>
          <div style={{ display: "flex", color: LOL.textFaint, margin: "0 4px" }}>/</div>
          <div style={{ display: "flex", color: LOL.text }}>{`${m.assists}`}</div>
        </div>
        <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginTop: 3 }}>{`${kdaRatio} KDA`}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 96 }}>
        <div style={{ display: "flex", color: LOL.text, fontSize: 13, fontWeight: 600 }}>{`${m.cs} CS`}</div>
        <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginTop: 3 }}>
          {`${m.csPerMin.toFixed(1)} / min`}
        </div>
      </div>

      {/* damage / gold / vision */}
      <div style={{ display: "flex", flexDirection: "column", width: 118 }}>
        <StatLine label="DMG" value={formatCompact(m.damage)} color="#E0836A" />
        <StatLine label="GOLD" value={formatCompact(m.gold)} color={LOL.gold} />
        <StatLine label="VIS" value={`${m.visionScore}`} color={LOL.winDeep} />
      </div>

      {/* item build */}
      <div style={{ display: "flex", alignItems: "center", marginLeft: 6 }}>
        {itemUrls.map((u, i) => (
          <div key={i} style={{ display: "flex", marginRight: i === 5 ? 10 : 3 }}>
            <ItemSlot url={u} size={26} round={i === 6} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 106 }}>
        <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12 }}>
          {`${Math.floor(m.durationMinutes)} นาที`}
        </div>
        <div style={{ display: "flex", color: LOL.textFaint, fontSize: 11, marginTop: 3 }}>
          {formatAgo(m.gameCreation, now)}
        </div>
      </div>
    </div>
  );
}

export async function generateHistoryImage(input: HistoryImageInput): Promise<Buffer> {
  const matches = input.matches;
  const now = Date.now();

  const [iconUrls, itemUrlSets, spellUrlSets, fonts] = await Promise.all([
    Promise.all(matches.map(m => getChampionIconUrl(m.championName))),
    Promise.all(matches.map(m => Promise.all(m.itemIds.map(id => getItemIconById(id))))),
    Promise.all(
      matches.map(m =>
        Promise.all([getSummonerSpellIconById(m.spell1Id), getSummonerSpellIconById(m.spell2Id)])
      )
    ),
    loadImageFonts(),
  ]);

  const wins = matches.filter(m => m.win).length;
  const losses = matches.length - wins;
  const wr = matches.length ? Math.round((wins / matches.length) * 100) : 0;

  const totalDeaths = matches.reduce((sum, m) => sum + m.deaths, 0);
  const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
  const totalAssists = matches.reduce((sum, m) => sum + m.assists, 0);
  const avgKda = totalDeaths === 0 ? "Perfect" : ((totalKills + totalAssists) / totalDeaths).toFixed(2) + ":1";
  const avgCsPerMin = matches.length
    ? (matches.reduce((sum, m) => sum + m.csPerMin, 0) / matches.length).toFixed(1)
    : "0.0";

  const page = input.page ?? 0;
  const pageSize = input.pageSize ?? matches.length;
  const offset = page * pageSize;
  const subtitle =
    page > 0
      ? `เกมที่ ${offset + 1}-${offset + matches.length} · หน้า ${page + 1}`
      : `${matches.length} เกมล่าสุด`;

  const height = HEADER_HEIGHT + matches.length * ROW_HEIGHT + 26;

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            position: "relative",
            background: `linear-gradient(160deg, ${LOL.bgDeep} 0%, ${LOL.bgPanel} 55%, ${LOL.bgDeep} 100%)`,
            border: `1px solid ${LOL.goldDim}`,
            padding: "26px 42px",
            fontFamily: BODY,
          }}
        >
          {/* hextech corner accents */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 8,
              left: 8,
              width: 26,
              height: 26,
              borderTop: `2px solid ${LOL.goldDark}`,
              borderLeft: `2px solid ${LOL.goldDark}`,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 8,
              right: 8,
              width: 26,
              height: 26,
              borderTop: `2px solid ${LOL.goldDark}`,
              borderRight: `2px solid ${LOL.goldDark}`,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 8,
              left: 8,
              width: 26,
              height: 26,
              borderBottom: `2px solid ${LOL.goldDark}`,
              borderLeft: `2px solid ${LOL.goldDark}`,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 26,
              height: 26,
              borderBottom: `2px solid ${LOL.goldDark}`,
              borderRight: `2px solid ${LOL.goldDark}`,
            }}
          />

          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Diamond size={6} />
                <div
                  style={{
                    display: "flex",
                    color: LOL.gold,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 4,
                    marginLeft: 8,
                    fontFamily: DISPLAY,
                  }}
                >
                  MATCH HISTORY
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
                <div style={{ display: "flex", color: LOL.text, fontSize: 26, fontWeight: 700, fontFamily: DISPLAY }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: LOL.goldDark, fontSize: 17, marginLeft: 6, fontFamily: DISPLAY }}>
                  #{input.tagLine}
                </div>
              </div>
              <div style={{ display: "flex", color: LOL.textMuted, fontSize: 12, marginTop: 6 }}>
                {`${subtitle} · เลือกในเมนูด้านล่างเพื่อดูรายละเอียดเกม`}
              </div>
            </div>

            <div style={{ display: "flex", flex: 1 }} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginRight: 16,
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginRight: 8 }}>KDA เฉลี่ย</div>
                <div style={{ display: "flex", color: LOL.text, fontSize: 15, fontWeight: 700 }}>{avgKda}</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 5 }}>
                <div style={{ display: "flex", color: LOL.textMuted, fontSize: 11, marginRight: 8 }}>CS/min เฉลี่ย</div>
                <div style={{ display: "flex", color: LOL.text, fontSize: 15, fontWeight: 700 }}>{avgCsPerMin}</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(1,10,19,0.75)",
                border: `1px solid ${LOL.goldDark}`,
                padding: "9px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: LOL.gold,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  fontFamily: DISPLAY,
                }}
              >
                {`LAST ${matches.length}`}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
                <div style={{ display: "flex", color: LOL.win, fontSize: 21, fontWeight: 700, fontFamily: DISPLAY }}>
                  {`${wins}W`}
                </div>
                <div style={{ display: "flex", color: LOL.goldDim, fontSize: 16, margin: "0 7px" }}>/</div>
                <div style={{ display: "flex", color: LOL.loss, fontSize: 21, fontWeight: 700, fontFamily: DISPLAY }}>
                  {`${losses}L`}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  color: wr >= 50 ? LOL.win : LOL.loss,
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 3,
                  fontFamily: DISPLAY,
                }}
              >
                {`${wr}% WR`}
              </div>
            </div>
          </div>

          {/* gold rule separating the header from the match rows */}
          <div style={{ display: "flex", margin: "16px 0 13px 0" }}>
            <GoldRule width={1240 - 84} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {matches.map((m, i) => (
              <MatchRow
                key={m.matchId}
                m={m}
                iconUrl={iconUrls[i]}
                itemUrls={itemUrlSets[i]}
                spellUrls={spellUrlSets[i]}
                index={offset + i}
                now={now}
              />
            ))}
          </div>
        </div>
      ),
      {
        width: 1240,
        height,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
