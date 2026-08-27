import { ImageResponse } from "next/og";
import { getLatestVersion } from "./champions";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT } from "./imageCommon";
import { GoldRule } from "./imageParts";
import { TierEntry, TierLetter, RoleKey } from "./tierList";

const ROLE_LABEL: Record<RoleKey, string> = {
  top: "TOP LANE",
  jungle: "JUNGLE",
  mid: "MID LANE",
  adc: "BOT / ADC",
  support: "SUPPORT",
};

// Dark plates with a coloured edge, the way the League client badges rank
const TIER_COLOR: Record<TierLetter, { bg: string; fg: string }> = {
  "S+": { bg: "rgba(200,170,110,0.18)", fg: "#F0D8A8" },
  S: { bg: "rgba(200,170,110,0.12)", fg: "#C8AA6E" },
  A: { bg: "rgba(10,200,185,0.12)", fg: "#0AC8B9" },
  B: { bg: "rgba(3,151,171,0.12)", fg: "#4D9BE6" },
  C: { bg: "rgba(160,155,140,0.10)", fg: "#A09B8C" },
  D: { bg: "rgba(198,68,62,0.12)", fg: "#C6443E" },
};

const TIER_LABEL_TH: Record<TierLetter, string> = {
  "S+": "โครตเทพ",
  S: "เทพ",
  A: "เก่ง",
  B: "พอเล่นได้",
  C: "ใช้วิจารณญาณ",
  D: "อย่าหาทำ",
};

const TIERS: TierLetter[] = ["S+", "S", "A", "B", "C", "D"];

function ChampIcon({ entry, version }: { entry: TierEntry; version: string }) {
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${entry.championIdName}.png`;
  const winColor = entry.winRate >= 52 ? "#0AC8B9" : entry.winRate >= 49 ? "#C8AA6E" : "#C6443E";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 56,
          height: 56,
          borderRadius: 2,
          overflow: "hidden",
          background: "#04101C",
          border: "1px solid #463714",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} width={56} height={56} alt="" />
      </div>
      <div
        style={{
          display: "flex",
          color: winColor,
          fontSize: 11,
          fontWeight: 700,
          marginTop: 3,
        }}
      >
        {`${entry.winRate.toFixed(1)}%`}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  entries,
  version,
}: {
  tier: TierLetter;
  entries: TierEntry[];
  version: string;
}) {
  const colors = TIER_COLOR[tier];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "10px 12px",
        background: "#0A1428",
        border: "1px solid #463714",
        borderRadius: 2,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 130,
          minHeight: 60,
          borderRadius: 2,
          background: colors.bg,
          border: `1px solid ${colors.fg}`,
          color: colors.fg,
          fontSize: 18,
          fontWeight: 700,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
          flexShrink: 0,
          textAlign: "center",
          padding: "4px 8px",
        }}
      >
        {TIER_LABEL_TH[tier]}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", flex: 1 }}>
        {entries.length > 0 ? (
          entries.map(e => <ChampIcon key={e.championId} entry={e} version={version} />)
        ) : (
          <div style={{ display: "flex", color: "#5B5A56", fontSize: 13, paddingTop: 20 }}>
            ไม่มีแชมเปี้ยนในระดับนี้
          </div>
        )}
      </div>
    </div>
  );
}

export async function generateTierListImage(
  role: RoleKey,
  entries: TierEntry[]
): Promise<Buffer> {
  const version = await getLatestVersion();
  const fonts = await loadImageFonts();

  const byTier: Record<TierLetter, TierEntry[]> = {
    "S+": [],
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  };
  for (const e of entries) byTier[e.tier].push(e);

  // Estimate height based on champion count.
  // Icon (56) + 3 margin + 11 WR text + 8 margin-bottom = 78 per row of icons.
  // Tier row padding+border+margin add ~28.
  // Width budget for icons ≈ 1200 - 28*2 (padding) - 130 (badge) - 14 (margin) = 1000
  // Each icon takes 56 + 8 marginRight = 64 → 1000/64 ≈ 15. Use 14 to stay safe.
  const ICON_HEIGHT = 78;
  const ROW_OVERHEAD = 28;
  const ICONS_PER_ROW = 14;

  let neededHeight = 163; // header + rule + padding top
  for (const t of TIERS) {
    const count = byTier[t].length || 1;
    const rows = Math.max(1, Math.ceil(count / ICONS_PER_ROW));
    neededHeight += rows * ICON_HEIGHT + ROW_OVERHEAD;
  }
  neededHeight += 30; // bottom padding

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #010A13 0%, #0A1428 100%)",
            padding: "20px 28px",
            fontFamily: BODY_FONT,
            border: "1px solid #463714",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  color: "#C8AA6E",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 2, fontFamily: DISPLAY_FONT,
                }}
              >
                TIER LIST
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#F0E6D2",
                  fontSize: 30,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {ROLE_LABEL[role]}
              </div>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 13, marginTop: 4 }}>
                {`Master+ · stats จาก u.gg · % คือ Win Rate`}
              </div>
              <div style={{ display: "flex", color: "#5B5A56", fontSize: 11, marginTop: 2 }}>
                {`tier คำนวนจาก Win Rate + Pick Rate + Ban Rate รวมกัน (ไม่ใช่ WR อย่างเดียว)`}
              </div>
            </div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", color: "#5B5A56", fontSize: 13 }}>
              อัพเดตทุก patch
            </div>
          </div>

          <div style={{ display: "flex", marginBottom: 14 }}>
            <GoldRule width={1144} />
          </div>

          {TIERS.map(t => (
            <TierRow key={t} tier={t} entries={byTier[t]} version={version} />
          ))}
        </div>
      ),
      {
        width: 1200,
        height: Math.max(neededHeight, 600),
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
