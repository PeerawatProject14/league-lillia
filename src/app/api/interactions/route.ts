import { NextRequest, NextResponse, after } from "next/server";
import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";
import {
  getRiotAccount,
  getSummonerByPuuid,
  getLeagueEntries,
  getTopChampionMasteries,
  getMatchIds,
  getMatchDetail,
  getActiveGame,
  LeagueEntry
} from "@/lib/riot";
import { getChampionName, getChampionInternalId } from "@/lib/champions";
import { getAiCoachingReport, MatchSummary, getAiBuildRecommendation, getAiMatchupBuildRecommendation, getAiLiveGamePrediction, getAiMatchReview, MatchReviewInput } from "@/lib/gemini";
import { generateBuildImage } from "@/lib/imageGenerator";
import { generateProfileImage } from "@/lib/profileImage";
import { generateHistoryImage, HistoryMatchEntry } from "@/lib/historyImage";
import { generateDetailGameImage, DetailPlayerEntry } from "@/lib/detailGameImage";
import { generateLiveGameImage, LivePlayerEntry } from "@/lib/liveGameImage";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const DISCORD_APP_ID = process.env.DISCORD_APP_ID || "";

// Helpers for Discord Embed colors based on rank
const RANK_COLORS: Record<string, number> = {
  CHALLENGER: 0xF13030,
  GRANDMASTER: 0x900C3F,
  MASTER: 0x9E4FFF,
  DIAMOND: 0x3F92FF,
  EMERALD: 0x00BD5E,
  PLATINUM: 0x2AB19F,
  GOLD: 0xDCA400,
  SILVER: 0x87929A,
  BRONZE: 0xA07D5A,
  IRON: 0x6C6C6C,
};

function safeTruncate(text: string, maxLength: number = 4000): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 100) + "\n\n...(ข้อมูลบางส่วนถูกตัดออก เนื่องจากยาวเกินขีดจำกัดของ Discord)...";
}

function getRankColor(tier: string): number {
  return RANK_COLORS[tier.toUpperCase()] || 0xFFFFFF;
}

