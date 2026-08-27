import { ImageResponse } from "next/og";
import { getSummonerSpellIconById, getRuneIconById } from "./ddragon";
import { getLatestVersion } from "./champions";
import { loadImageFonts, DISPLAY_FONT, BODY_FONT } from "./imageCommon";
import { GoldRule } from "./imageParts";
import { LiveGamePrediction } from "./gemini";

export interface LivePlayerEntry {
  riotName: string;
  championDisplayName: string;
  championIdName: string;
  spell1Id: number;
  spell2Id: number;
  keystoneId: number | null;
  subStyleId: number | null;
  isMe: boolean;
}

export interface LiveGameImageInput {
  gameName: string;
  tagLine: string;
  gameMode: string;
  gameMinutes: number;
  teamBlue: LivePlayerEntry[];
  teamRed: LivePlayerEntry[];
  prediction: LiveGamePrediction | null;
  userTeamColor: "blue" | "red";
}

interface PlayerRowData {
  player: LivePlayerEntry;
  champIconUrl: string;
  spell1Url: string | null;
  spell2Url: string | null;
  keystoneUrl: string | null;
  subTreeUrl: string | null;
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
  const empty = !url;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: rounded ? size / 2 : 2,
        overflow: "hidden",
        background: empty ? "rgba(4,16,28,0.5)" : "#04101C",
        border: empty
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
        padding: "8px 8px",
        background: p.isMe ? "rgba(200,170,110,0.10)" : "transparent",
        borderRadius: 2,
        marginBottom: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 48,
          height: 48,
          borderRadius: 2,
          overflow: "hidden",
          background: "#04101C",
          border: "1px solid #463714",
          marginRight: 8,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.champIconUrl} width={48} height={48} alt="" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginRight: 8 }}>
        <div style={{ display: "flex", marginBottom: 3 }}>
          <IconBox url={data.spell1Url} size={22} />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.spell2Url} size={22} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginRight: 8 }}>
        <div style={{ display: "flex", marginBottom: 3 }}>
          <IconBox url={data.keystoneUrl} size={22} ring="#4D9BE655" rounded />
        </div>
        <div style={{ display: "flex" }}>
          <IconBox url={data.subTreeUrl} size={22} rounded />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            display: "flex",
            color: "#F0E6D2",
            fontSize: 13,
            fontWeight: p.isMe ? 700 : 600,
            overflow: "hidden",
          }}
        >
          {p.riotName.length > 18 ? p.riotName.slice(0, 17) + "…" : p.riotName}
        </div>
        <div style={{ display: "flex", color: "#A09B8C", fontSize: 12, marginTop: 2 }}>
          {p.championDisplayName}
        </div>
      </div>
    </div>
  );
}

function TeamColumn({
  label,
  color,
  rows,
  winChance,
}: {
  label: string;
  color: string;
  rows: PlayerRowData[];
  winChance: number | null;
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
        padding: "10px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10, paddingLeft: 4 }}>
        <div style={{ display: "flex", color, fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: DISPLAY_FONT }}>
          {label}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        {winChance !== null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: `${color}22`,
              border: `1px solid ${color}66`,
              borderRadius: 2,
              padding: "2px 10px",
              color,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {`${winChance}%`}
          </div>
        ) : null}
      </div>
      {rows.map((r, i) => (
        <PlayerRow key={i} data={r} />
      ))}
    </div>
  );
}

