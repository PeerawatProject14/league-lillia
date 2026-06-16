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
import { getChampionName } from "@/lib/champions";
import { getAiCoachingReport, MatchSummary } from "@/lib/gemini";

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

function getRankColor(tier: string): number {
  return RANK_COLORS[tier.toUpperCase()] || 0xFFFFFF;
}

// Function to update Discord deferred message
async function updateInteractionResponse(token: string, body: any) {
  const url = `https://discord.com/api/v10/webhooks/${DISCORD_APP_ID}/${token}/messages/@original`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
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

  const isValidRequest = verifyKey(body, signature, timestamp, DISCORD_PUBLIC_KEY);
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
      const summonerOption = interaction.data.options?.find((opt: any) => opt.name === "summoner");
      summonerInput = summonerOption?.value || "";
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
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ กรุณากรอกชื่อ Summoner (ตัวอย่าง: Name#Tag)" },
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
  
  // A: Fetch Riot account details
  const account = await getRiotAccount(gameName, tagLine);
  
  // B: Fetch Summoner details
  const summoner = await getSummonerByPuuid(account.puuid);
  
  // C: Fetch League entries (ranks)
  const leagues = await getLeagueEntries(summoner.id);
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
      url: `https://ddragon.leagueoflegends.com/cdn/14.12.1/img/profileicon/${summoner.profileIconId}.png`,
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
          url: `https://www.op.gg/summoners/th/${encodeURIComponent(account.gameName)}-${encodeURIComponent(account.tagLine)}`,
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
    description: coachingReport,
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
