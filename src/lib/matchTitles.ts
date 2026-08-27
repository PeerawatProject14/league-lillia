/**
 * Hands every player in a finished match badges earned by what they actually
 * did in it. Purely deterministic — no AI call, so /detailgame stays fast and
 * keeps working when the model is busy.
 *
 * Labels are deliberately terse — five of them have to sit on one line — and
 * they only ever comment on play: deaths, farm, vision, damage, gold. Nine of
 * the ten players on a card are strangers, so nothing here touches the person.
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
  pentaKills: number;
  soloKills: number;
  /** 0-1 share of the team's damage to champions. */
  teamDamageShare: number;
  gameMinutes: number;
}

export type TitleTone = "good" | "bad" | "neutral";

export interface AssignedTitle {
  text: string;
  tone: TitleTone;
  /** True for "best in the match" awards, which get a star on the card. */
  top: boolean;
  /** True for the rare tier above gold. */
  legendary: boolean;
}

interface Rule {
  text: string;
  tone: TitleTone;
  /** "top" gives the badge to the single highest scorer, "all" to everyone who qualifies. */
  kind: "top" | "all";
  /** Rare tier above gold; ignores the gold ceiling and always sorts first. */
  legendary?: boolean;
  score: (p: TitleCandidate, ctx: Context) => number | null;
}

interface Context {
  avgDeaths: number;
  avgDamage: number;
  avgVision: number;
  avgCsPerMin: number;
}

/** Most badges a single player can wear before the row overflows. */
const MAX_TITLES = 5;

function kda(p: TitleCandidate): number {
  return (p.kills + p.assists) / Math.max(p.deaths, 1);
}

function qualify(condition: boolean, value: number): number | null {
  return condition ? value : null;
}

function isSupport(p: TitleCandidate): boolean {
  return p.role === "UTILITY";
}

/** Nobody sweeps the podium; three gold badges on one player reads as a bug. */
const MAX_GOLD = 2;

/**
 * Ordered by how much the badge is worth saying out loud. "top" rules crown the
 * best in the match and render gold; the rest fill in around them.
 */
