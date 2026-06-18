import { GoogleGenerativeAI } from "@google/generative-ai";
import { MatchParticipant } from "./riot";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export interface MatchSummary {
  championName: string;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  cs: number;
  csPerMin: number;
  visionScore: number;
  damageDealt: number;
  goldEarned: number;
  gameDurationMinutes: number;
}

/**
 * Generates an AI League of Legends coaching report in Thai based on recent matches
 */
export async function getAiCoachingReport(
  summonerName: string,
  matches: MatchSummary[]
): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-flash-latest" });

  // Format matches statistics for the prompt
  let matchDataText = "";
  matches.forEach((match, index) => {
    matchDataText += `
Match #${index + 1}:
- Champion: ${match.championName}
- Role: ${match.role}
- Result: ${match.win ? "WIN" : "LOSS"}
- K/D/A: ${match.kills}/${match.deaths}/${match.assists} (KDA: ${match.kda})
- CS: ${match.cs} (${match.csPerMin.toFixed(1)} CS/min)
- Vision Score: ${match.visionScore}
- Damage Dealt to Champions: ${match.damageDealt.toLocaleString()}
- Gold Earned: ${match.goldEarned.toLocaleString()}
- Game Duration: ${match.gameDurationMinutes.toFixed(1)} mins
`;
  });

  const prompt = `
You are a highly experienced professional League of Legends coach. Your job is to analyze the recent matches of a summoner and provide detailed, constructive, and highly tactical feedback in Thai.

Summoner Name: ${summonerName}

Recent Matches Stats:
${matchDataText}

Please write a coaching review that is:
1. **Tone:** Professional, direct, supportive, and engaging. Use popular League of Legends gaming lingo in Thai/English (such as 'cs', 'kda', 'gank', 'carry', 'ward', 'positioning', 'map control', 'laning phase').
2. **Analysis:**
   - Summarize their performance over these matches (overall win rate, average KDA, main roles).
   - Point out specific strengths (e.g. high CS/min, good vision score, or high damage share).
   - Identify critical weaknesses or areas of concern (e.g. dying too much, low vision score, inconsistent farm).
   - Give 2-3 concrete tips on how they can improve based on their stats (e.g., "In the match on Ahri, you had a high death count which suggests you need to work on positioning during teamfights or warding your river during laning phase").
3. **Format:** Use markdown formatting with bullet points and bold text where appropriate to make it highly readable. Write in Thai. Keep the length concise (about 3-4 paragraphs) suitable for a Discord message. Do not use generic filler.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "ไม่สามารถดึงคำแนะนำการโค้ชชิ่งได้ในขณะนี้";
  } catch (error) {
    console.error("Failed to generate AI coaching report:", error);
    throw new Error("Failed to generate coaching analysis from Gemini API.");
  }
}

export interface BuildRecommendation {
  championIdName: string;
  displayName: string;
  starterItems: string[];
  coreItems: string[];
  bootsIndex: number;
  situationalItems: string[];
  optionalItems: string[];
  runes: {
    keystone: string;
    primaryTree: string;
    secondaryTree: string;
    details: string[];
  };
  skillPriority: string[];
  summonerSpells: string[];
  strongAgainst: string[];
  weakAgainst: string[];
  vsChampionIdName?: string;
  vsChampionDisplayName?: string;
  matchupTip?: string;
}

/**
 * Generates an AI League of Legends build recommendation in Thai for a specific champion
 */
const BUILD_MODEL_CHAIN = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const GROQ_MODEL_CHAIN = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

async function callGroqForBuild(prompt: string, label: string): Promise<BuildRecommendation> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured; cannot fall back to Groq.");
  }

  let lastErr: any = null;
  for (const modelName of GROQ_MODEL_CHAIN) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content:
                "You are a League of Legends build assistant. Respond with VALID JSON only — no prose, no markdown fences. The JSON shape is dictated by the user message.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[${label}/groq:${modelName}] HTTP ${res.status}: ${txt.slice(0, 300)}`);
        lastErr = new Error(`Groq ${modelName} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`[${label}/groq:${modelName}] empty content`);
        lastErr = new Error("Empty Groq response");
        continue;
      }

      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      try {
        return JSON.parse(cleaned) as BuildRecommendation;
      } catch (parseErr) {
        console.warn(`[${label}/groq:${modelName}] JSON parse failed. First 400: ${content.slice(0, 400)}`);
        lastErr = parseErr;
        continue;
      }
    } catch (e: any) {
      lastErr = e;
      console.warn(`[${label}/groq:${modelName}] threw: ${e?.message ?? e}`);
    }
  }
  throw lastErr ?? new Error("All Groq models failed");
}

async function callGeminiForBuild(prompt: string, label: string): Promise<BuildRecommendation> {
  const client = getGeminiClient();
  let lastErr: any = null;

  for (const modelName of BUILD_MODEL_CHAIN) {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        if (!jsonText) throw new Error("Empty response from Gemini");
        try {
          return JSON.parse(jsonText) as BuildRecommendation;
        } catch (parseErr) {
          const cleaned = jsonText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/i, "")
            .trim();
          try {
            return JSON.parse(cleaned) as BuildRecommendation;
          } catch {
            console.warn(`[${label}/${modelName}] attempt ${attempt} JSON parse failed. First 400 chars: ${jsonText.slice(0, 400)}`);
            throw parseErr;
          }
        }
      } catch (e: any) {
        lastErr = e;
        const status = e?.status;
        const overloaded = status === 503 || status === 429;
        console.warn(`[${label}/${modelName}] attempt ${attempt}/${MAX_ATTEMPTS} failed (status ${status ?? "?"}): ${e?.message ?? e}`);
        // If overloaded, skip remaining attempts on this model and fall through to next model
        if (overloaded) break;
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
    }
    // brief pause before falling back to next model
    await new Promise(r => setTimeout(r, 300));
  }

  // All Gemini models failed → try Groq as final fallback if configured
  if (process.env.GROQ_API_KEY) {
    console.warn(`[${label}] all Gemini models failed, falling back to Groq`);
    try {
      return await callGroqForBuild(prompt, label);
    } catch (e: any) {
      console.warn(`[${label}] Groq fallback also failed: ${e?.message ?? e}`);
      lastErr = e;
    }
  }

  throw lastErr ?? new Error(`${label} failed across all models`);
}

export async function getAiBuildRecommendation(championQuery: string): Promise<BuildRecommendation> {
  const prompt = `
  Analyze the following League of Legends champion query: "${championQuery}".
  Determine which champion the user is referring to (they might search in Thai like "ลูเซียน" or English like "Lucian").
  Identify the exact official Riot Games internal ID for this champion (used in Data Dragon URLs, e.g. "MonkeyKing" for Wukong, "Kaisa" for Kai'Sa, "Aatrox" for Aatrox, "LeBlanc" for Leblanc, "Fiddlesticks" for Fiddlesticks).
  
  Provide a clean, highly structured build recommendation in Thai for that champion.
  Do not include long paragraphs, gameplay tips, or combo instructions. Only include the requested JSON fields.
  
  For strongAgainst and weakAgainst, provide exactly 3 champion display names that the query champion is strong or weak against.
  
  Output MUST be a JSON object with the following schema:
  {
    "championIdName": "Exact DDragon internal ID name",
    "displayName": "Readable display name of champion",
    "starterItems": ["Starter Item 1 (Thai/Eng translation)", "Starter Item 2"],
    "coreItems": ["Big Item 1", "Recommended Boots", "Big Item 2"],
    "bootsIndex": 1,
    "situationalItems": ["Situational Item 1", "Situational Item 2", "Situational Item 3"],
    "optionalItems": ["Optional/alternative Item 1", "Optional Item 2", "Optional Item 3"],
    "runes": {
      "keystone": "Keystone name",
      "primaryTree": "Primary tree name (e.g. Precision)",
      "secondaryTree": "Secondary tree name (e.g. Inspiration)",
      "details": ["Rune detail 1", "Rune detail 2", "Rune detail 3", "Rune detail 4", "Rune detail 5"]
    },
    "skillPriority": ["Q", "E", "W"],
    "summonerSpells": ["Flash", "Ignite"],
    "strongAgainst": ["Champ 1", "Champ 2", "Champ 3"],
    "weakAgainst": ["Champ 1", "Champ 2", "Champ 3"]
  }

  Skill order rules:
  - "skillPriority" lists Q/W/E in level-up priority order (highest priority first). Exactly 3 entries. Do NOT include "R" (R is always maxed first whenever possible). Example for an AP mage who maxes Q first, then E, then W: ["Q","E","W"].

  Summoner spells:
  - "summonerSpells" contains exactly 2 summoner spell names (English) appropriate for this champion's role. Use simple names from this set: Flash, Ignite, Teleport, Heal, Barrier, Exhaust, Cleanse, Ghost, Smite, Snowball. Flash is almost always one of the two.

  CRITICAL rules for items (LoL has 6 item slots total, excluding starter/trinket):
  - "coreItems" represents slots 1-3 (the fixed early build path). Provide EXACTLY 3 items in build order: a big item, then boots, then a big item.
    Example for an AP carry: ["Liandry's Torment", "Sorcerer's Shoes", "Rabadon's Deathcap"].
  - "bootsIndex" must be the 0-based index of the boots inside coreItems (usually 1, since boots typically go second).
  - "situationalItems" are the HIGHER-PRIORITY picks for slots 4-6 — what the player should usually build. Provide EXACTLY 3 items in priority order (best first).
  - "optionalItems" are LOWER-PRIORITY alternatives the player can swap in if the game state calls for it (vs. heavy AD, lots of crowd control, etc.). Provide EXACTLY 3 items. Do NOT repeat items already in coreItems or situationalItems.
  `;

  try {
    return await callGeminiForBuild(prompt, "build");
  } catch (error) {
    console.error("Failed to generate build recommendation:", error);
    throw new Error("Failed to get build recommendation from Gemini AI.");
  }
}

export interface MatchReviewInput {
  scope: "self" | "team";
  myChampion: string;
  myRole: string;
  myWin: boolean;
  myStats: {
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    csPerMin: number;
    visionScore: number;
    damage: number;
    gold: number;
  };
  gameMinutes: number;
  gameMode: string;
  // team summary used for both scopes (gives context for self review too)
  blue: Array<{ name: string; champion: string; role: string; kda: string; cs: number; win: boolean; isMe: boolean }>;
  red: Array<{ name: string; champion: string; role: string; kda: string; cs: number; win: boolean; isMe: boolean }>;
}

async function callGeminiForText(prompt: string, label: string, maxTokens = 600): Promise<string> {
  const client = getGeminiClient();
  let lastErr: any = null;
  for (const modelName of BUILD_MODEL_CHAIN) {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    try {
      const result = await model.generateContent(prompt);
      const text = (await result.response).text();
      if (text) return text;
      throw new Error("Empty response");
    } catch (e: any) {
      lastErr = e;
      console.warn(`[${label}/${modelName}] failed (status ${e?.status ?? "?"}): ${e?.message ?? e}`);
      const overloaded = e?.status === 503 || e?.status === 429;
      if (!overloaded) await new Promise(r => setTimeout(r, 400));
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.warn(`[${label}/groq] fallback failed:`, e);
    }
  }
  throw lastErr ?? new Error(`${label} text gen failed`);
}

export async function getAiMatchReview(input: MatchReviewInput): Promise<string> {
  const playerOnBlue = input.blue.some(p => p.isMe);
  const playerTeamColorEn = playerOnBlue ? "BLUE" : "RED";
  const playerTeamColorTh = playerOnBlue ? "ทีมน้ำเงิน" : "ทีมแดง";
  const enemyTeamColorEn = playerOnBlue ? "RED" : "BLUE";
  const enemyTeamColorTh = playerOnBlue ? "ทีมแดง" : "ทีมน้ำเงิน";

  const teamLine = (team: typeof input.blue, color: string) =>
    `${color} TEAM:\n` +
    team.map(p => `- ${p.champion} (${p.role}): ${p.kda} KDA, ${p.cs} CS${p.isMe ? "  ← ผู้เล่นที่ขอรีวิว" : ""}`).join("\n");

  if (input.scope === "self") {
    const myTeam = playerOnBlue ? input.blue : input.red;
    const enemyTeam = playerOnBlue ? input.red : input.blue;
    const oppositeLaner = enemyTeam.find(p => p.role === input.myRole);
    const opposite = oppositeLaner
      ? `Opposite ${input.myRole}: ${oppositeLaner.champion} ${oppositeLaner.kda} KDA, ${oppositeLaner.cs} CS`
      : `(No direct opposite ${input.myRole} laner found)`;

    const prompt = `
You are an experienced LoL coach analyzing ONE specific match for a single player. Reply in Thai. Be DETAILED, SPECIFIC, and reference the actual numbers. NEVER use vague filler like "ควรปรับให้ดีขึ้น" or "เล่นให้ดีกว่านี้" — every claim must cite a number or a role-vs-role comparison.

ผู้เล่นเล่นอยู่ ${playerTeamColorTh} (${playerTeamColorEn}) ฝั่งตรงข้ามคือ ${enemyTeamColorTh} (${enemyTeamColorEn})

Player: ${input.myChampion} (${input.myRole}) — ${input.myWin ? "WIN" : "LOSS"}
KDA: ${input.myStats.kills}/${input.myStats.deaths}/${input.myStats.assists}
CS: ${input.myStats.cs} (${input.myStats.csPerMin.toFixed(1)}/min)
Vision: ${input.myStats.visionScore}, Damage: ${input.myStats.damage.toLocaleString()}, Gold: ${input.myStats.gold.toLocaleString()}
Duration: ${Math.floor(input.gameMinutes)} min, Mode: ${input.gameMode}
${opposite}

${teamLine(myTeam, playerTeamColorEn)}

${teamLine(enemyTeam, enemyTeamColorEn)}

เมื่ออ้างถึงทีม ให้ใช้ "${playerTeamColorTh}" หรือ "${enemyTeamColorTh}" — ห้ามใช้คำว่า [ME] หรือ "ทีมของผู้เล่น" ในข้อความออก

ROLE CONTEXT (read carefully — judge by role, NOT raw numbers):
- UTILITY (support): low kills + HIGH assists = good. Death ≤6 with 20+ assists = excellent. CS unimportant. Vision 30+ is great, 15- is low.
- JUNGLE: KDA ratio matters most. Deaths ≤4 ideal. CS/min 5-6 expected. Vision score 20+.
- BOTTOM (ADC): CS/min 7+ ideal. Damage output highest expected. Both kills+assists matter.
- MIDDLE: CS/min 6+ ideal. Damage carry. Roams help team.
- TOP: CS/min 6+ ideal. Often tanky front-line or split-push. KDA ratio.

COMPARE THE PLAYER TO THE OPPOSITE LANER in the same role wherever possible.

Compare the player's numbers to what's expected for their role, and reference specific enemy laners/junglers by name when relevant.

Format (Markdown, ใช้ bold สำหรับหัวข้อ, bullets ใช้ • ขึ้นต้น):

**📊 ภาพรวมเกม:**
2-3 ประโยค สรุปว่าเกมนี้ผู้เล่นเล่นยังไง, มีอิมแพคต่อทีมแค่ไหน, ช่วงไหนเด่น/ช่วงไหนพลาด

**✅ ทำได้ดี:**
2-3 bullets เจาะลึกพร้อมตัวเลข (เช่น "CS 7.5/min สูงกว่าค่าเฉลี่ย ADC, แสดงว่า farm efficiency ดี")

**⚠️ ควรปรับ:**
2-3 bullets เจาะลึก + บอกสาเหตุที่เป็นไปได้ (เช่น "Death 8 ครั้ง แต่ damage แค่ 12k บอกว่าน่าจะตายเข้ารบไม่ออก ลอง position หลังกว่านี้")

**🎯 ข้อเสนอแนะสำหรับเกมหน้า:**
2-3 bullets เป็น action concrete ที่เอาไปใช้ได้จริง (warding, item timing, combo, decision making, ฯลฯ)

Total 180-250 Thai words. Don't summarize — give the player something actionable.
`.trim();
    return (await callGeminiForText(prompt, "review:self", 1200)).trim();
  }

  // team scope
  const myTeam = playerOnBlue ? input.blue : input.red;
  const enemyTeam = playerOnBlue ? input.red : input.blue;
  const winningColorTh =
    (input.myWin && playerOnBlue) || (!input.myWin && !playerOnBlue) ? "ทีมน้ำเงิน" : "ทีมแดง";
  const losingColorTh = winningColorTh === "ทีมน้ำเงิน" ? "ทีมแดง" : "ทีมน้ำเงิน";

  const prompt = `
You are an experienced LoL coach reviewing a finished match. Reply in Thai. Be DETAILED, SPECIFIC, and CORRECT.

ผู้เล่นที่ขอรีวิวอยู่ ${playerTeamColorTh} (${playerTeamColorEn}) ฝั่งตรงข้ามคือ ${enemyTeamColorTh} (${enemyTeamColorEn})
ทีมที่ชนะ: ${winningColorTh}
ทีมที่แพ้: ${losingColorTh}
Duration: ${Math.floor(input.gameMinutes)} min, Mode: ${input.gameMode}

${teamLine(myTeam, playerTeamColorEn)}

${teamLine(enemyTeam, enemyTeamColorEn)}

เมื่ออ้างถึงทีม ให้ใช้ "ทีมน้ำเงิน" หรือ "ทีมแดง" — ห้ามใช้คำว่า [ME] หรือ "ทีมของผู้เล่น" / "ทีมตรงข้าม" ในข้อความออก

CRITICAL RULES — read carefully:
1. ROLE CONTEXT — judge each player by their role's expectations, NOT raw KDA:
   - Support (UTILITY): low kills + HIGH assists = good. Death ~5 with assists 20+ is excellent. CS doesn't matter. Vision is what matters but it's not given here — assume average.
   - Jungle: deaths matter most. 1/9/X is BAD (too many deaths). 7+/2/X is great. KDA ratio is key.
   - ADC (BOTTOM): CS/min should be 7+. Damage output expected highest. Kills/Assists both count.
   - Mid (MIDDLE): CS 6+/min. Damage carry. KDA balanced.
   - Top (TOP): CS 6+/min. Often split-push or front-line tank — judge by KDA ratio AND CS.

2. CROSS-TEAM COMPARISON — when you label someone a "weakness" or "strength", you MUST compare to the OPPOSITE LANER in the same role.
   Example: "Soraka 0/5/25 ของ${playerTeamColorTh}ดีกว่า Nautilus 2/8/15 ของ${enemyTeamColorTh} ที่ตายเยอะกว่าและ KP ต่ำกว่า"

3. CAUSE-EFFECT — explain why the result happened. The winning team had ADVANTAGES; the losing team had GAPS. Be concrete.

4. DO NOT use vague phrases like "ไม่สามารถทำได้ดีเท่าที่ควร", "ควรเล่นให้ดีขึ้น" — these are useless. Every claim must cite a number or a role-vs-role comparison.

5. DO NOT confuse which team won. The winner is: ${winningColorTh}.

Format (Markdown, ใช้ bold สำหรับหัวข้อ, bullets ใช้ • ขึ้นต้น):

**📊 ภาพรวมแมตช์:**
2-3 ประโยค อธิบายว่าทำไม ${winningColorTh} ถึงชนะ — ใครเป็นคน carry, ใครเป็นจุดอ่อนของฝั่งแพ้ (ระบุชัด)

**🏆 ผู้เล่นเด่นในแมตช์ (ทุกฝั่ง):**
2 ประโยค — เลือก MVP ของแต่ละทีม โดยอ้างจาก stat เทียบกับ role expectation และเทียบกับ opposite laner

**📉 จุดอ่อนของ${playerTeamColorTh}:**
2-3 bullets — สำหรับแต่ละ bullet ต้องบอก: ผู้เล่นไหน + ตัวเลขที่ต่ำกว่ามาตรฐาน role + เปรียบเทียบกับ opposite laner. ถ้า${playerTeamColorTh}ชนะ และไม่มีจุดอ่อนชัดเจน ให้บอกว่า "ไม่มีจุดอ่อนชัดเจน" แทนที่จะหาเรื่อง

**🛡️ จุดแข็งของ${enemyTeamColorTh}:**
1-2 bullets — สำหรับผู้เล่น${enemyTeamColorTh}ที่ทำได้ดีกว่า opposite laner ของ${playerTeamColorTh} (ระบุชื่อ + ตัวเลข + เปรียบเทียบ)

**🎯 ${input.myWin ? "วิธีรักษาฟอร์ม" : "วิธีพลิกเกมแบบนี้"}ครั้งหน้า:**
2-3 bullets concrete (drafting, macro, objective, teamfight) เจาะจงตาม composition ของแมตช์นี้

Total 250-350 Thai words. Reference champions and roles by name throughout.
`.trim();
  return (await callGeminiForText(prompt, "review:team", 1800)).trim();
}

export interface LiveGamePrediction {
  blueWinChance: number;
  redWinChance: number;
  keyMatchups: string[];
  userAdvice: string;
}

interface LiveTeamInput {
  champions: string[];
}

const PREDICTION_MODEL_CHAIN = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

async function callGeminiForPrediction(prompt: string): Promise<LiveGamePrediction> {
  const client = getGeminiClient();
  let lastErr: any = null;
  for (const modelName of PREDICTION_MODEL_CHAIN) {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    try {
      const result = await model.generateContent(prompt);
      const jsonText = (await result.response).text();
      if (!jsonText) throw new Error("Empty");
      const cleaned = jsonText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      return JSON.parse(cleaned) as LiveGamePrediction;
    } catch (e: any) {
      lastErr = e;
      console.warn(`[prediction/${modelName}] failed (status ${e?.status ?? "?"}): ${e?.message ?? e}`);
      const overloaded = e?.status === 503 || e?.status === 429;
      if (!overloaded) await new Promise(r => setTimeout(r, 400));
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Respond with VALID JSON only. No prose, no fences." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return JSON.parse(content) as LiveGamePrediction;
      }
    } catch (e) {
      console.warn("[prediction/groq] fallback failed:", e);
    }
  }

  throw lastErr ?? new Error("Prediction failed across all models");
}

export async function getAiLiveGamePrediction(
  blueTeam: LiveTeamInput,
  redTeam: LiveTeamInput,
  userTeamColor: "blue" | "red",
  userChampion: string
): Promise<LiveGamePrediction> {
  const prompt = `
  You are a professional League of Legends analyst. Predict the outcome of an ongoing match based on team compositions alone (no rank/player skill info).

  BLUE TEAM champions: ${blueTeam.champions.join(", ")}
  RED TEAM champions: ${redTeam.champions.join(", ")}

  The user is playing on the ${userTeamColor.toUpperCase()} team as ${userChampion}.

  Respond with VALID JSON only, schema:
  {
    "blueWinChance": <integer 0-100>,
    "redWinChance": <integer 0-100, must sum with blueWinChance to 100>,
    "keyMatchups": ["<1-2 sentence Thai sentence about an important matchup or comp strength>", "...", "..."],
    "userAdvice": "<1-2 sentence Thai advice for the user about how to win this specific game>"
  }

  Rules:
  - "keyMatchups" must contain exactly 3 short Thai sentences. Each focuses on either a key lane matchup or a team-comp dynamic (engage vs. peel, AP/AD balance, scaling, etc.).
  - "userAdvice" is concrete and tailored to the user's champion in this draft.
  - All Thai text. Win chances must be integers summing to 100.
  `;

  return await callGeminiForPrediction(prompt);
}

/**
 * Generates a matchup-specific build for a champion VS another champion.
 */
export async function getAiMatchupBuildRecommendation(
  myChampionQuery: string,
  vsChampionQuery: string
): Promise<BuildRecommendation> {
  const prompt = `
  You are an expert League of Legends coach. The user wants a MATCHUP-SPECIFIC build.
  - The champion they will play: "${myChampionQuery}"
  - The opposing champion (the lane / threat they need to deal with): "${vsChampionQuery}"

  Both names may be in Thai (e.g. "ลูเซียน") or English (e.g. "Lucian"). Identify each.

  Tailor the build so that:
  - "situationalItems" prioritize counter items against the enemy's damage type (armor vs AD, MR vs AP, grievous wounds vs healing, anti-shield, tenacity vs CC, etc.).
  - "runes" lean toward the strongest matchup choice (e.g. Fleet Footwear into poke lanes, Conqueror into extended trades, Phase Rush into kite-heavy enemies).
  - "summonerSpells" reflect the matchup (e.g. Exhaust into burst, Cleanse into hard CC).
  - "matchupTip" is a SHORT 1-2 sentence Thai tip on how to play the lane against this specific opponent. Concrete and actionable (e.g. "ระวัง all-in ของ Zed ตอนเลเวล 6 ถ้าโดน mark ให้ใช้ Stopwatch หลบ").
  - "skillPriority" must still exclude "R" — 3 entries (Q/W/E) in level-up order.

  Identify the exact official Riot Games internal IDs for both champions (DDragon naming, e.g. "MonkeyKing" for Wukong, "Kaisa" for Kai'Sa, "LeBlanc" for Leblanc).

  Output MUST be a JSON object with the following schema (note the extra matchup fields):
  {
    "championIdName": "Internal ID of MY champion",
    "displayName": "Readable display name of MY champion",
    "vsChampionIdName": "Internal ID of OPPOSING champion",
    "vsChampionDisplayName": "Readable display name of OPPOSING champion",
    "matchupTip": "1-2 sentence Thai tip about playing this lane",
    "starterItems": ["Starter Item 1", "Starter Item 2"],
    "coreItems": ["Big Item 1", "Recommended Boots", "Big Item 2"],
    "bootsIndex": 1,
    "situationalItems": ["Counter pick 1", "Counter pick 2", "Counter pick 3"],
    "optionalItems": ["Optional 1", "Optional 2", "Optional 3"],
    "runes": {
      "keystone": "Keystone name",
      "primaryTree": "Primary tree name",
      "secondaryTree": "Secondary tree name",
      "details": ["Rune detail 1", "Rune detail 2", "Rune detail 3", "Rune detail 4", "Rune detail 5"]
    },
    "skillPriority": ["Q", "E", "W"],
    "summonerSpells": ["Flash", "Ignite"],
    "strongAgainst": ["Champ 1", "Champ 2", "Champ 3"],
    "weakAgainst": ["Champ 1", "Champ 2", "Champ 3"]
  }

  CRITICAL rules:
  - "coreItems" has exactly 3 items in build order (big, boots, big). "bootsIndex" is 0-based pointer to the boots inside coreItems (usually 1).
  - "situationalItems" are the matchup-priority picks for slots 4-6 (best first). EXACTLY 3 items.
  - "optionalItems" are alternative flex picks. EXACTLY 3 items. No duplicates with core/situational.
  - "summonerSpells" exactly 2; Flash is almost always one of them.
  - "skillPriority" exactly 3 (Q/W/E only, no R).
  - "matchupTip" required, written in Thai.
  `;

  try {
    return await callGeminiForBuild(prompt, "buildvs");
  } catch (error) {
    console.error("Failed to generate matchup build recommendation:", error);
    throw new Error("Failed to get matchup build from Gemini AI.");
  }
}