// Function to update Discord deferred message
async function updateInteractionResponse(token: string, body: any, fileBuffer?: Buffer, fileName?: string) {
  const url = `https://discord.com/api/v10/webhooks/${DISCORD_APP_ID}/${token}/messages/@original`;
  try {
    let res;
    if (fileBuffer && fileName) {
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(body));
      
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/png" });
      formData.append("files[0]", blob, fileName);
      
      res = await fetch(url, {
        method: "PATCH",
        body: formData,
      });
    } else {
      res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Error updating interaction response: ${res.status} - ${text}`);
    }
  } catch (error) {
    console.error("Failed to call Discord API to update interaction:", error);
  }
}

// Helper to parse Name#Tag
function parseRiotId(input: string): { gameName: string; tagLine: string } {
  const parts = input.split("#");
  if (parts.length < 2) {
    // Default tag for TH server if not provided
    return { gameName: parts[0].trim(), tagLine: "TH2" };
  }
  return {
    gameName: parts[0].trim(),
    tagLine: parts[1].trim(),
  };
}

export async function POST(req: NextRequest) {
  // 1. Verify incoming request signature
  const body = await req.text();
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";

  if (!DISCORD_PUBLIC_KEY) {
    console.error("DISCORD_PUBLIC_KEY is not configured in .env");
    return new NextResponse("Internal server config error", { status: 500 });
  }

  const isValidRequest = await verifyKey(body, signature, timestamp, DISCORD_PUBLIC_KEY);
  if (!isValidRequest) {
    return new NextResponse("Invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // 2. Handle PING from Discord (verification during setup)
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // 3. Handle Application Command (Slash Commands) or Message Components (Buttons)
  if (
    interaction.type === InteractionType.APPLICATION_COMMAND ||
    interaction.type === InteractionType.MESSAGE_COMPONENT
  ) {
    let commandName = "";
    let summonerInput = "";
    let vsInput = "";

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      commandName = interaction.data.name;
      if (commandName === "build") {
        const champOption = interaction.data.options?.find((opt: any) => opt.name === "champion");
        summonerInput = champOption?.value || "";
      } else if (commandName === "buildvs") {
        const champOption = interaction.data.options?.find((opt: any) => opt.name === "champion");
        const vsOption = interaction.data.options?.find((opt: any) => opt.name === "vs");
        summonerInput = champOption?.value || "";
        vsInput = vsOption?.value || "";
      } else {
        const summonerOption = interaction.data.options?.find((opt: any) => opt.name === "summoner");
        summonerInput = summonerOption?.value || "";
      }
    } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      // Button custom_id is formatted as: "action:gameName#tagLine"
      const customId = interaction.data.custom_id || "";
      const separatorIdx = customId.indexOf(":");
      if (separatorIdx !== -1) {
        commandName = customId.substring(0, separatorIdx);
        summonerInput = customId.substring(separatorIdx + 1);
      }
    }

    if (!summonerInput) {
      const errMsg =
        commandName === "build" || commandName === "buildvs"
          ? "❌ กรุณากรอกชื่อแชมเปี้ยนที่ต้องการแนะนำ"
          : "❌ กรุณากรอกชื่อ Summoner (ตัวอย่าง: Name#Tag)";
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: errMsg },
      });
    }

    if (commandName === "buildvs" && !vsInput) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ กรุณากรอกชื่อแชมเปี้ยนคู่ต่อสู้ที่ต้องการ counter" },
      });
    }

    // 4. Return deferred channel message (shows "Bot is thinking..." in Discord)
    // This acknowledges the request immediately, avoiding the 3-second timeout limit.
    const deferredResponse = NextResponse.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });

    // Use NextJS after to process async operations after response is sent
    const interactionToken = interaction.token;
    after(
      async () => {
        try {
          if (commandName === "profile") {
            await handleProfileCommand(summonerInput, interactionToken);
          } else if (commandName === "coach") {
            await handleCoachCommand(summonerInput, interactionToken);
          } else if (commandName === "livegame") {
            await handleLiveGameCommand(summonerInput, interactionToken);
          } else if (commandName === "history") {
            await handleHistoryCommand(summonerInput, interactionToken);
          } else if (commandName === "detailgame") {
            const selectedMatchId = interaction.data.values?.[0] || "";
            await handleDetailGameCommand(summonerInput, selectedMatchId, interactionToken);
          } else if (commandName === "build") {
            await handleBuildCommand(summonerInput, interactionToken);
          } else if (commandName === "buildvs") {
            await handleBuildVsCommand(summonerInput, vsInput, interactionToken);
          } else if (commandName === "reviewself" || commandName === "reviewteam") {
            const scope = commandName === "reviewself" ? "self" : "team";
            const sepIdx = summonerInput.indexOf("|");
            const reviewMatchId = sepIdx !== -1 ? summonerInput.substring(0, sepIdx) : "";
            const reviewSummoner = sepIdx !== -1 ? summonerInput.substring(sepIdx + 1) : summonerInput;
            await handleMatchReviewCommand(scope, reviewMatchId, reviewSummoner, interactionToken);
          } else {
            await updateInteractionResponse(interactionToken, {
              content: `❌ ไม่พบคำสั่ง: ${commandName}`,
            });
          }
        } catch (error: any) {
          console.error(`Error processing command ${commandName}:`, error);
          await updateInteractionResponse(interactionToken, {
            content: `❌ เกิดข้อผิดพลาด: ${error.message || error}`,
          });
        }
      }
    );

    return deferredResponse;
  }

  return new NextResponse("Unknown interaction type", { status: 400 });
}

// Handler for `/profile`
async function handleProfileCommand(summonerInput: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);

  const account = await getRiotAccount(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const leagues = await getLeagueEntries(account.puuid);
  const soloDuo = leagues.find((l: LeagueEntry) => l.queueType === "RANKED_SOLO_5x5");
  const flex = leagues.find((l: LeagueEntry) => l.queueType === "RANKED_FLEX_SR");

  const masteries = await getTopChampionMasteries(account.puuid, 3);
  const masteryEntries: { championName: string; championLevel: number; championPoints: number }[] = [];
  for (const m of masteries) {
    const champName = await getChampionName(m.championId);
    masteryEntries.push({
      championName: champName,
      championLevel: m.championLevel,
      championPoints: m.championPoints,
    });
  }

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateProfileImage({
      gameName: account.gameName,
      tagLine: account.tagLine,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      soloDuo,
      flex,
      masteries: masteryEntries,
    });
  } catch (e) {
    console.error("Failed to generate profile image:", e);
  }

  const rankColor = soloDuo ? getRankColor(soloDuo.tier) : 0xFFFFFF;

  const embed: any = {
    title: `🏆 LoL Profile: ${account.gameName}#${account.tagLine}`,
    color: rankColor,
    image: imageBuffer ? { url: "attachment://profile.png" } : undefined,
    footer: { text: "League of Legends Buddy Bot" },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    embed.fields = [
      {
        name: "📊 ข้อมูลทั่วไป",
        value: `• **Level:** ${summoner.summonerLevel}\n• **Server:** Thailand (TH)`,
        inline: false,
      },
      {
        name: "⚔️ Ranked Solo/Duo",
        value: soloDuo
          ? `• **Rank:** ${soloDuo.tier} ${soloDuo.rank}\n• **LP:** ${soloDuo.leaguePoints}\n• **WR:** ${soloDuo.wins}W/${soloDuo.losses}L (${Math.round((soloDuo.wins / (soloDuo.wins + soloDuo.losses)) * 100)}%)`
          : "Unranked",
        inline: true,
      },
      {
        name: "👥 Ranked Flex",
        value: flex
          ? `• **Rank:** ${flex.tier} ${flex.rank}\n• **LP:** ${flex.leaguePoints}\n• **WR:** ${flex.wins}W/${flex.losses}L (${Math.round((flex.wins / (flex.wins + flex.losses)) * 100)}%)`
          : "Unranked",
        inline: true,
      },
      {
        name: "🔥 Top Mastery",
        value: masteryEntries.length > 0
          ? masteryEntries.map(m => `• **${m.championName}** - Lv.${m.championLevel} (${m.championPoints.toLocaleString()} pts)`).join("\n")
          : "ไม่มีข้อมูล",
        inline: false,
      },
    ];
  }

  // Add OP.GG link button + AI Coach and Live Game action buttons
  const components = [
    {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 5, // Link
          label: "ดูใน OP.GG",
          url: `https://www.op.gg/summoners/sg/${encodeURIComponent(account.gameName)}-${encodeURIComponent(account.tagLine)}`,
        },
        {
          type: 2, // Button
          style: 1, // Primary (Blue)
          label: "🤖 วิเคราะห์ฟอร์ม (AI Coach)",
          custom_id: `coach:${account.gameName}#${account.tagLine}`,
        },
        {
          type: 2, // Button
          style: 3, // Success (Green)
          label: "🎮 เช็คเกมสด (Live Game)",
          custom_id: `livegame:${account.gameName}#${account.tagLine}`,
        },
        {
          type: 2, // Button
          style: 2, // Secondary (Grey)
          label: "📜 ประวัติการเล่น",
          custom_id: `history:${account.gameName}#${account.tagLine}`,
        },
      ],
    },
  ];

  await updateInteractionResponse(
    token,
    { embeds: [embed], components },
    imageBuffer,
    "profile.png"
  );
}

