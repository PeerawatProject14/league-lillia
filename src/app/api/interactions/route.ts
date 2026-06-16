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
import { getChampionName, getLatestVersion, getChampionInternalId } from "@/lib/champions";
import { getAiCoachingReport, MatchSummary, getAiBuildRecommendation } from "@/lib/gemini";
import { generateBuildImage } from "@/lib/imageGenerator";

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

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      commandName = interaction.data.name;
      if (commandName === "build") {
        const champOption = interaction.data.options?.find((opt: any) => opt.name === "champion");
        summonerInput = champOption?.value || "";
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
      const errMsg = commandName === "build"
        ? "❌ กรุณากรอกชื่อแชมเปี้ยนที่ต้องการแนะนำ"
        : "❌ กรุณากรอกชื่อ Summoner (ตัวอย่าง: Name#Tag)";
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: errMsg },
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
  const latestVersion = await getLatestVersion();
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);
  
  // B: Fetch Summoner details
  const summoner = await getSummonerByPuuid(account.puuid);
  
  // C: Fetch League entries (ranks)
  const leagues = await getLeagueEntries(account.puuid);
  const soloDuo = leagues.find((l: LeagueEntry) => l.queueType === "RANKED_SOLO_5x5");
  const flex = leagues.find((l: LeagueEntry) => l.queueType === "RANKED_FLEX_SR");

  // D: Fetch Top Masteries
  const masteries = await getTopChampionMasteries(account.puuid, 3);
  const masteryFields = [];
  for (let i = 0; i < masteries.length; i++) {
    const m = masteries[i];
    const champName = await getChampionName(m.championId);
    masteryFields.push(`• **${champName}** - Level ${m.championLevel} (${m.championPoints.toLocaleString()} pts)`);
  }

  const rankColor = soloDuo ? getRankColor(soloDuo.tier) : 0xFFFFFF;

  const embed = {
    title: `🏆 LoL Profile: ${account.gameName}#${account.tagLine}`,
    color: rankColor,
    thumbnail: {
      url: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/profileicon/${summoner.profileIconId}.png`,
    },
    fields: [
      {
        name: "📊 ข้อมูลทั่วไป",
        value: `• **Level:** ${summoner.summonerLevel}\n• **Server:** Thailand (TH)`,
        inline: false,
      },
      {
        name: "⚔️ Ranked Solo/Duo",
        value: soloDuo
          ? `• **Rank:** ${soloDuo.tier} ${soloDuo.rank}\n• **LP:** ${soloDuo.leaguePoints}\n• **Win Rate:** ${soloDuo.wins}W / ${soloDuo.losses}L (${Math.round((soloDuo.wins / (soloDuo.wins + soloDuo.losses)) * 100)}%)`
          : "• **Rank:** Unranked",
        inline: true,
      },
      {
        name: "👥 Ranked Flex",
        value: flex
          ? `• **Rank:** ${flex.tier} ${flex.rank}\n• **LP:** ${flex.leaguePoints}\n• **Win Rate:** ${flex.wins}W / ${flex.losses}L (${Math.round((flex.wins / (flex.wins + flex.losses)) * 100)}%)`
          : "• **Rank:** Unranked",
        inline: true,
      },
      {
        name: "🔥 แชมเปี้ยนช่ำชองสูงสุด (Top Mastery)",
        value: masteryFields.length > 0 ? masteryFields.join("\n") : "ไม่มีข้อมูล",
        inline: false,
      },
    ],
    footer: {
      text: "League of Legends Buddy Bot • Powered by Gemini AI",
    },
    timestamp: new Date().toISOString(),
  };

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

  await updateInteractionResponse(token, {
    embeds: [embed],
    components: components,
  });
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
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);

  // B: Fetch active game spectator info
  const activeGame = await getActiveGame(account.puuid);
  if (!activeGame) {
    await updateInteractionResponse(token, {
      content: `🎮 ขณะนี้ **${account.gameName}#${account.tagLine}** ไม่อยู่ในระหว่างเล่นเกม หรือจบเกมไปแล้ว`,
    });
    return;
  }

  // C: Organize teams (Blue Team = 100, Red Team = 200)
  const blueTeam = [];
  const redTeam = [];

  for (const part of activeGame.participants) {
    const champName = await getChampionName(part.championId);
    
    // Split names in case they have hash tag or formats
    const displayName = part.riotId || part.summonerId || "Unknown Player";
    const line = `• **${displayName}** - เล่น **${champName}**`;
    
    if (part.teamId === 100) {
      blueTeam.push(line);
    } else {
      redTeam.push(line);
    }
  }

  const durationMin = activeGame.gameLength > 0 ? activeGame.gameLength / 60 : 0;
  
  const embed = {
    title: `🎮 Live Match: ${account.gameName}#${account.tagLine}`,
    color: 0x00FFCC, // Live Game Color (Cyan)
    description: `• **Game Mode:** ${activeGame.gameMode}\n• **Time Elapsed:** ~${Math.floor(durationMin)} นาที`,
    fields: [
      {
        name: "🔵 Blue Team",
        value: blueTeam.length > 0 ? blueTeam.join("\n") : "ไม่มีข้อมูล",
        inline: false,
      },
      {
        name: "🔴 Red Team",
        value: redTeam.length > 0 ? redTeam.join("\n") : "ไม่มีข้อมูล",
        inline: false,
      },
    ],
    footer: {
      text: "League of Legends Live Spectator Status",
    },
    timestamp: new Date().toISOString(),
  };

  await updateInteractionResponse(token, {
    embeds: [embed],
  });
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

  // C: Fetch Match Details & compile list
  const matchLines: string[] = [];
  const selectOptions: any[] = [];
  
  // Map positions to friendly game roles
  const ROLE_MAP: Record<string, string> = {
    TOP: "TOP",
    JUNGLE: "JG",
    MIDDLE: "MID",
    BOTTOM: "ADC",
    UTILITY: "SUP",
  };

  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
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
          ? "Perfect KDA"
          : `${((playerStats.kills + playerStats.assists) / playerStats.deaths).toFixed(2)}:1 KDA`;

        const winStatus = playerStats.win ? "🟢 **ชนะ**" : "🔴 **แพ้**";
        const role = ROLE_MAP[playerStats.individualPosition] || playerStats.individualPosition || "UNKNOWN";
        const kdaString = `**${playerStats.kills}**/**${playerStats.deaths}**/**${playerStats.assists}**`;

        matchLines.push(
          `**${i + 1}.** ${winStatus} | **${champName}** (${role})\n` +
          `   • KDA: ${kdaString} (${kdaVal})\n` +
          `   • CS: ${totalCs} (${csPerMin.toFixed(1)}/นาที) | เวลา: ${Math.floor(durationMin)} นาที`
        );

        // Add dropdown option for this game
        const winLabel = playerStats.win ? "ชนะ" : "แพ้";
        const labelText = `เกมที่ ${i + 1}: ${winLabel} - ${champName} (${role})`;
        const descText = `KDA: ${playerStats.kills}/${playerStats.deaths}/${playerStats.assists} | เวลา: ${Math.floor(durationMin)} นาที`;
        
        selectOptions.push({
          label: labelText.substring(0, 100),
          description: descText.substring(0, 100),
          value: matchId,
        });
      }
    } catch (e) {
      console.warn(`Failed to load details for match ${matchId}:`, e);
    }
  }

  if (matchLines.length === 0) {
    await updateInteractionResponse(token, {
      content: `❌ ไม่สามารถดึงรายละเอียดการเล่นล่าสุดเพื่อสรุปผลได้`,
    });
    return;
  }

  const embed = {
    title: `📜 Match History: ${account.gameName}#${account.tagLine}`,
    description: safeTruncate(`ประวัติการเล่น 10 เกมล่าสุด:\n\n${matchLines.join("\n\n")}`),
    color: 0x5865F2, // Blurple Color (Discord theme)
    footer: {
      text: "League of Legends Match History Status",
    },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1, // Action Row
      components: [
        {
          type: 3, // String Select
          custom_id: `detailgame:${account.gameName}#${account.tagLine}`,
          placeholder: "เลือกรอบการเล่นเพื่อดูรูปแชมเปี้ยนและรายละเอียด...",
          options: selectOptions,
        },
      ],
    },
  ];

  await updateInteractionResponse(token, {
    embeds: [embed],
    components: components,
  });
}

