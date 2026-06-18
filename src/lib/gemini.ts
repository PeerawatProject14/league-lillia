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