// Handler for `/coach`
async function handleCoachCommand(summonerInput: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);

  // B: Fetch Match history IDs (last 5 games)
  const matchIds = await getMatchIds(account.puuid, 5);
  if (matchIds.length === 0) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่พบประวัติการเล่นล่าสุดของ ${account.gameName}#${account.tagLine}`,
    });
    return;
  }

  // C: Fetch Match Details & compile statistics
  const formattedMatches: MatchSummary[] = [];
  for (const matchId of matchIds) {
    try {
      const match = await getMatchDetail(matchId);
      const playerStats = match.info.participants.find(p => p.puuid === account.puuid);
      if (playerStats) {
        const champName = await getChampionName(playerStats.championId);
        
        // Calculate CS/min
        const totalCs = playerStats.totalMinionsKilled + playerStats.neutralMinionsKilled;
        const durationMin = match.info.gameDuration / 60;
        const csPerMin = durationMin > 0 ? totalCs / durationMin : 0;
        
        // Calculate KDA
        const kdaVal = playerStats.deaths === 0
          ? "Perfect"
          : ((playerStats.kills + playerStats.assists) / playerStats.deaths).toFixed(2);

        formattedMatches.push({
          championName: champName,
          role: playerStats.individualPosition || "Unknown",
          win: playerStats.win,
          kills: playerStats.kills,
          deaths: playerStats.deaths,
          assists: playerStats.assists,
          kda: kdaVal,
          cs: totalCs,
          csPerMin: csPerMin,
          visionScore: playerStats.visionScore,
          damageDealt: playerStats.totalDamageDealtToChampions,
          goldEarned: playerStats.goldEarned,
          gameDurationMinutes: durationMin,
        });
      }
    } catch (e) {
      console.warn(`Failed to load details for match ${matchId}:`, e);
    }
  }

  if (formattedMatches.length === 0) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่สามารถดึงรายละเอียดการเล่นล่าสุดเพื่อวิเคราะห์ได้`,
    });
    return;
  }

  // D: Request review from Gemini AI
  const coachingReport = await getAiCoachingReport(
    `${account.gameName}#${account.tagLine}`,
    formattedMatches
  );

  // E: Return AI Report as a beautifully styled Embed
  const embed = {
    title: `🤖 AI Coach Analysis: ${account.gameName}#${account.tagLine}`,
    description: safeTruncate(coachingReport),
    color: 0xFF8800, // AI Theme Color (Orange)
    footer: {
      text: "วิเคราะห์อ้างอิงจากข้อมูลสถิติ 5 เกมล่าสุด • ข้อมูลอัปเดตแบบเรียลไทม์",
    },
    timestamp: new Date().toISOString(),
  };

  await updateInteractionResponse(token, {
    embeds: [embed],
  });
}

