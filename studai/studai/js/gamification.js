/**
 * StudAI — Gamification & Progression System (Clean Code)
 */
import { getTodayIso, formatDateIso } from "./utils.js";
import { sounds } from "./audio.js";

export const RANKS = [
  { lvl: 1, title: "🌱 Iniciante" },
  { lvl: 5, title: "📖 Aprendiz" },
  { lvl: 10, title: "💡 Estudioso" },
  { lvl: 20, title: "🔥 Focado" },
  { lvl: 35, title: "🧠 Veterano" },
  { lvl: 50, title: "🎓 Mestre" },
  { lvl: 75, title: "👑 Grão-Mestre" },
  { lvl: 100, title: "🌟 Lenda" }
];

let lastKnownLevel = null;

/**
 * Calculates current XP points based on all activities.
 * @param {object} state 
 * @returns {number}
 */
export function calculateXP(state) {
  const minXP = (state.sessions || []).reduce((sum, s) => sum + (Number(s.min) || 0), 0) * 2;
  const topicosXP = (state.logs || []).length * 20;
  const metasXP = (state.goals || []).filter(g => g.done).length * 50;
  const testesXP = (state.results || []).reduce((sum, r) => {
    const base = (r.score || 0) * 10;
    const perfectBonus = (r.score === r.total && r.total > 0) ? 50 : 0;
    return sum + base + perfectBonus;
  }, 0);
  const ofensivaXP = calculateStreak(state.sessions) * 15;
  const tarefasXP = (state.tasks || []).filter(t => t.status === "done").length * 5;
  const missoesXP = (state.claimed_missions || []).length * 25;

  return Math.round(minXP + topicosXP + metasXP + testesXP + ofensivaXP + tarefasXP + missoesXP);
}

/**
 * Calculates user level and rank title.
 * @param {number} totalXp 
 * @returns {{ level: number, rankTitle: string, progressPct: number, currentLevelBaseXp: number, nextLevelBaseXp: number }}
 */
export function calculateLevelData(totalXp) {
  const level = Math.floor(Math.sqrt(totalXp / 50)) + 1;
  const prevLevelBase = 50 * (level - 1) ** 2;
  const nextLevelBase = 50 * level ** 2;
  const progressPct = Math.min(100, Math.max(0, ((totalXp - prevLevelBase) / (nextLevelBase - prevLevelBase)) * 100));

  let rankTitle = RANKS[0].title;
  for (const r of RANKS) {
    if (level >= r.lvl) rankTitle = r.title;
  }

  // Play celebratory sound if level increased
  if (lastKnownLevel !== null && level > lastKnownLevel) {
    sounds.playLevelUp();
  }
  lastKnownLevel = level;

  return {
    level,
    rankTitle,
    progressPct,
    currentLevelBaseXp: prevLevelBase,
    nextLevelBaseXp: nextLevelBase
  };
}

/**
 * Calculates current daily consecutive study streak.
 * @param {Array} sessions 
 * @returns {number}
 */
export function calculateStreak(sessions = []) {
  const dates = new Set(sessions.map(s => s.date));
  let streak = 0;
  const checkDate = new Date();

  // If haven't studied today yet, check starting from yesterday
  if (!dates.has(formatDateIso(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (dates.has(formatDateIso(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Evaluates daily missions for today.
 * @param {object} state 
 * @returns {Array<{ id: string, title: string, desc: string, isDone: boolean, isClaimed: boolean }>}
 */
export function getDailyMissions(state) {
  const today = getTodayIso();
  const todayMinutes = (state.sessions || [])
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (Number(s.min) || 0), 0);

  const taskDoneToday = (state.tasks || []).some(t => t.status === "done" && t.doneDate === today);
  const quizDoneToday = (state.results || []).some(r => r.date === today);

  const claimedMissions = state.claimed_missions || [];

  return [
    {
      id: "m1",
      title: "Foco Extremo",
      desc: `Estudar 45 minutos hoje (${Math.min(45, Math.round(todayMinutes))}/45)`,
      isDone: todayMinutes >= 45,
      isClaimed: claimedMissions.includes(`${today}_m1`)
    },
    {
      id: "m2",
      title: "Mão na Massa",
      desc: "Concluir 1 tarefa no Kanban hoje",
      isDone: taskDoneToday,
      isClaimed: claimedMissions.includes(`${today}_m2`)
    },
    {
      id: "m3",
      title: "Mente Afiada",
      desc: "Fazer pelo menos 1 teste ou quiz hoje",
      isDone: quizDoneToday,
      isClaimed: claimedMissions.includes(`${today}_m3`)
    }
  ];
}
