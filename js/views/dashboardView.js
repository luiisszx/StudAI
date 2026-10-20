/**
 * StudAI — Dashboard View (Painel)
 */
import { store } from "../store.js";
import { formatDuration, formatDateIso, getTodayIso, escapeHtml, sortAlpha } from "../utils.js";
import { calculateStreak, getDailyMissions } from "../gamification.js";
import { sounds } from "../audio.js";

export function renderDashboard() {
  const today = getTodayIso();
  const sessions = store.state.sessions || [];
  const logs = store.state.logs || [];
  const results = store.state.results || [];
  const subjects = store.getSubjects();

  // 1. Today's statistics
  const todaySessions = sessions.filter(s => s.date === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (Number(s.min) || 0), 0);
  const todayCount = todaySessions.filter(s => s.min > 0).length;
  const hasStudiedToday = todayCount > 0;
  const streak = calculateStreak(sessions);

  // 2. Daily Missions Component
  const missions = getDailyMissions(store.state);
  const missionsHtml = missions.map(m => {
    let buttonHtml = "";
    if (m.isClaimed) {
      buttonHtml = `<span class="tag" style="background:rgba(255,255,255,0.06);color:var(--mu);border:none;">✨ Concluída</span>`;
    } else if (m.isDone) {
      buttonHtml = `<button class="btn" style="padding:6px 14px; font-size:12px;" onclick="window.studai.claimMission('${m.id}')">Resgatar +25 XP</button>`;
    } else {
      buttonHtml = `<span class="sub" style="font-size:11px; text-transform:uppercase; letter-spacing:1px">Pendente</span>`;
    }

    return `
      <div class="item" style="align-items:center">
        <div class="t">
          <b>${escapeHtml(m.title)}</b>
          <div class="sub" style="margin-top:3px">${escapeHtml(m.desc)}</div>
        </div>
        <div>${buttonHtml}</div>
      </div>
    `;
  }).join("");

  // 3. Last 7 Days Stacked Bar Chart
  const dayLetters = ["D", "S", "T", "Q", "Q", "S", "S"];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const dateKey = formatDateIso(d);

    const byCat = {};
    sessions.filter(s => s.date === dateKey).forEach(s => {
      const cat = s.cat || "Geral";
      byCat[cat] = (byCat[cat] || 0) + Number(s.min);
    });

    const totalMin = Object.values(byCat).reduce((a, b) => a + b, 0);
    return {
      dateKey,
      letter: dayLetters[d.getDay()],
      totalMin,
      byCat
    };
  });

  const maxDayMinutes = Math.max(1, ...last7Days.map(d => d.totalMin));
  const barsHtml = last7Days.map(day => {
    const label = `<small style="display:block;font-size:10px;color:var(--mu);margin-top:4px">${day.totalMin ? formatDuration(day.totalMin) : "—"}</small>`;

    if (!day.totalMin) {
      return `
        <div title="0 min">
          <div class="stacked-bar" style="height:4px;background:rgba(255,255,255,0.06)"></div>
          ${day.letter}
          ${label}
        </div>
      `;
    }

    const segments = Object.entries(day.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, mins]) => {
        const pct = (mins / day.totalMin) * 100;
        const color = store.getSubjectColor(cat);
        return `<span style="width:${pct}%;background:${color};box-shadow:0 0 6px ${color}66" title="${escapeHtml(cat)}: ${formatDuration(mins)}"></span>`;
      }).join("");

    const heightPct = Math.max(6, (day.totalMin / maxDayMinutes) * 100);

    return `
      <div title="${formatDuration(day.totalMin)}">
        <div class="stacked-bar" style="height:${heightPct}%">${segments}</div>
        ${day.letter}
        ${label}
      </div>
    `;
  }).join("");

  // 4. Current Month Time Breakdown
  const currentMonthKey = today.slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const monthSessions = sessions.filter(s => (s.date || "").startsWith(currentMonthKey));

  const monthByCat = {};
  monthSessions.forEach(s => {
    const c = s.cat || "Geral";
    monthByCat[c] = (monthByCat[c] || 0) + Number(s.min);
  });
  const maxMonthSubjectMin = Math.max(1, ...Object.values(monthByCat));

  const dayOfWeekNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const byCatDay = {};
  monthSessions.forEach(s => {
    const c = s.cat || "Geral";
    if (!byCatDay[c]) byCatDay[c] = [0, 0, 0, 0, 0, 0, 0];
    const wd = new Date(s.date + "T12:00:00").getDay();
    byCatDay[c][wd] += Number(s.min);
  });

  const monthSubjectsHtml = Object.entries(monthByCat)
    .filter(([, m]) => m > 0)
    .sort((a, b) => sortAlpha(a[0], b[0]))
    .map(([cat, mins]) => {
      const color = store.getSubjectColor(cat);
      const days = byCatDay[cat] || [];
      const segments = days.map((dm, di) => {
        if (dm <= 0) return "";
        return `<span style="flex:${dm} 1 0;min-width:0;display:block;background:${color};color:#fff;font-size:10px;font-weight:700;line-height:20px;text-align:center;overflow:hidden;white-space:nowrap;border-radius:4px" title="${dayOfWeekNames[di]}: ${formatDuration(dm)}">${dayOfWeekNames[di]}</span>`;
      }).join("");

      const widthPct = Math.min(100, (mins / maxMonthSubjectMin) * 100);

      return `
        <div class="hb">
          <span style="display:flex;align-items:center;gap:6px">
            <i class="color-dot" style="background:${color}"></i>
            ${escapeHtml(cat)}
          </span>
          <div>
            <div style="display:flex;gap:2px;height:20px;width:${widthPct}%">
              ${segments}
            </div>
          </div>
          <span>${formatDuration(mins)}</span>
        </div>
      `;
    }).join("") || `<div class="empty">Nenhuma sessão registrada neste mês</div>`;

  // 5. Quiz Performance Evolution Chart (SVG Polyline)
  const recentResults = results.slice(-12);
  const points = recentResults.map(r => ((r.score || 0) / (r.total || 1)) * 100);
  let chartSvgHtml = `<div class="empty">Faça 2 ou mais testes para acompanhar sua evolução</div>`;

  if (points.length > 1) {
    const svgPoints = points
      .map((p, i) => `${(i * 300) / (points.length - 1)},${95 - p * 0.9}`)
      .join(" ");

    chartSvgHtml = `
      <div style="padding:10px 0">
        <svg viewBox="0 0 300 100" style="width:100%;height:auto;overflow:visible">
          <polyline fill="none" stroke="#2dff7a" stroke-width="2.5" style="filter:drop-shadow(0 0 6px #2dff7a)" points="${svgPoints}"/>
        </svg>
      </div>
    `;
  }

  return `
    <div class="card">
      <h3>Missões Diárias</h3>
      ${missionsHtml}
    </div>

    <div class="grid">
      <div class="card">
        <h3>Hoje</h3>
        <div class="big">${formatDuration(todayMinutes)}</div>
        <div class="sub">${todayCount} ${todayCount === 1 ? "sessão" : "sessões"} realizadas hoje</div>
      </div>
      <div class="card">
        <h3>Sequência</h3>
        <div class="big" style="${hasStudiedToday ? "" : "filter:grayscale(1);opacity:.5"}">
          🔥 ${streak}
        </div>
        <div class="sub">${hasStudiedToday ? "dias seguidos estudando" : "estude hoje para manter a sequência acesa"}</div>
      </div>
      <div class="card">
        <h3>Tópicos</h3>
        <div class="big">${logs.length}</div>
        <div class="sub">tópicos aprendidos no total</div>
      </div>
    </div>

    <div class="card">
      <h3>Últimos 7 dias (por matéria)</h3>
      <div class="bars" style="height:175px">${barsHtml}</div>
      <div class="legend">
        ${subjects.map(s => `<span><i class="color-dot" style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`).join("")}
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Tempo por matéria · ${escapeHtml(currentMonthName)}</h3>
        ${monthSubjectsHtml}
        <div class="sub" style="margin-top:10px">Cada bloco representa os dias da semana estudados no mês atual.</div>
      </div>
      <div class="card">
        <h3>Evolução nos testes (%)</h3>
        ${chartSvgHtml}
      </div>
    </div>
  `;
}