// Handler for `/livegame`
async function handleLiveGameCommand(summonerInput: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);

  const account = await getRiotAccount(gameName, tagLine);
  const activeGame = await getActiveGame(account.puuid);
  if (!activeGame) {
    await updateInteractionResponse(token, {
      content: `🎮 ขณะนี้ **${account.gameName}#${account.tagLine}** ไม่อยู่ในระหว่างเล่นเกม หรือจบเกมไปแล้ว`,
    });
    return;
  }

  const durationMin = activeGame.gameLength > 0 ? activeGame.gameLength / 60 : 0;

  const teamBlue: LivePlayerEntry[] = [];
  const teamRed: LivePlayerEntry[] = [];

  for (const part of activeGame.participants) {
    const champName = await getChampionName(part.championId);
    const champIdName = await getChampionInternalId(part.championId);
    const riotName = part.riotId
      ? part.riotId.split("#")[0]
      : part.summonerId || "Unknown";

    const entry: LivePlayerEntry = {
      riotName,
      championDisplayName: champName,
      championIdName: champIdName,
      spell1Id: part.spell1Id ?? 0,
      spell2Id: part.spell2Id ?? 0,
      keystoneId: part.perks?.perkIds?.[0] ?? null,
      subStyleId: part.perks?.perkSubStyle ?? null,
      isMe: part.puuid === account.puuid,
    };
    if (part.teamId === 100) teamBlue.push(entry);
    else teamRed.push(entry);
  }

  const userIsBlue = teamBlue.some(p => p.isMe);
  const userTeamColor: "blue" | "red" = userIsBlue ? "blue" : "red";
  const userChamp = (userIsBlue ? teamBlue : teamRed).find(p => p.isMe)?.championDisplayName ?? "Unknown";

  let prediction = null;
  try {
    prediction = await getAiLiveGamePrediction(
      { champions: teamBlue.map(p => p.championDisplayName) },
      { champions: teamRed.map(p => p.championDisplayName) },
      userTeamColor,
      userChamp
    );
  } catch (e) {
    console.warn("AI live game prediction failed, rendering without it:", e);
  }

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateLiveGameImage({
      gameName: account.gameName,
      tagLine: account.tagLine,
      gameMode: activeGame.gameMode,
      gameMinutes: durationMin,
      teamBlue,
      teamRed,
      prediction,
      userTeamColor,
    });
  } catch (e) {
    console.error("Failed to generate live game image:", e);
  }

  const embed: any = {
    title: `🎮 Live Match: ${account.gameName}#${account.tagLine}`,
    color: 0x00FFCC,
    image: imageBuffer ? { url: "attachment://livegame.png" } : undefined,
    footer: { text: "League of Legends Live Spectator" },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    embed.fields = [
      {
        name: "🔵 Blue Team",
        value: teamBlue.map(p => `• **${p.riotName}** - ${p.championDisplayName}`).join("\n") || "—",
        inline: false,
      },
      {
        name: "🔴 Red Team",
        value: teamRed.map(p => `• **${p.riotName}** - ${p.championDisplayName}`).join("\n") || "—",
        inline: false,
      },
    ];
    if (prediction) {
      embed.fields.push({
        name: `🤖 AI Prediction (${prediction.blueWinChance}% Blue / ${prediction.redWinChance}% Red)`,
        value:
          prediction.keyMatchups.map(k => `• ${k}`).join("\n") +
          `\n\n**TIP:** ${prediction.userAdvice}`,
        inline: false,
      });
    }
  }

  await updateInteractionResponse(
    token,
    { embeds: [embed] },
    imageBuffer,
    "livegame.png"
  );
}

