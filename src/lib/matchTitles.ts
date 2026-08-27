/**
 * Hands every player in a finished match badges earned by what they actually
 * did in it. Purely deterministic — no AI call, so /detailgame stays fast and
 * keeps working when the model is busy.
 *
 * The tone is Thai voice-chat trash talk and it is meant to sting, but it only
 * ever mocks play: deaths, farm, vision, damage, gold. Nine of the ten players
 * on a card are strangers, so nothing here touches the person behind the name.
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
  /** True for "best in the match" awards, which get a star on the card. */
  top: boolean;
}

interface Rule {
  text: string;
  tone: TitleTone;
  /** "top" gives the badge to the single highest scorer, "all" to everyone who qualifies. */
  kind: "top" | "all";
  score: (p: TitleCandidate, ctx: Context) => number | null;
}

interface Context {
  avgDeaths: number;
  avgDamage: number;
  avgVision: number;
  avgCsPerMin: number;
}

/** Most badges a single player can wear before the card gets unreadable. */
const MAX_TITLES = 3;

function kda(p: TitleCandidate): number {
  return (p.kills + p.assists) / Math.max(p.deaths, 1);
}

function qualify(condition: boolean, value: number): number | null {
  return condition ? value : null;
}

/**
 * Ordered by how much the badge is worth saying out loud. Everything near the
 * top is a verdict on the whole game; the tail is colour.
 */
const RULES: Rule[] = [
  // --- headline verdicts -------------------------------------------------
  { kind: "top", text: "พ่อทุกสถาบัน", tone: "good", score: p => qualify(kda(p) >= 3, kda(p)) },
  { kind: "top", text: "ตู้ ATM ไม่มีวันหมด", tone: "bad", score: (p, c) => qualify(p.deaths >= 7 && p.deaths >= c.avgDeaths * 1.3, p.deaths) },
  { kind: "all", text: "ฟีดจนศัตรูสงสาร", tone: "bad", score: (p, c) => qualify(p.deaths >= 8 && p.deaths >= c.avgDeaths * 1.5, p.deaths) },
  { kind: "all", text: "ตายจนหน้าด้าน", tone: "bad", score: p => qualify(p.deaths > p.kills + p.assists, p.deaths) },
  { kind: "all", text: "แจกยับสัส", tone: "bad", score: p => qualify(kda(p) < 1, -kda(p)) },
  { kind: "all", text: "โดนเพื่อนแบก", tone: "bad", score: p => qualify(p.win && kda(p) < 1.5, -kda(p)) },
  { kind: "all", text: "แบกจนหลังหัก", tone: "good", score: p => qualify(!p.win && kda(p) >= 4, kda(p)) },
  { kind: "all", text: "ควายเดินได้", tone: "bad", score: (p, c) => qualify(p.deaths >= c.avgDeaths * 1.35 && kda(p) < 1.2, p.deaths) },

  // --- damage ------------------------------------------------------------
  { kind: "top", text: "เครื่องบดเนื้อ", tone: "good", score: p => p.damage },
  { kind: "all", text: "โคตรพ่อดาเมจ", tone: "good", score: (p, c) => qualify(p.damage >= c.avgDamage * 1.6, p.damage) },
  { kind: "top", text: "ตีเหมือนยุงกัด", tone: "bad", score: p => qualify(p.role !== "UTILITY", -p.damage) },
  { kind: "all", text: "มาเดินชมสวนเหรอ", tone: "bad", score: (p, c) => qualify(p.role !== "UTILITY" && p.damage <= c.avgDamage * 0.4, -p.damage) },

  // --- kills and assists -------------------------------------------------
  { kind: "top", text: "มือสังหารเลือดเย็น", tone: "good", score: p => p.kills },
  { kind: "all", text: "ล่าหัวจนศัตรูขยาด", tone: "good", score: p => qualify(p.kills >= 12, p.kills) },
  { kind: "all", text: "ยิงไม่โดนสักนัด", tone: "bad", score: p => qualify(p.kills === 0, 1) },
  { kind: "top", text: "พี่เลี้ยงตัวจริง", tone: "good", score: p => p.assists },
  { kind: "all", text: "เล่นคนเดียวจบ", tone: "bad", score: p => qualify(p.assists <= 2, -p.assists) },
  { kind: "all", text: "อมตะ ไม่ตายสักดอก", tone: "good", score: p => qualify(p.deaths === 0, p.kills + p.assists) },

  // --- farm --------------------------------------------------------------
  { kind: "top", text: "ชาวนาโคตรขยัน", tone: "good", score: p => p.csPerMin },
  { kind: "all", text: "เครื่องดูดมินเนี่ยน", tone: "good", score: p => qualify(p.csPerMin >= 8, p.csPerMin) },
  { kind: "top", text: "ฟาร์มเหี้ยอะไร", tone: "bad", score: p => qualify(p.role !== "UTILITY" && p.csPerMin < 5.5, -p.csPerMin) },
  { kind: "all", text: "ลืมว่ามีมินเนี่ยน", tone: "bad", score: p => qualify(p.role !== "UTILITY" && p.csPerMin < 3, -p.csPerMin) },

  // --- vision ------------------------------------------------------------
  { kind: "top", text: "ตาทิพย์", tone: "good", score: p => p.visionScore },
  { kind: "top", text: "ตาบอดหรือไงวะ", tone: "bad", score: p => -p.visionScore },
  { kind: "all", text: "ไม่รู้จักวอร์ดหรอ", tone: "bad", score: p => qualify(p.visionScore <= 5, -p.visionScore) },
  { kind: "all", text: "ซัพเทพ ไม่ใช่ซัพหลอก", tone: "good", score: (p, c) => qualify(p.role === "UTILITY" && p.visionScore >= c.avgVision * 1.5, p.visionScore) },

  // --- solid but unspectacular, checked last so it never crowds out a roast
  { kind: "all", text: "ตัวหลักของทีม", tone: "good", score: p => qualify(kda(p) >= 2.5, kda(p)) },
  { kind: "all", text: "ตายน้อย หัวเย็น", tone: "good", score: (p, c) => qualify(p.deaths <= Math.max(3, c.avgDeaths * 0.5), -p.deaths) },
  { kind: "all", text: "ออกตัวช่วยตลอด", tone: "good", score: p => qualify(p.assists >= 10, p.assists) },
  { kind: "all", text: "เก็บครบทุกเวฟ", tone: "good", score: p => qualify(p.csPerMin >= 6.5, p.csPerMin) },

  // --- gold --------------------------------------------------------------
  { kind: "top", text: "รวยแต่ไร้ประโยชน์", tone: "bad", score: (p, c) => qualify(p.damage < c.avgDamage, p.gold) },
  { kind: "all", text: "ของครบแต่ไม่ตี", tone: "bad", score: (p, c) => qualify(p.gold >= 12000 && p.damage < c.avgDamage * 0.7, p.gold) },
];