async function buildLiveRows(players: LivePlayerEntry[], version: string): Promise<PlayerRowData[]> {
  return Promise.all(
    players.map(async p => {
      const [spell1Url, spell2Url, keystoneUrl, subTreeUrl] = await Promise.all([
        getSummonerSpellIconById(p.spell1Id),
        getSummonerSpellIconById(p.spell2Id),
        p.keystoneId ? getRuneIconById(p.keystoneId) : Promise.resolve(null),
        p.subStyleId ? getRuneIconById(p.subStyleId) : Promise.resolve(null),
      ]);
      return {
        player: p,
        champIconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championIdName}.png`,
        spell1Url,
        spell2Url,
        keystoneUrl,
        subTreeUrl,
      };
    })
  );
}

export async function generateLiveGameImage(input: LiveGameImageInput): Promise<Buffer> {
  const version = await getLatestVersion();
  const [blueRows, redRows] = await Promise.all([
    buildLiveRows(input.teamBlue, version),
    buildLiveRows(input.teamRed, version),
  ]);
  const fonts = await loadImageFonts();

  const blueWin = input.prediction?.blueWinChance ?? null;
  const redWin = input.prediction?.redWinChance ?? null;

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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: "#0AC8B9", fontSize: 14, fontWeight: 700, letterSpacing: 2, fontFamily: DISPLAY_FONT }}>
                LIVE MATCH
              </div>
              <div style={{ display: "flex", marginTop: 2 }}>
                <div style={{ display: "flex", color: "#F0E6D2", fontSize: 28, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                  {input.gameName}
                </div>
                <div style={{ display: "flex", color: "#A09B8C", fontSize: 20, marginLeft: 4, alignItems: "center" }}>
                  {`#${input.tagLine}`}
                </div>
              </div>
              <div style={{ display: "flex", color: "#A09B8C", fontSize: 13, marginTop: 3 }}>
                {`${input.gameMode} · ${Math.floor(input.gameMinutes)} นาที · กำลังแข่งสด`}
              </div>
            </div>
            <div style={{ display: "flex", flex: 1 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#0A1428",
                border: "1px solid #463714",
                borderRadius: 3,
                padding: "8px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: "#C6443E",
                  marginRight: 8,
                }}
              />
              <div style={{ display: "flex", color: "#C6443E", fontSize: 12, fontWeight: 700, letterSpacing: 1, fontFamily: DISPLAY_FONT }}>
                LIVE
              </div>
            </div>
          </div>

          <div style={{ display: "flex", marginBottom: 14 }}>
            <GoldRule width={1044} />
          </div>

          <div style={{ display: "flex", marginBottom: 14 }}>
            <div style={{ display: "flex", flex: 1, marginRight: 6 }}>
              <TeamColumn label="BLUE TEAM" color="#4D9BE6" rows={blueRows} winChance={blueWin} />
            </div>
            <div style={{ display: "flex", flex: 1, marginLeft: 6 }}>
              <TeamColumn label="RED TEAM" color="#C6443E" rows={redRows} winChance={redWin} />
            </div>
          </div>

          {input.prediction ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#0A1428",
                border: "1px solid #463714",
                borderRadius: 3,
                padding: "12px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    color: "#C8AA6E",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 2, fontFamily: DISPLAY_FONT,
                    marginRight: 12,
                  }}
                >
                  AI PREDICTION
                </div>
                <div style={{ display: "flex", color: "#A09B8C", fontSize: 12 }}>
                  วิเคราะห์โดย Gemini AI
                </div>
              </div>

              <div style={{ display: "flex", marginBottom: 10 }}>
                {input.prediction.keyMatchups.slice(0, 3).map((tip, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flex: 1,
                      flexDirection: "column",
                      background: "#04101C",
                      borderRadius: 2,
                      padding: "8px 10px",
                      marginRight: i < 2 ? 8 : 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        color: "#A09B8C",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1, fontFamily: DISPLAY_FONT,
                        marginBottom: 4,
                      }}
                    >
                      {`KEY ${i + 1}`}
                    </div>
                    <div style={{ display: "flex", color: "#F0E6D2", fontSize: 12 }}>{tip}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  background: "rgba(200,170,110,0.08)",
                  border: "1px solid rgba(200,170,110,0.35)",
                  borderRadius: 2,
                  padding: "8px 12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "#C8AA6E",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1, fontFamily: DISPLAY_FONT,
                    width: 80,
                    marginRight: 12,
                  }}
                >
                  TIP เกมนี้
                </div>
                <div style={{ display: "flex", color: "#F0E6D2", fontSize: 13, flex: 1 }}>
                  {input.prediction.userAdvice}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ),
      {
        width: 1100,
        height: input.prediction ? 723 : 503,
        fonts: fonts.length ? fonts : undefined,
      }
    ).arrayBuffer()
  );
}