async function handleHistoryCommand(summonerInput: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);

  // B: Fetch Match history IDs (last 10 games)
  const matchIds = await getMatchIds(account.puuid, 10);
  if (matchIds.length === 0) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่พบประวัติการเล่นล่าสุดของ ${account.gameName}#${account.tagLine}`,
    });
    return;
  }

  const ROLE_MAP: Record<string, string> = {
    TOP: "TOP",
    JUNGLE: "JG",
    MIDDLE: "MID",
    BOTTOM: "ADC",
    UTILITY: "SUP",
  };

  const matches: HistoryMatchEntry[] = [];
  const selectOptions: any[] = [];

  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    try {
      const match = await getMatchDetail(matchId);
      const playerStats = match.info.participants.find(p => p.puuid === account.puuid);
      if (!playerStats) continue;

      const champName = await getChampionName(playerStats.championId);
      const totalCs = playerStats.totalMinionsKilled + playerStats.neutralMinionsKilled;
      const durationMin = match.info.gameDuration / 60;
      const csPerMin = durationMin > 0 ? totalCs / durationMin : 0;

      matches.push({
        matchId,
        championName: champName,
        role: playerStats.individualPosition || "UNKNOWN",
        win: playerStats.win,
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        assists: playerStats.assists,
        cs: totalCs,
        csPerMin,
        durationMinutes: durationMin,
      });

      const winLabel = playerStats.win ? "ชนะ" : "แพ้";
      const role = ROLE_MAP[playerStats.individualPosition] || playerStats.individualPosition || "UNKNOWN";
      const labelText = `เกมที่ ${i + 1}: ${winLabel} - ${champName} (${role})`;
      const descText = `KDA: ${playerStats.kills}/${playerStats.deaths}/${playerStats.assists} | เวลา: ${Math.floor(durationMin)} นาที`;

      selectOptions.push({
        label: labelText.substring(0, 100),
        description: descText.substring(0, 100),
        value: matchId,
      });
    } catch (e) {
      console.warn(`Failed to load details for match ${matchId}:`, e);
    }
  }

  if (matches.length === 0) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่สามารถดึงรายละเอียดการเล่นล่าสุดเพื่อสรุปผลได้`,
    });
    return;
  }

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateHistoryImage({
      gameName: account.gameName,
      tagLine: account.tagLine,
      matches,
    });
  } catch (e) {
    console.error("Failed to generate history image:", e);
  }

  const embed: any = {
    title: `📜 Match History: ${account.gameName}#${account.tagLine}`,
    color: 0x5865F2,
    image: imageBuffer ? { url: "attachment://history.png" } : undefined,
    footer: { text: "เลือกในเมนูด้านล่างเพื่อดูรายละเอียดเกม" },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    embed.description = safeTruncate(
      matches
        .map((m, i) => {
          const winStatus = m.win ? "🟢 ชนะ" : "🔴 แพ้";
          const role = ROLE_MAP[m.role] || m.role;
          return `**${i + 1}.** ${winStatus} **${m.championName}** (${role}) — ${m.kills}/${m.deaths}/${m.assists} · ${m.cs} CS · ${Math.floor(m.durationMinutes)} นาที`;
        })
        .join("\n")
    );
  }

  const components = [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `detailgame:${account.gameName}#${account.tagLine}`,
          placeholder: "เลือกรอบการเล่นเพื่อดูรายละเอียด...",
          options: selectOptions,
        },
      ],
    },
  ];

  await updateInteractionResponse(
    token,
    { embeds: [embed], components },
    imageBuffer,
    "history.png"
  );
}