/** Only reached by someone who was unremarkable at literally everything. */
const FILLERS = ["ไม่มีอะไรน่าจดจำ", "ตัวประกอบไร้บท", "มาให้ครบทีมเฉยๆ", "NPC ประจำเลน", "อยู่ก็ได้ไม่อยู่ก็ได้"];

export function assignMatchTitles(players: TitleCandidate[]): Record<string, AssignedTitle[]> {
  if (players.length === 0) return {};

  const ctx: Context = {
    avgDeaths: players.reduce((s, p) => s + p.deaths, 0) / players.length || 1,
    avgDamage: players.reduce((s, p) => s + p.damage, 0) / players.length || 1,
    avgVision: players.reduce((s, p) => s + p.visionScore, 0) / players.length || 1,
    avgCsPerMin: players.reduce((s, p) => s + p.csPerMin, 0) / players.length || 1,
  };

  const titles: Record<string, AssignedTitle[]> = {};
  for (const p of players) titles[p.key] = [];

  const hasRoom = (p: TitleCandidate) => titles[p.key].length < MAX_TITLES;

  for (const rule of RULES) {
    if (rule.kind === "all") {
      for (const p of players) {
        if (!hasRoom(p)) continue;
        if (rule.score(p, ctx) === null) continue;
        titles[p.key].push({ text: rule.text, tone: rule.tone, top: false });
      }
      continue;
    }

    let best: TitleCandidate | null = null;
    let bestScore = -Infinity;
    for (const p of players) {
      if (!hasRoom(p)) continue;
      const score = rule.score(p, ctx);
      if (score === null) continue;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) titles[best.key].push({ text: rule.text, tone: rule.tone, top: true });
  }

  // deterministic filler so the same match always reads the same
  let fillerIndex = 0;
  for (const p of players) {
    if (titles[p.key].length > 0) continue;
    titles[p.key].push({ text: FILLERS[fillerIndex % FILLERS.length], tone: "neutral", top: false });
    fillerIndex += 1;
  }

  return titles;
}
