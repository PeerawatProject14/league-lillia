/**
 * Hands every player in a finished match a title earned by what they actually
 * did in it. Purely deterministic — no AI call, so /detailgame stays fast and
 * keeps working when the model is busy.
 */

export interface TitleCandidate {
  key: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  visionScore: number;
  damage: number;
  gold: number;
  win: boolean;
  role: string;
  isMe: boolean;
}

export type TitleTone = "good" | "bad" | "neutral";

export interface AssignedTitle {
  text: string;
  tone: TitleTone;
}

interface Rule {
  text: string;
  tone: TitleTone;
  /** Higher score wins the title; null means the player does not qualify. */
  score: (p: TitleCandidate, ctx: Context) => number | null;
}

interface Context {
  players: TitleCandidate[];
  avgDamage: number;
  avgVision: number;
  totalKills: number;
}

function kda(p: TitleCandidate): number {
  return (p.kills + p.assists) / Math.max(p.deaths, 1);
}

/**
 * Mostly relative superlatives rather than fixed thresholds: with ten players
 * and thirteen rules almost everyone walks away with a real, earned title
 * instead of filler. The light gates that remain only stop absurd labels, like
 * calling someone an ATM for dying twice.
 */
const RULES: Rule[] = [
  {
    text: "เทพประจำเกม",
    tone: "good",
    score: p => (kda(p) >= 3 ? kda(p) : null),
  },
  {
    text: "อมตะ ไม่ตายสักครั้ง",
    tone: "good",
    score: p => (p.deaths === 0 ? p.kills + p.assists : null),
  },
  {
    text: "ตู้ ATM เคลื่อนที่",
    tone: "bad",
    score: p => (p.deaths >= 7 ? p.deaths : null),
  },
  {
    text: "ปืนใหญ่ประจำทีม",
    tone: "good",
    score: p => p.damage,
  },
  {
    text: "ตีเบาเหมือนลูบ",
    tone: "bad",
    score: p => (p.role !== "UTILITY" ? -p.damage : null),
  },
  {
    text: "ตาสว่างทั้งแมพ",
    tone: "good",
    score: p => p.visionScore,
  },
  {
    text: "ตาบอดสนิท",
    tone: "bad",
    score: p => -p.visionScore,
  },
  {
    text: "นักสวนแห่งชาติ",
    tone: "bad",
    score: p => (p.role !== "UTILITY" && p.csPerMin < 5.5 ? -p.csPerMin : null),
  },
  {
    text: "ชาวนาดีเด่น",
    tone: "good",
    score: p => p.csPerMin,
  },
  {
    text: "แจกอย่างเดียว",
    tone: "bad",
    score: p => (kda(p) < 1.6 ? -kda(p) : null),
  },
  {
    text: "มือปืนรับจ้าง",
    tone: "good",
    score: p => p.kills,
  },
  {
    text: "พี่เลี้ยงใจดี",
    tone: "good",
    score: p => p.assists,
  },
  {
    text: "เศรษฐีเงินเหลือ",
    tone: "bad",
    score: (p, c) => (p.damage < c.avgDamage ? p.gold : null),
  },
];

/** Nobody leaves without a label. */
const FILLERS = ["ค่าเฉลี่ยเดินได้", "ตัวประกอบ", "มาให้ครบทีม", "NPC ประจำเลน", "อยู่ก็ได้ไม่อยู่ก็ได้"];

export function assignMatchTitles(players: TitleCandidate[]): Record<string, AssignedTitle> {
  if (players.length === 0) return {};

  const ctx: Context = {
    players,
    avgDamage: players.reduce((s, p) => s + p.damage, 0) / players.length || 1,
    avgVision: players.reduce((s, p) => s + p.visionScore, 0) / players.length || 1,
    totalKills: players.reduce((s, p) => s + p.kills, 0) || 1,
  };

  const titles: Record<string, AssignedTitle> = {};
  const taken = new Set<string>();

  for (const rule of RULES) {
    let best: TitleCandidate | null = null;
    let bestScore = -Infinity;
    for (const p of players) {
      if (taken.has(p.key)) continue;
      const score = rule.score(p, ctx);
      if (score === null) continue;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) {
      titles[best.key] = { text: rule.text, tone: rule.tone };
      taken.add(best.key);
    }
  }

  // deterministic filler so the same match always reads the same
  let fillerIndex = 0;
  for (const p of players) {
    if (taken.has(p.key)) continue;
    titles[p.key] = { text: FILLERS[fillerIndex % FILLERS.length], tone: "neutral" };
    fillerIndex += 1;
  }

  return titles;
}