// Handler for showing detailed game info with champion image
async function handleDetailGameCommand(summonerInput: string, matchId: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);

  const account = await getRiotAccount(gameName, tagLine);
  const match = await getMatchDetail(matchId);
  const playerStats = match.info.participants.find(p => p.puuid === account.puuid);
  if (!playerStats) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่พบข้อมูลสถิติของ ${account.gameName}#${account.tagLine} ในเกมนี้`,
    });
    return;
  }

  const champName = await getChampionName(playerStats.championId);
  const internalId = await getChampionInternalId(playerStats.championId);
  const durationMin = match.info.gameDuration / 60;

  const teamBlue: DetailPlayerEntry[] = [];
  const teamRed: DetailPlayerEntry[] = [];

  for (const part of match.info.participants) {
    const partChampName = await getChampionName(part.championId);
    const partChampIdName = await getChampionInternalId(part.championId);
    const displayName = part.riotIdGameName ? part.riotIdGameName : part.summonerId;
    const primaryStyle = part.perks?.styles?.find(s => s.description === "primaryStyle");
    const subStyle = part.perks?.styles?.find(s => s.description === "subStyle");

    const row: DetailPlayerEntry = {
      name: displayName,
      championDisplayName: partChampName,
      championIdName: partChampIdName,
      kills: part.kills,
      deaths: part.deaths,
      assists: part.assists,
      champLevel: part.champLevel ?? 1,
      cs: part.totalMinionsKilled + part.neutralMinionsKilled,
      isMe: part.puuid === account.puuid,
      item0: part.item0,
      item1: part.item1,
      item2: part.item2,
      item3: part.item3,
      item4: part.item4,
      item5: part.item5,
      item6: part.item6,
      summoner1Id: part.summoner1Id,
      summoner2Id: part.summoner2Id,
      keystoneId: primaryStyle?.selections?.[0]?.perk ?? null,
      subStyleId: subStyle?.style ?? null,
    };
    if (part.teamId === 100) teamBlue.push(row);
    else teamRed.push(row);
  }

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateDetailGameImage({
      gameName: account.gameName,
      tagLine: account.tagLine,
      matchId,
      gameMode: match.info.gameMode,
      gameDurationMinutes: durationMin,
      player: { ...playerStats, championDisplayName: champName, championIdName: internalId },
      teamBlue,
      teamRed,
    });
  } catch (e) {
    console.error("Failed to generate detail game image:", e);
  }

  const embed: any = {
    title: `🎮 รายละเอียดเกม: ${champName} (${playerStats.win ? "🟢 ชนะ" : "🔴 แพ้"})`,
    color: playerStats.win ? 0x2ECC71 : 0xE74C3C,
    image: imageBuffer ? { url: "attachment://detail.png" } : undefined,
    footer: { text: `Match ID: ${matchId}` },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    const totalCs = playerStats.totalMinionsKilled + playerStats.neutralMinionsKilled;
    const csPerMin = durationMin > 0 ? totalCs / durationMin : 0;
    const kdaVal = playerStats.deaths === 0 ? "Perfect" : ((playerStats.kills + playerStats.assists) / playerStats.deaths).toFixed(2);
    embed.fields = [
      {
        name: "📊 สถิติ",
        value: `**${champName}** · ${playerStats.kills}/${playerStats.deaths}/${playerStats.assists} (${kdaVal}) · ${totalCs} CS (${csPerMin.toFixed(1)}/min) · Vision ${playerStats.visionScore}`,
        inline: false,
      },
    ];
  }

  const reviewIdSuffix = `${matchId}|${account.gameName}#${account.tagLine}`;
  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "🔍 รีวิวเฉพาะเรา",
          custom_id: `reviewself:${reviewIdSuffix}`,
        },
        {
          type: 2,
          style: 2,
          label: "👥 รีวิวทั้งทีม",
          custom_id: `reviewteam:${reviewIdSuffix}`,
        },
      ],
    },
  ];

  await updateInteractionResponse(
    token,
    { embeds: [embed], components },
    imageBuffer,
    "detail.png"
  );
}

