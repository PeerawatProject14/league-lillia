import { ImageResponse } from "next/og";
import { getChampionIconUrl } from "./ddragon";
import { fetchThaiFont } from "./imageCommon";

export interface MvpImageInput {
  championDisplayName: string;
  isPlayerMvp: boolean;
}

export async function generateMvpImage(input: MvpImageInput): Promise<Buffer | null> {
  const iconUrl = await getChampionIconUrl(input.championDisplayName);
  if (!iconUrl) return null;

  const thaiFont = await fetchThaiFont();

  return Buffer.from(
    await new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0f1117 0%, #1a1f2e 100%)",
            padding: "20px 28px",
            alignItems: "center",
            fontFamily: "Noto Sans Thai, sans-serif",
            border: "2px solid #f1c40f",
            borderRadius: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 132,
              height: 132,
              borderRadius: 20,
              overflow: "hidden",
              border: "3px solid #f1c40f",
              marginRight: 28,
              boxShadow: "0 0 24px rgba(241,196,15,0.4)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconUrl} width={132} height={132} alt="" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#0f1117",
                  background: "#f1c40f",
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: 4,
                  padding: "4px 16px",
                  borderRadius: 8,
                }}
              >
                🏆 MVP
              </div>
            </div>
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontSize: 40,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              {input.championDisplayName}
            </div>
            <div
              style={{
                display: "flex",
                color: "#9aa0b4",
                fontSize: 16,
                marginTop: 4,
              }}
            >
              {input.isPlayerMvp ? "ผู้เล่นที่เก่งสุดในแมตช์นี้ — คือคุณ!" : "ผู้เล่นที่เก่งสุดในแมตช์นี้"}
            </div>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 200,
        fonts: thaiFont
          ? [{ name: "Noto Sans Thai", data: thaiFont, weight: 600, style: "normal" }]
          : undefined,
      }
    ).arrayBuffer()
  );
}
