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
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

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