async function handleMatchReviewCommand(
  scope: "self" | "team",
  matchId: string,
  summonerInput: string,
  token: string
) {
  const { gameName, tagLine } = parseRiotId(summonerInput);
  const account = await getRiotAccount(gameName, tagLine);
  const match = await getMatchDetail(matchId);
  const playerStats = match.info.participants.find(p => p.puuid === account.puuid);
  if (!playerStats) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่พบข้อมูลผู้เล่นในเกมนี้`,
    });
    return;
  }

  const champName = await getChampionName(playerStats.championId);
  const durationMin = match.info.gameDuration / 60;
  const totalCs = playerStats.totalMinionsKilled + playerStats.neutralMinionsKilled;
  const csPerMin = durationMin > 0 ? totalCs / durationMin : 0;

  const blue: MatchReviewInput["blue"] = [];
  const red: typeof blue = [];
  for (const part of match.info.participants) {
    const pName = await getChampionName(part.championId);
    const row = {
      name: part.riotIdGameName || part.summonerId,
      champion: pName,
      role: part.individualPosition || "?",
      kda: `${part.kills}/${part.deaths}/${part.assists}`,
      cs: part.totalMinionsKilled + part.neutralMinionsKilled,
      win: part.win,
      isMe: part.puuid === account.puuid,
    };
    if (part.teamId === 100) blue.push(row);
    else red.push(row);
  }

  let reviewText = "";
  try {
    reviewText = await getAiMatchReview({
      scope,
      myChampion: champName,
      myRole: playerStats.individualPosition || "?",
      myWin: playerStats.win,
      myStats: {
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        assists: playerStats.assists,
        cs: totalCs,
        csPerMin,
        visionScore: playerStats.visionScore,
        damage: playerStats.totalDamageDealtToChampions,
        gold: playerStats.goldEarned,
      },
      gameMinutes: durationMin,
      gameMode: match.info.gameMode,
      blue,
      red,
    });
  } catch (e: any) {
    console.error("Match review failed:", e);
    await updateInteractionResponse(token, {
      content: `❌ ขอโทษด้วย ตอนนี้ AI ตอบไม่ได้: ${e.message || e}`,
    });
    return;
  }

  const embed: any = {
    title: scope === "self"
      ? `🔍 รีวิวเฉพาะเรา: ${champName} (${playerStats.win ? "🟢 ชนะ" : "🔴 แพ้"})`
      : `👥 รีวิวทั้งทีม: เกม ${champName} (${playerStats.win ? "🟢 ชนะ" : "🔴 แพ้"})`,
    description: safeTruncate(reviewText, 4000),
    color: scope === "self" ? 0xF1C40F : 0x5865F2,
    footer: { text: `Match ID: ${matchId} • วิเคราะห์โดย AI` },
    timestamp: new Date().toISOString(),
  };

  await updateInteractionResponse(token, { embeds: [embed] });
}

// Handler for `/build`
async function handleBuildCommand(championQuery: string, token: string) {
  const buildInfo = await getAiBuildRecommendation(championQuery);

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateBuildImage(buildInfo);
  } catch (e) {
    console.error("Failed to generate build image:", e);
  }

  const embed: any = {
    title: `🛡️ Build แนะนำสำหรับแชมเปี้ยน: ${buildInfo.displayName}`,
    color: 0xF1C40F,
    image: imageBuffer
      ? { url: "attachment://build.png" }
      : { url: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${buildInfo.championIdName}_0.jpg` },
    footer: {
      text: "วิเคราะห์และจัดของโดย Gemini AI • ข้อมูลและรูปภาพอัปเดตแบบเรียลไทม์",
    },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    embed.fields = [
      {
        name: "⚠️ ไม่สามารถสร้างรูปภาพ Build ได้",
        value: "แสดงข้อมูลแบบข้อความแทน:\n\n" +
          `**⚔️ Starter:** ${buildInfo.starterItems.join(", ")}\n` +
          `**📦 Core (1-3):** ${buildInfo.coreItems.join(" → ")}\n` +
          `**🌟 Situational (4-6):** ${buildInfo.situationalItems.join(", ")}\n` +
          `**💡 Optional:** ${(buildInfo.optionalItems ?? []).join(", ")}\n` +
          `**🔮 Runes:** ${buildInfo.runes.keystone} (${buildInfo.runes.primaryTree}/${buildInfo.runes.secondaryTree})\n` +
          `**🎯 Skill Order:** ${(buildInfo.skillPriority ?? []).join(" › ")}\n` +
          `**✨ Summoner Spells:** ${(buildInfo.summonerSpells ?? []).join(", ")}\n` +
          `**🟢 Strong vs:** ${buildInfo.strongAgainst.join(", ")}\n` +
          `**🔴 Weak vs:** ${buildInfo.weakAgainst.join(", ")}`,
        inline: false,
      },
    ];
  }

  await updateInteractionResponse(token, {
    embeds: [embed],
  }, imageBuffer, "build.png");
}

