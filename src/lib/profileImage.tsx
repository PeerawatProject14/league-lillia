import { ImageResponse } from "next/og";
import { getChampionIconUrl } from "./ddragon";
import { getLatestVersion } from "./champions";
import { fetchThaiFont, getRankedEmblemUrl, getRankedBannerUrl } from "./imageCommon";
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

function winRate(w: number, l: number): number {
  const total = w + l;
  if (total === 0) return 0;
  return Math.round((w / total) * 100);
}

function RankCard({
  title,
  subtitle,
  entry,
  color,
}: {
  title: string;
  subtitle: string;
  entry: LeagueEntry | undefined;
  color: string;
}) {
  const wr = entry ? winRate(entry.wins, entry.losses) : 0;
  const emblemUrl = getRankedEmblemUrl(entry?.tier);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "#161823",
        border: "1px solid #2b2d35",
        borderRadius: 14,
        padding: "16px 20px",
        marginRight: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            width: 4,
            height: 28,
            background: color,
            borderRadius: 2,
            marginRight: 10,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            {title}
          </div>
          <div style={{ display: "flex", color: "#9aa0b4", fontSize: 12 }}>{subtitle}</div>
        </div>
      </div>

      {entry ? (
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 110,
              height: 110,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            {emblemUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emblemUrl} width={110} height={110} alt="" />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
              {entry.tier} {entry.rank}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 28, fontWeight: 700 }}>
                {entry.leaguePoints}
              </div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 16, marginLeft: 6 }}>LP</div>
            </div>
            <div style={{ display: "flex", color: "#9aa0b4", fontSize: 14, marginTop: 6 }}>
              {entry.wins}W / {entry.losses}L
              <span style={{ color: wr >= 50 ? "#22c55e" : "#ef4444", marginLeft: 8, fontWeight: 700 }}>
                {wr}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", height: 110 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 110,
              height: 110,
              background: "#1f2230",
              borderRadius: 12,
              marginRight: 14,
            }}
          >
            <div style={{ display: "flex", color: "#9aa0b4", fontSize: 14, fontWeight: 700 }}>UNRANKED</div>
          </div>
          <div style={{ display: "flex", color: "#6b7280", fontSize: 16 }}>ยังไม่จัดอันดับ</div>
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
  iconUrl,
}: {
  rank: number;
  name: string;
  level: number;
  points: number;
  iconUrl: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        background: "#161823",
        border: "1px solid #2b2d35",
        borderRadius: 12,
        padding: "12px 16px",
        marginRight: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 28,
          height: 28,
          borderRadius: 14,
          background: rank === 1 ? "#f1c40f" : rank === 2 ? "#9aa0b4" : "#a07d5a",
          color: "#0f1117",
          fontSize: 14,
          fontWeight: 700,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          display: "flex",
          width: 56,
          height: 56,
          borderRadius: 10,
          overflow: "hidden",
          background: "#1f2230",
          border: "1px solid #2b2d35",
          marginRight: 12,
        }}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} width={56} height={56} alt="" />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 18, fontWeight: 700 }}>{name}</div>
        <div style={{ display: "flex", color: "#9aa0b4", fontSize: 13, marginTop: 2 }}>
          Lv. {level} · {points.toLocaleString()} pts
        </div>
      </div>
    </div>
  );
}

export async function generateProfileImage(input: ProfileImageInput): Promise<Buffer> {
  const version = await getLatestVersion();
  const profileIconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${input.profileIconId}.png`;
  const bannerUrl = getRankedBannerUrl(input.soloDuo?.tier);

  const masteryIcons = await Promise.all(input.masteries.map(m => getChampionIconUrl(m.championName)));
  const thaiFont = await fetchThaiFont();

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f1117 0%, #161823 100%)",
          padding: "24px 32px",
          fontFamily: "Noto Sans Thai, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              position: "relative",
              width: 130,
              height: 150,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            {bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                width={130}
                height={150}
                alt=""
                style={{ position: "absolute", top: 0, left: 0 }}
              />
            )}
            <div
              style={{
                display: "flex",
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                marginTop: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profileIconUrl} width={72} height={72} alt="" />
            </div>
            <div
              style={{
                display: "flex",
                position: "absolute",
                bottom: 14,
                background: "#0f1117",
                border: "1px solid #2b2d35",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {input.summonerLevel}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#f1c40f", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
              SUMMONER PROFILE
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 32, fontWeight: 700 }}>
                {input.gameName}
              </div>
              <div style={{ display: "flex", color: "#9aa0b4", fontSize: 22, marginLeft: 4 }}>
                #{input.tagLine}
              </div>
            </div>
            <div style={{ display: "flex", color: "#9aa0b4", fontSize: 14, marginTop: 4 }}>
              Thailand (TH){input.soloDuo ? ` · ${input.soloDuo.tier} ${input.soloDuo.rank}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: "#6b7280", fontSize: 13 }}>League of Legends Buddy</div>
        </div>

        <div style={{ display: "flex", marginBottom: 22 }}>
          <RankCard title="RANKED SOLO/DUO" subtitle="แรงค์เดี่ยว" entry={input.soloDuo} color="#60a5fa" />
          <RankCard title="RANKED FLEX" subtitle="แรงค์ทีม" entry={input.flex} color="#a78bfa" />
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", width: 4, height: 22, background: "#f1c40f", borderRadius: 2, marginRight: 10 }} />
          <div style={{ display: "flex", color: "#ffffff", fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            TOP MASTERY
          </div>
          <div style={{ display: "flex", color: "#9aa0b4", fontSize: 13, marginLeft: 10 }}>
            แชมเปี้ยนช่ำชองสูงสุด
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {input.masteries.length > 0 ? (
            input.masteries.slice(0, 3).map((m, i) => (
              <MasteryCard
                key={i}
                rank={i + 1}
                name={m.championName}
                level={m.championLevel}
                points={m.championPoints}
                iconUrl={masteryIcons[i]}
              />
            ))
          ) : (
            <div style={{ display: "flex", color: "#6b7280", fontSize: 16 }}>ไม่มีข้อมูล</div>
          )}
        </div>
      </div>
    ),
    {
      width: 1100,
      height: 580,
      fonts: thaiFont
        ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
        : undefined,
    }
  );

  return Buffer.from(await response.arrayBuffer());
}
