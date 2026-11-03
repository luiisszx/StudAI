/**
 * StudAI — Dashboard View (Painel Analítico Moderno)
 */
import { store } from "../store.js";
import { formatDuration, formatDateIso, getTodayIso, escapeHtml } from "../utils.js";
import { calculateStreak, getDailyMissions } from "../gamification.js";

export function renderDashboard() {
  const today = getTodayIso();
  const sessions = store.state.sessions || [];
  const logs = store.state.logs || [];
  const results = store.state.results || [];
  const subjects = store.getSubjects();
  const profile = store.state.profile || {};
  const dailyGoalMinutes = (Number(profile.dailyGoalHours) || 2) * 60;

  // 1. Estatísticas de Hoje
  const todaySessions = sessions.filter(s => s.date === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (Number(s.min) || 0), 0);
  const todayCount = todaySessions.filter(s => s.min > 0).length;
  const hasStudiedToday = todayCount > 0;
  const streak = calculateStreak(sessions);

  // 2. Missões Diárias
  const missions = getDailyMissions(store.state);
  const missionsHtml = missions.map(m => {
    let buttonHtml = "";
    if (m.isClaimed) {
      buttonHtml = `<span class="tag" style="background:rgba(255,255,255,0.06);color:var(--mu);border:none;">✨ Concluída</span>`;
    } else if (m.isDone) {
      buttonHtml = `<button class="btn btn-resgatar" style="padding:6px 14px; font-size:12px;" onclick="window.studai.claimMission('${m.id}', event)">Resgatar +25 XP</button>`;
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

  // 3. Gráfico dos Últimos 7 Dias
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
    const label = `<small style="display:block; font-size:10px; color:var(--mu); margin-top:8px; font-weight:500;">${day.totalMin ? formatDuration(day.totalMin) : ""}</small>`;

    if (!day.totalMin) {
      return `
        <div title="0 min" style="display:flex; flex-direction:column; align-items:center; width:100%;">
          <div style="height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:4px;">
            <div style="height:6px; width:6px; background:rgba(255,255,255,0.06); border-radius:50%;"></div>
          </div>
          <div style="margin-top:4px; font-size:11px; font-weight:600; color:var(--mu);">${day.letter}</div>
          ${label}
        </div>
      `;
    }

    const segments = Object.entries(day.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, mins]) => {
        const color = store.getSubjectColor(cat);
        return `<span style="flex:${mins}; width:100%; background:${color}; border-radius:4px;" title="${escapeHtml(cat)}: ${formatDuration(mins)}"></span>`;
      }).join("");

    const heightPct = Math.max(14, (day.totalMin / maxDayMinutes) * 100);

    return `
      <div title="${formatDuration(day.totalMin)}" style="display:flex; flex-direction:column; align-items:center; width:100%;">
        <div style="height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; width:100%;">
          <div style="height:${heightPct}%; width:8px; display:flex; flex-direction:column; gap:2px; border-radius:4px; overflow:hidden;">
            ${segments}
          </div>
        </div>
        <div style="margin-top:8px; font-size:11px; font-weight:600; color:var(--tx-bright);">${day.letter}</div>
        ${label}
      </div>
    `;
  }).join("");

  // 4. Distribuição do Mês Atual (Radar ou Donut Radial)
  const currentMonthKey = today.slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const monthSessions = sessions.filter(s => (s.date || "").startsWith(currentMonthKey));

  const monthByCat = {};
  monthSessions.forEach(s => {
    const c = s.cat || "Geral";
    monthByCat[c] = (monthByCat[c] || 0) + Number(s.min);
  });
  const totalMonthMins = Object.values(monthByCat).reduce((a, b) => a + b, 0);

  const topMonthSubjects = Object.entries(monthByCat)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);

  let radarHtml = "";

  if (topMonthSubjects.length >= 3) {
    // Teia Poligonal Completa (3+ Matérias)
    const activeSubjects = topMonthSubjects.slice(0, 6);
    const N = activeSubjects.length;
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 95;
    const maxSubjMin = Math.max(1, ...activeSubjects.map(([, m]) => m));

    let webLines = "";
    for (let level = 1; level <= 3; level++) {
      const r = maxRadius * (level / 3);
      let pointsArr = [];
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
        pointsArr.push(`${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`);
      }
      webLines += `<polygon points="${pointsArr.join(" ")}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    }

    let axesHtml = "";
    let labelsHtml = "";
    let dataPoints = [];

    activeSubjects.forEach(([cat, mins], i) => {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const xEdge = centerX + maxRadius * Math.cos(angle);
      const yEdge = centerY + maxRadius * Math.sin(angle);

      axesHtml += `<line x1="${centerX}" y1="${centerY}" x2="${xEdge}" y2="${yEdge}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;

      const dataRadius = maxRadius * (mins / maxSubjMin);
      const dx = centerX + dataRadius * Math.cos(angle);
      const dy = centerY + dataRadius * Math.sin(angle);
      dataPoints.push(`${dx},${dy}`);

      const labelRadius = maxRadius + 24;
      const lx = centerX + labelRadius * Math.cos(angle);
      const ly = centerY + labelRadius * Math.sin(angle);
      const shortCat = cat.length > 12 ? cat.substring(0, 10) + "..." : cat;

      labelsHtml += `<text x="${lx}" y="${ly}" fill="var(--mu)" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeHtml(shortCat)}</text>`;
    });

    const dataPolygon = `<polygon points="${dataPoints.join(" ")}" fill="rgba(45,255,122,0.14)" stroke="var(--g)" stroke-width="2" style="filter:drop-shadow(0 0 6px rgba(45,255,122,0.4))"/>`;
    const dataDots = dataPoints.map(pt => {
      const [px, py] = pt.split(",");
      return `<circle cx="${px}" cy="${py}" r="3.5" fill="#090e0a" stroke="var(--g)" stroke-width="2"/>`;
    }).join("");

    radarHtml = `
      <div style="display:flex; justify-content:center; align-items:center; height:100%; width:100%; padding:10px 0;">
        <svg viewBox="0 0 300 300" style="width:100%; max-width:240px; height:auto; overflow:visible;">
          ${webLines}
          ${axesHtml}
          ${dataPolygon}
          ${dataDots}
          ${labelsHtml}
        </svg>
      </div>
    `;
  } else if (topMonthSubjects.length > 0) {
    // Donut / Progress Breakdown para 1 ou 2 Matérias
    const itemsBreakdownHtml = topMonthSubjects.map(([cat, mins]) => {
      const pct = Math.round((mins / (totalMonthMins || 1)) * 100);
      const color = store.getSubjectColor(cat);
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
            <span><i class="color-dot" style="background:${color}"></i><b>${escapeHtml(cat)}</b></span>
            <span>${formatDuration(mins)} (${pct}%)</span>
          </div>
          <div class="bar" style="height:6px;">
            <i style="width:${pct}%; background:${color}; box-shadow:0 0 6px ${color}"></i>
          </div>
        </div>
      `;
    }).join("");

    radarHtml = `
      <div style="padding:14px; width:100%; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:12px; color:var(--mu); margin-bottom:12px; text-align:center;">
          Distribuição acumulada de <b>${formatDuration(totalMonthMins)}</b> em ${escapeHtml(currentMonthName)}:
        </div>
        ${itemsBreakdownHtml}
        <div class="sub" style="text-align:center; margin-top:8px; font-size:11px;">
          💡 Estude mais uma matéria para desbloquear o Radar Poligonal 3D!
        </div>
      </div>
    `;
  } else {
    radarHtml = `
      <div class="empty" style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%;">
        <div style="font-size:28px; margin-bottom:10px;">⏱️</div>
        <div style="font-size:13px; max-width:220px; line-height:1.5; text-align:center; margin-bottom:14px;">Nenhum estudo registrado neste mês ainda. Comece agora!</div>
        <button class="btn o" style="font-size:12px; padding:6px 14px;" onclick="window.studai.switchTab('tempo')">Iniciar Cronômetro</button>
      </div>
    `;
  }

  // 5. Evolução nos Testes (%)
  const recentResults = results.slice(-12);
  let chartSvgHtml = "";

  if (recentResults.length >= 2) {
    const points = recentResults.map(r => ((r.score || 0) / (r.total || 1)) * 100);
    const coords = points.map((p, i) => ({
      x: (i * 300) / (points.length - 1),
      y: 100 - (p * 0.85) - 5
    }));

    const linePoints = coords.map(c => `${c.x},${c.y}`).join(" ");
    const polygonPoints = `${coords[0].x},100 ${linePoints} ${coords[coords.length - 1].x},100`;

    const circlesHtml = coords.map((c, i) =>
      `<circle cx="${c.x}" cy="${c.y}" r="4" fill="#070b08" stroke="var(--g)" stroke-width="2" title="${Math.round(points[i])}%" />`
    ).join("");

    chartSvgHtml = `
      <div style="padding:10px 0; width:100%;">
        <svg viewBox="0 0 300 100" style="width:100%; height:auto; overflow:visible;">
          <defs>
            <linearGradient id="gradNeon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--g)" stop-opacity="0.35" />
              <stop offset="100%" stop-color="var(--g)" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <polygon fill="url(#gradNeon)" points="${polygonPoints}" />
          <polyline fill="none" stroke="var(--g)" stroke-width="2.5" style="filter:drop-shadow(0 0 6px rgba(45,255,122,0.4))" points="${linePoints}" />
          ${circlesHtml}
        </svg>
      </div>
    `;
  } else {
    chartSvgHtml = `
      <div class="empty" style="padding:24px 10px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span style="font-size:26px; margin-bottom:8px;">🎯</span>
        <p style="font-size:13px; max-width:240px; margin-bottom:14px; line-height:1.5;">Resolva simulados no Quiz para traçar sua evolução de retenção mental!</p>
        <button class="btn o" style="font-size:12px; padding:6px 14px;" onclick="window.studai.switchTab('quiz')">Fazer Primeiro Quiz (+50 XP)</button>
      </div>
    `;
  }

  // 6. StudAI Insights Neurocientíficos
  const weekTotalMins = last7Days.reduce((sum, d) => sum + d.totalMin, 0);
  let insightText = "O cérebro consolida sinapses durante os intervalos e no sono. Abra o timer para iniciar seu ciclo de foco e dopamina!";

  if (weekTotalMins > 0) {
    const hours = (weekTotalMins / 60).toFixed(1).replace(".0", "");
    const weekCats = {};
    last7Days.forEach(d => {
      Object.entries(d.byCat).forEach(([cat, mins]) => {
        weekCats[cat] = (weekCats[cat] || 0) + mins;
      });
    });
    const topSubject = Object.entries(weekCats).sort((a, b) => b[1] - a[1])[0] || ["Geral", 0];

    insightText = `Você alcançou <b>${hours}h</b> de foco nos últimos 7 dias, com destaque em <b style="color:var(--g)">${escapeHtml(topSubject[0])}</b>.<br><br>
    ⚡ <b>Estado de Flow & Neuroplasticidade:</b> seu cérebro está liberando BDNF e fortalecendo as vias sinápticas. Mantenha os blocos curtos e consistentes!`;
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
        ${dailyGoalMinutes > 0 ? `
          <div class="daily-goal-progress" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:11.5px; color:var(--mu);">${Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100))}% da meta</span>
            <div class="bar" style="flex:1; height:6px;">
              <i style="width:${Math.min(100, (todayMinutes / dailyGoalMinutes) * 100).toFixed(1)}%; background:${todayMinutes >= dailyGoalMinutes ? 'var(--g)' : 'var(--yellow)'}; box-shadow: 0 0 8px ${todayMinutes >= dailyGoalMinutes ? 'var(--g)' : 'var(--yellow)'}"></i>
            </div>
            <span style="font-size:11.5px;">${todayMinutes >= dailyGoalMinutes ? '🎉 Meta batida!' : formatDuration(Math.max(0, dailyGoalMinutes - todayMinutes)) + ' restantes'}</span>
          </div>
        ` : ''}
      </div>

      <div class="card">
        <h3>Sequência Diária</h3>
        <div class="big" style="${hasStudiedToday ? "" : "filter:grayscale(1);opacity:.5"}">
          🔥 ${streak}
        </div>
        <div class="sub">${hasStudiedToday ? "dias seguidos mantendo o hábito" : "estude hoje para manter a chama acesa"}</div>
      </div>

      <div class="card">
        <h3>Tópicos Aprendidos</h3>
        <div class="big">${logs.length}</div>
        <div class="sub">tópicos e resumos salvos no seu OS</div>
      </div>
    </div>

    <!-- Últimos 7 Dias & StudAI Insights -->
    <div class="card" style="padding: 24px;">
      <div style="display: flex; flex-wrap: wrap; gap: 30px; align-items: stretch;">
        <div style="flex: 2; min-width: 250px;">
          <h3 style="margin-bottom: 20px;">Últimos 7 dias de estudo</h3>
          <div class="bars" style="height: 120px; align-items: flex-end; display:flex; gap:10px;">${barsHtml}</div>
          <div class="legend" style="margin-top: 20px; display:flex; flex-wrap:wrap; gap:12px;">
            ${subjects.map(s => `<span style="font-size:11.5px;"><i class="color-dot" style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`).join("")}
          </div>
        </div>
        
        <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.02); border-left: 3px solid var(--g); border-radius: 0 12px 12px 0; padding: 20px; position: relative; overflow: hidden;">
          <div style="font-size: 11px; color: var(--g); font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i class="color-dot" style="background: var(--g); box-shadow: 0 0 8px var(--g); width: 6px; height: 6px;"></i> StudAI Insights
          </div>
          <p style="font-size: 13.5px; color: var(--tx); line-height: 1.6; margin: 0;">
            ${insightText}
          </p>
        </div>
      </div>
    </div>

    <div class="grid" style="align-items: stretch;">
      <!-- CARD 1: Radar de Domínio / Distribuição -->
      <div class="card" style="display:flex; flex-direction:column; min-height:340px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0;">Radar de Domínio · <span style="text-transform:capitalize">${escapeHtml(currentMonthName)}</span></h3>
          <span class="tag" style="margin:0; font-size:11px;">${topMonthSubjects.length} ${topMonthSubjects.length === 1 ? 'matéria' : 'matérias'}</span>
        </div>
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          ${radarHtml}
        </div>
      </div>
      
      <!-- CARD 2: Evolução nos Testes -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; min-height:340px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Evolução nos Quizzes (%)</h3>
            <span class="tag" style="background:rgba(45,255,122,0.08); color:var(--g); border-color:rgba(45,255,122,0.25); margin:0;">
              ${results.length} ${results.length === 1 ? 'simulado' : 'simulados'}
            </span>
          </div>
          ${chartSvgHtml}
        </div>

        <div style="margin-top:auto; padding:12px 14px; background:rgba(0,0,0,0.25); border:1px solid var(--line); border-left:3px solid var(--g); border-radius:10px; display:flex; gap:10px; align-items:center;">
          <div style="font-size:16px;">💡</div>
          <div style="font-size:12px; color:var(--mu); line-height:1.45;">
            <b style="color:var(--tx-bright); display:block; margin-bottom:2px;">Conselho de Retenção</b>
            Pratique testes ativos logo após aprender um conceito para dobrar a retenção a longo prazo!
          </div>
        </div>
      </div>
    </div>
  `;
}