// Handler for `/buildvs`
async function handleBuildVsCommand(myChampion: string, vsChampion: string, token: string) {
  const buildInfo = await getAiMatchupBuildRecommendation(myChampion, vsChampion);

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateBuildImage(buildInfo);
  } catch (e) {
    console.error("Failed to generate matchup build image:", e);
  }

  const embed: any = {
    title: `⚔️ ${buildInfo.displayName} vs ${buildInfo.vsChampionDisplayName ?? vsChampion}`,
    color: 0xEF4444,
    image: imageBuffer
      ? { url: "attachment://buildvs.png" }
      : { url: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${buildInfo.championIdName}_0.jpg` },
    footer: {
      text: "Matchup build วิเคราะห์โดย Gemini AI",
    },
    timestamp: new Date().toISOString(),
  };

  if (!imageBuffer) {
    embed.fields = [
      {
        name: "💡 Tip เลน",
        value: buildInfo.matchupTip ?? "—",
        inline: false,
      },
      {
        name: "📦 Build",
        value:
          `**Core (1-3):** ${buildInfo.coreItems.join(" → ")}\n` +
          `**Situational (4-6):** ${buildInfo.situationalItems.join(", ")}\n` +
          `**Optional:** ${(buildInfo.optionalItems ?? []).join(", ")}\n` +
          `**Runes:** ${buildInfo.runes.keystone}\n` +
          `**Spells:** ${(buildInfo.summonerSpells ?? []).join(", ")}`,
        inline: false,
      },
    ];
  }

  await updateInteractionResponse(token, { embeds: [embed] }, imageBuffer, "buildvs.png");
}