// Handler for showing detailed game info with champion image
async function handleDetailGameCommand(summonerInput: string, matchId: string, token: string) {
  const { gameName, tagLine } = parseRiotId(summonerInput);
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);
  
  // B: Fetch match detail
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
  const latestVersion = await getLatestVersion();

  // Calculate stats
  const totalCs = playerStats.totalMinionsKilled + playerStats.neutralMinionsKilled;
  const durationMin = match.info.gameDuration / 60;
  const csPerMin = durationMin > 0 ? totalCs / durationMin : 0;
  const kdaVal = playerStats.deaths === 0
    ? "Perfect"
    : ((playerStats.kills + playerStats.assists) / playerStats.deaths).toFixed(2);

  // Group participants into Blue (100) and Red (200) teams
  const blueTeam = [];
  const redTeam = [];

  for (const part of match.info.participants) {
    const partChampName = await getChampionName(part.championId);
    const displayName = part.riotIdGameName 
      ? `${part.riotIdGameName}#${part.riotIdTagline}` 
      : part.summonerId; // Fallback
    
    const kdaStr = `${part.kills}/${part.deaths}/${part.assists}`;
    const line = `• **${displayName}** - **${partChampName}** (${kdaStr})`;
    
    if (part.teamId === 100) {
      blueTeam.push(line);
    } else {
      redTeam.push(line);
    }
  }

  const embed = {
    title: `🎮 รายละเอียดเกม: ${account.gameName}#${account.tagLine} (${playerStats.win ? "🟢 ชนะ" : "🔴 แพ้"})`,
    description: `• **โหมดเกม:** ${match.info.gameMode}\n• **ระยะเวลา:** ${Math.floor(durationMin)} นาที`,
    color: playerStats.win ? 0x2ECC71 : 0xE74C3C, // Green for Win, Red for Loss
    thumbnail: {
      url: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${internalId}.png`,
    },
    image: {
      url: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${internalId}_0.jpg`,
    },
    fields: [
      {
        name: "📊 สถิติส่วนตัว",
        value: `• **เล่นแชมเปี้ยน:** ${champName}\n• **KDA:** ${playerStats.kills}/${playerStats.deaths}/${playerStats.assists} (${kdaVal}:1)\n• **CS:** ${totalCs} (${csPerMin.toFixed(1)}/นาที)\n• **Vision Score:** ${playerStats.visionScore}\n• **สร้างความเสียหาย:** ${playerStats.totalDamageDealtToChampions.toLocaleString()}\n• **เงินที่ได้รับ:** ${playerStats.goldEarned.toLocaleString()} Gold`,
        inline: false,
      },
      {
        name: "🔵 ทีมสีฟ้า (Blue Team)",
        value: blueTeam.length > 0 ? safeTruncate(blueTeam.join("\n"), 1024) : "ไม่มีข้อมูล",
        inline: false,
      },
      {
        name: "🔴 ทีมสีแดง (Red Team)",
        value: redTeam.length > 0 ? safeTruncate(redTeam.join("\n"), 1024) : "ไม่มีข้อมูล",
        inline: false,
      },
    ],
    footer: {
      text: `Riot Match ID: ${matchId}`,
    },
    timestamp: new Date().toISOString(),
  };

  await updateInteractionResponse(token, {
    embeds: [embed],
  });
}

// Handler for `/build`
async function handleBuildCommand(championQuery: string, token: string) {
  const buildInfo = await getAiBuildRecommendation(championQuery);
  const latestVersion = await getLatestVersion();

  let imageBuffer: Buffer | undefined;
  try {
    imageBuffer = await generateBuildImage(buildInfo);
  } catch (e) {
    console.error("Failed to generate build image:", e);
  }

  const embed: any = {
    title: `🛡️ Build แนะนำสำหรับแชมเปี้ยน: ${buildInfo.displayName}`,
    color: 0xF1C40F,
    thumbnail: {
      url: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${buildInfo.championIdName}.png`,
    },
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
          `**📦 Core:** ${buildInfo.coreItems.join(", ")}\n` +
          `**🌟 Situational:** ${buildInfo.situationalItems.join(", ")}\n` +
          `**🔮 Runes:** ${buildInfo.runes.keystone} (${buildInfo.runes.primaryTree}/${buildInfo.runes.secondaryTree})\n` +
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

