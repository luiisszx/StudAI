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
let lastKnownXP = null;

/**
 * Calculates current XP points based on all activities.
 * @param {object} state 
 * @returns {number}
 */
export function calculateXP(state) {
  try {
    // Garante que tudo é tratado como array vazio se estiver corrompido
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const logs = Array.isArray(state.logs) ? state.logs : [];
    const goals = Array.isArray(state.goals) ? state.goals : [];
    const results = Array.isArray(state.results) ? state.results : [];
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const missions = Array.isArray(state.claimed_missions) ? state.claimed_missions : [];

    const minXP = sessions.reduce((sum, s) => {
      const val = Number(s.min);
      return sum + (isNaN(val) ? 0 : val);
    }, 0) * 2;

    const topicosXP = logs.length * 20;
    const metasXP = goals.filter(g => g && g.done).length * 50;

    const testesXP = results.reduce((sum, r) => {
      if (!r) return sum;
      const score = Number(r.score);
      const total = Number(r.total);
      if (isNaN(score) || isNaN(total)) return sum;

      const base = score * 10;
      const perfectBonus = (score === total && total > 0) ? 50 : 0;
      return sum + base + perfectBonus;
    }, 0);

    const ofensivaXP = calculateStreak(sessions) * 15;
    const tarefasXP = tasks.filter(t => t && t.status === "done").length * 5;
    const missoesXP = missions.length * 25;

    const total = Math.round(minXP + topicosXP + metasXP + testesXP + ofensivaXP + tarefasXP + missoesXP);
    return isNaN(total) ? 0 : total;

  } catch (error) {
    console.error("Erro fatal ao calcular XP:", error);
    return 0; // Se tudo falhar, devolve 0 e impede que a app fique branca/sem barra
  }
}
/**
 * Calculates user level and rank title.
 * @param {number} totalXp 
 * @returns {{ level: number, rankTitle: string, progressPct: number, currentLevelBaseXp: number, nextLevelBaseXp: number }}
 */
export function calculateLevelData(totalXp) {
  try {
    const safeXp = (isNaN(totalXp) || totalXp < 0) ? 0 : totalXp;
    const level = Math.floor(Math.sqrt(safeXp / 50)) + 1;
    const prevLevelBase = 50 * (level - 1) ** 2;
    const nextLevelBase = 50 * level ** 2;

    let progressPct = Math.min(100, Math.max(0, ((safeXp - prevLevelBase) / (nextLevelBase - prevLevelBase)) * 100));
    if (isNaN(progressPct)) progressPct = 0;

    let rankTitle = RANKS[0].title;
    for (const r of RANKS) {
      if (level >= r.lvl) rankTitle = r.title;
    }

    if (lastKnownLevel !== null && lastKnownXP !== null) {
      const xpGanhosAgora = safeXp - lastKnownXP;

      if (level > lastKnownLevel && xpGanhosAgora > 0 && xpGanhosAgora < 300) {
      if (typeof sounds !== 'undefined' && sounds.playLevelUp) {
        sounds.playLevelUp();
      }
      animarSubidaNivel(level);
      }
    }
    lastKnownLevel = level;
    lastKnownXP = safeXp;
    
    return { level, rankTitle, progressPct, currentLevelBaseXp: prevLevelBase, nextLevelBaseXp: nextLevelBase };
  } catch (err) {
    console.error("Erro fatal ao calcular Nível:", err);
    return { level: 1, rankTitle: RANKS[0].title, progressPct: 0, currentLevelBaseXp: 0, nextLevelBaseXp: 50 };
  }
}
/**
 * Calculates current daily consecutive study streak.
 * @param {Array} sessions 
 * @returns {number}
 */
export function calculateStreak(sessions = []) {
  // Garante que é uma lista válida e ignora sessões corrompidas sem data
  if (!Array.isArray(sessions)) return 0;

  const dates = new Set(
    sessions.filter(s => s && s.date).map(s => s.date)
  );

  let streak = 0;
  const checkDate = new Date();

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
/**
 * Exibe o texto de XP flutuante na posição em que o usuário clicou/interagiu.
 * Se não passar x e y, ele aparece no centro inferior da tela.
 */
export function animarGanhoXP(quantidade, x = window.innerWidth / 2, y = window.innerHeight - 100) {
  const xpEl = document.createElement('div');
  xpEl.classList.add('xp-float');
  xpEl.innerText = `+${quantidade} XP`;

  // Posiciona o elemento
  xpEl.style.left = `${x}px`;
  xpEl.style.top = `${y}px`;

  document.body.appendChild(xpEl);

  // Remove do DOM após 1.5 segundos (tempo da animação CSS)
  setTimeout(() => {
    xpEl.remove();
  }, 1500);
}

/**
 * Exibe um banner central de comemoração de subida de nível.
 */
export function animarSubidaNivel(novoNivel) {
  const lvlEl = document.createElement('div');
  lvlEl.classList.add('level-up-overlay');

  lvlEl.innerHTML = `
      <h2>🎉 Level Up! 🎉</h2>
      <p>Você alcançou o Nível ${novoNivel}</p>
  `;

  document.body.appendChild(lvlEl);

  // Remove do DOM após 4 segundos
  setTimeout(() => {
    lvlEl.remove();
  }, 4000);
}