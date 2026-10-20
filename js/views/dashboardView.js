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

  // 3. Last 7 Days Stacked Bar Chart (Ultra-Minimalist)
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
            <div style="height:6px; width:6px; background:rgba(255,255,255,0.05); border-radius:50%;"></div>
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

    const heightPct = Math.max(12, (day.totalMin / maxDayMinutes) * 100);

    return `
      <div title="${formatDuration(day.totalMin)}" style="display:flex; flex-direction:column; align-items:center; width:100%;">
        <div style="height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; width:100%;">
          <div style="height:${heightPct}%; width:6px; display:flex; flex-direction:column; gap:3px;">
            ${segments}
          </div>
        </div>
        <div style="margin-top:8px; font-size:11px; font-weight:600; color:var(--tx);">${day.letter}</div>
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
      .map((p, i) => `${(i * 300) / (points.length - 1)},${95 - (p * 0.9)}`)
      .join(" ");

    chartSvgHtml = `
      <div style="padding:10px 0">
        <svg viewBox="0 0 300 100" style="width:100%;height:auto;overflow:visible">
          <polyline fill="none" stroke="#2dff7a" stroke-width="2.5" style="filter:drop-shadow(0 0 6px #2dff7a)" points="${svgPoints}"/>
        </svg>
      </div>
    `;
  }

  // --- NOVO: Lógica do StudAI Insights (Expansão Científica Diária) ---
  const weekTotalMins = last7Days.reduce((sum, d) => sum + d.totalMin, 0);
  let insightText = "O cérebro precisa de pausas para consolidar a memória. Quando quiser iniciar o ciclo de dopamina, abra o timer.";
  let insightIcon = "🔋";

  if (weekTotalMins > 0) {
    const weekCats = {};
    last7Days.forEach(d => {
      Object.entries(d.byCat).forEach(([cat, mins]) => {
        weekCats[cat] = (weekCats[cat] || 0) + mins;
      });
    });
    const topSubject = Object.entries(weekCats).sort((a, b) => b[1] - a[1])[0];
    const hours = (weekTotalMins / 60).toFixed(1).replace(".0", "");

    // Usa o dia atual do ano/mês para garantir a rotação perfeita
    const daySeed = new Date().getDate();
    let insightOptions = [];

    // Nível 4: +14h (Deep Work & Hipertrofia Cognitiva)
    if (weekTotalMins >= 840) {
      insightOptions = [
        { icon: "⚡", text: "Em estado absoluto de <b>Hiperfoco (Deep Work)</b>. Sua retenção atingiu o pico biológico possível." },
        { icon: "👑", text: "<b>Hipertrofia Cognitiva</b>. Esse volume constrói uma arquitetura mental impenetrável para distrações." },
        { icon: "🌌", text: "Nível <b>Mestre Neural</b>. Seu cérebro opera como um supercomputador, processando blocos densos." },
        { icon: "🧬", text: "Liberação massiva de <b>BDNF</b> (fertilizante cerebral). Novas sinapses estão a ser cravadas a ferro e fogo." },
        { icon: "💎", text: "A <b>mielinização</b> das suas vias neurais está extrema, tornando o acesso à informação quase instantâneo." },
        { icon: "🪐", text: "Seu <b>Default Mode Network</b> foi otimizado. Até em repouso o seu cérebro resolve problemas complexos." },
        { icon: "🔮", text: "A <b>Poda Sináptica</b> está avançada: o que não importa é descartado, o que estuda vira cristal na sua memória." }
      ];
      // Nível 3: +7h (Estado de Flow & Imersão)
    } else if (weekTotalMins >= 420) {
      insightOptions = [
        { icon: "🚀", text: "No <b>Estado de Flow</b>. O desafio ideal está a gerar um ciclo contínuo de recompensa dopaminérgica." },
        { icon: "🌊", text: "Ondas <b>Alfa e Teta</b>. Seu cérebro opera na frequência exata para imersão total e distorção temporal." },
        { icon: "🎯", text: "Alta performance! O balanço de noradrenalina e dopamina está perfeito para foco sem estresse." },
        { icon: "🔬", text: "A <b>Acetilcolina</b> marcou perfeitamente os neurônios que precisam de ser fortalecidos durante o seu sono." },
        { icon: "⛵", text: "<b>Eficiência Sináptica</b>. Você superou a barreira da fadiga mental e entrou em ritmo de cruzeiro intelectual." },
        { icon: "🛡️", text: "Seu <b>córtex pré-frontal</b> está no comando, suprimindo distrações periféricas de forma automática." },
        { icon: "⏳", text: "Seu <b>Ritmo Circadiano</b> está aliado aos estudos. O relógio biológico já antecipa o estado de foco." }
      ];
      // Nível 2: +2.5h (Neuroplasticidade & Manutenção)
    } else if (weekTotalMins >= 150) {
      insightOptions = [
        { icon: "🧠", text: "Em <b>Neuroplasticidade Ativa</b>. Consistência suficiente para vencer a Curva de Esquecimento de Ebbinghaus." },
        { icon: "📈", text: "O <b>Ciclo de Dopamina</b> estabilizou. O cérebro já reconhece o seu estudo como uma recompensa." },
        { icon: "📦", text: "Fase de <b>Codificação Forte</b>. A informação está sendo empacotada perfeitamente para o hipocampo." },
        { icon: "🌱", text: "Sua <b>Neurogênese</b> (criação de neurônios) recebe um estímulo elétrico com esse volume de novidade." },
        { icon: "♻️", text: "A <b>repetição espaçada</b> mostra poder. A revisão mental já exige menos esforço metabólico." },
        { icon: "🔥", text: "A <b>Via Mesolímbica</b> está ativada, convertendo o dever de estudar num desejo intrínseco." },
        { icon: "🧩", text: "Conexões ramificadas. As matérias começam a interligar-se no cérebro gerando *insights* profundos." }
      ];
      // Nível 1: < 2.5h (Adaptação & Fricção Inicial)
    } else {
      insightOptions = [
        { icon: "🔋", text: "Fase de <b>Construção de Hábito</b>. O esforço consciente inicial é vital para criar novas vias neurais." },
        { icon: "🛠️", text: "Vencendo a <b>Fricção Cognitiva</b>. Seu cérebro está a adaptar-se; a consistência vale mais que o volume." },
        { icon: "🧗", text: "A resistência é apenas o cérebro a poupar energia (homeostase). Romper isso é o primeiro grande passo." },
        { icon: "🌉", text: "A cada minuto, uma nova <b>ponte sináptica</b> é iniciada. Mantenha a frequência para que não se desfaça." },
        { icon: "🧱", text: "<b>Ancoragem Neural</b>. Pequenos blocos de foco consistentes valem mais que uma maratona exaustiva isolada." },
        { icon: "🏆", text: "Micro-hábitos ativos. A liberação de dopamina virá com pequenas vitórias diárias. Abra o timer!" },
        { icon: "⚙️", text: "A ativar o <b>Córtex Pré-Frontal</b>. O começo exige disciplina, logo a automação fará o trabalho pesado." }
      ];
    }

    // Escolhe dinamicamente: divide o dia pelas opções disponíveis
    const selection = insightOptions[daySeed % insightOptions.length];
    insightIcon = selection.icon;

    insightText = `Você alcançou <b>${hours}h</b> de foco nos últimos 7 dias, destacando-se em <b style="color:var(--g)">${escapeHtml(topSubject[0])}</b>.<br><br>${selection.text}`;
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

    <!-- NOVO: Últimos 7 Dias com StudAI Insights lado a lado -->
    <div class="card" style="padding: 24px;">
      <div style="display: flex; flex-wrap: wrap; gap: 30px; align-items: stretch;">
        <div style="flex: 2; min-width: 250px;">
          <h3 style="margin-bottom: 20px;">Últimos 7 dias</h3>
          <div class="bars" style="height: 120px; align-items: flex-end;">${barsHtml}</div>
          <div class="legend" style="margin-top: 20px; justify-content: flex-start; gap: 12px;">
            ${subjects.map(s => `<span style="font-size:11px;"><i class="color-dot" style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`).join("")}
          </div>
        </div>
        
        <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.02); border-left: 2px solid var(--g); border-radius: 0 12px 12px 0; padding: 20px; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -15px; right: -10px; font-size: 90px; opacity: 0.03; user-select: none;">🧠</div>
          <div style="font-size: 11px; color: var(--g); font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i class="color-dot" style="background: var(--g); box-shadow: 0 0 8px var(--g); width: 6px; height: 6px;"></i> StudAI Insights
          </div>
          <p style="font-size: 13.5px; color: var(--tx); line-height: 1.6; margin: 0; position: relative; z-index: 1;">
            ${insightText}
          </p>
        </div>
      </div>
    </div>

<div class="grid">
      <div class="card">
        <details>
          <summary style="cursor:pointer; outline:none; font-size:18px; font-weight:700; color:#fff; list-style:none; display:flex; justify-content:space-between; align-items:center; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
            <span>Tempo por matéria · ${escapeHtml(currentMonthName)}</span>
            <span style="font-size:12px; color:var(--g); font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">Ver detalhes ▾</span>
          </summary>
          
          <!-- Conteúdo Oculto -->
          <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.05);">
            ${monthSubjectsHtml}
            <div class="sub" style="margin-top:10px; font-size:11px;">Cada bloco representa os dias da semana estudados no mês atual.</div>
          </div>
        </details>
      </div>
      
      <div class="card">
        <h3>Evolução nos testes (%)</h3>
        ${chartSvgHtml}
      </div>
    </div>
  `;
}