const RULES: Rule[] = [
  // --- legendary (purple): hard, but every one of these happens on a real
  // ladder. Thresholds were tuned against real matches, not guessed.
  { kind: "all", legendary: true, text: "PENTAKILL", tone: "good", score: p => qualify(p.pentaKills >= 1, p.pentaKills) },
  { kind: "all", legendary: true, text: "ไร้เทียมทาน", tone: "good", score: p => qualify(p.deaths === 0 && p.kills + p.assists >= 12 && p.gameMinutes >= 20, p.kills + p.assists) },
  { kind: "all", legendary: true, text: "1v9", tone: "good", score: p => qualify(p.teamDamageShare >= 0.35 && kda(p) >= 5, p.teamDamageShare) },
  { kind: "all", legendary: true, text: "โคตรเทพ", tone: "good", score: p => qualify(kda(p) >= 14 && p.kills + p.assists >= 20, kda(p)) },
  { kind: "all", legendary: true, text: "นักล่าเดี่ยว", tone: "good", score: p => qualify(p.soloKills >= 12, p.soloKills) },

  // --- best in the match (gold) -----------------------------------------
  // KDA, assists and vision are won by a support in ~80% of games simply
  // because of the role, so those three are contested among the other lanes
  // and supports get one gold of their own instead.
  { kind: "top", text: "เทพเกมนี้", tone: "good", score: p => qualify(!isSupport(p) && kda(p) >= 3, kda(p)) },
  { kind: "top", text: "ซัพเทพ", tone: "good", score: p => qualify(isSupport(p), p.visionScore + p.assists * 1.5) },
  { kind: "top", text: "ดาเมจสูงสุด", tone: "good", score: p => p.damage },
  { kind: "top", text: "นักล่า", tone: "good", score: p => p.kills },
  { kind: "top", text: "พี่เลี้ยง", tone: "good", score: p => qualify(!isSupport(p), p.assists) },
  { kind: "top", text: "ชาวนา", tone: "good", score: p => p.csPerMin },
  { kind: "top", text: "ตาทิพย์", tone: "good", score: p => qualify(!isSupport(p), p.visionScore) },

  // --- worst in the match (red) -----------------------------------------
  { kind: "top", text: "ตู้ ATM", tone: "bad", score: (p, c) => qualify(p.deaths >= 7 && p.deaths >= c.avgDeaths * 1.3, p.deaths) },
  { kind: "top", text: "ตีเบา", tone: "bad", score: p => qualify(!isSupport(p), -p.damage) },
  { kind: "top", text: "ไม่ฟาร์ม", tone: "bad", score: p => qualify(!isSupport(p) && p.csPerMin < 5.5, -p.csPerMin) },
  { kind: "top", text: "ตาบอด", tone: "bad", score: p => -p.visionScore },
  { kind: "top", text: "รวยเปล่า", tone: "bad", score: (p, c) => qualify(p.damage < c.avgDamage, p.gold) },

  // --- roasts (red) -------------------------------------------------------
  { kind: "all", text: "ฟีดหนัก", tone: "bad", score: (p, c) => qualify(p.deaths >= 8 && p.deaths >= c.avgDeaths * 1.5, p.deaths) },
  { kind: "all", text: "ตายเกินงาน", tone: "bad", score: p => qualify(p.deaths > p.kills + p.assists, p.deaths) },
  { kind: "all", text: "แจกยับ", tone: "bad", score: p => qualify(kda(p) < 1, -kda(p)) },
  { kind: "all", text: "โดนแบก", tone: "bad", score: p => qualify(p.win && kda(p) < 1.5, -kda(p)) },
  { kind: "all", text: "ตีไม่ออก", tone: "bad", score: (p, c) => qualify(!isSupport(p) && p.damage <= c.avgDamage * 0.4, -p.damage) },
  { kind: "all", text: "ไม่มีคิล", tone: "bad", score: p => qualify(p.kills === 0, 1) },
  { kind: "all", text: "เล่นคนเดียว", tone: "bad", score: p => qualify(p.assists <= 2, -p.assists) },
  { kind: "all", text: "ไม่มี CS", tone: "bad", score: p => qualify(!isSupport(p) && p.csPerMin < 3, -p.csPerMin) },
  { kind: "all", text: "ไม่ปักวอร์ด", tone: "bad", score: p => qualify(p.visionScore <= 5, -p.visionScore) },
  { kind: "all", text: "ถือของเปล่า", tone: "bad", score: (p, c) => qualify(p.gold >= 12000 && p.damage < c.avgDamage * 0.7, p.gold) },

  // --- compliments (green) ------------------------------------------------
  { kind: "all", text: "แบกทีม", tone: "good", score: p => qualify(!p.win && kda(p) >= 4, kda(p)) },
  { kind: "all", text: "อมตะ", tone: "good", score: p => qualify(p.deaths === 0, p.kills + p.assists) },
  { kind: "all", text: "ดาเมจโหด", tone: "good", score: (p, c) => qualify(p.damage >= c.avgDamage * 1.6, p.damage) },
  { kind: "all", text: "ล่าหัวโหด", tone: "good", score: p => qualify(p.kills >= 12, p.kills) },
  { kind: "all", text: "ฟาร์มโหด", tone: "good", score: p => qualify(p.csPerMin >= 8, p.csPerMin) },
  { kind: "all", text: "ซัพตัวจริง", tone: "good", score: (p, c) => qualify(isSupport(p) && p.visionScore >= c.avgVision * 1.5, p.visionScore) },
  { kind: "all", text: "ตัวหลัก", tone: "good", score: p => qualify(kda(p) >= 2.5, kda(p)) },
  { kind: "all", text: "หัวเย็น", tone: "good", score: (p, c) => qualify(p.deaths <= Math.max(3, c.avgDeaths * 0.5), -p.deaths) },
  { kind: "all", text: "ช่วยเยอะ", tone: "good", score: p => qualify(p.assists >= 10, p.assists) },
  { kind: "all", text: "เก็บครบ", tone: "good", score: p => qualify(p.csPerMin >= 6.5, p.csPerMin) },
];

/** Only reached by someone who was unremarkable at literally everything. */
const FILLERS = ["ไม่มีอะไรเด่น", "ตัวประกอบ", "มาให้ครบทีม", "NPC ประจำเลน", "ผ่านมาเฉยๆ"];

/** Legendary first, then gold, then green, then red, then filler. */
function badgeRank(t: AssignedTitle): number {
  if (t.legendary) return 0;
  if (t.tone === "neutral") return 4;
  if (t.tone === "good") return t.top ? 1 : 2;
  return 3;
}

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
  const goldCount = (p: TitleCandidate) => titles[p.key].filter(t => t.top && t.tone === "good").length;

  for (const rule of RULES) {
    if (rule.kind === "all") {
      for (const p of players) {
        if (!hasRoom(p) && !rule.legendary) continue;
        if (rule.score(p, ctx) === null) continue;
        titles[p.key].push({ text: rule.text, tone: rule.tone, top: false, legendary: rule.legendary === true });
      }
      continue;
    }

    const isGold = rule.tone === "good" && !rule.legendary;
    let best: TitleCandidate | null = null;
    let bestScore = -Infinity;
    for (const p of players) {
      if (!hasRoom(p)) continue;
      if (isGold && goldCount(p) >= MAX_GOLD) continue;
      const score = rule.score(p, ctx);
      if (score === null) continue;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) titles[best.key].push({ text: rule.text, tone: rule.tone, top: true, legendary: rule.legendary === true });
  }

  // deterministic filler so the same match always reads the same
  let fillerIndex = 0;
  for (const p of players) {
    if (titles[p.key].length > 0) continue;
    titles[p.key].push({ text: FILLERS[fillerIndex % FILLERS.length], tone: "neutral", top: false, legendary: false });
    fillerIndex += 1;
  }

  for (const key of Object.keys(titles)) {
    titles[key].sort((a, b) => badgeRank(a) - badgeRank(b));
    if (titles[key].length > MAX_TITLES) titles[key] = titles[key].slice(0, MAX_TITLES);
  }

  return titles;
}
