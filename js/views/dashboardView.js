/**
 * StudAI — Dashboard View (Painel)
 */
import { store } from "../store.js";
import { formatDuration, formatDateIso, getTodayIso, escapeHtml, sortAlpha } from "../utils.js";
import { calculateStreak, getDailyMissions } from "../gamification.js";
import { sounds } from "../audio.js";
import { animarGanhoXP } from '../gamification.js';

export function renderDashboard() {
  const today = getTodayIso();
  const sessions = store.state.sessions || [];
  const logs = store.state.logs || [];
  const results = store.state.results || [];
  const subjects = store.getSubjects();
  const profile = store.state.profile || {};
  const dailyGoalMinutes = (Number(profile.dailyGoalHours) || 2) * 60;

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
      buttonHtml = `<button class="btn btn-resgatar" style="padding:6px 14px; font-size:12px;" onclick="window.studai.claimMission('${m.id}')">Resgatar +25 XP</button>`;
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

  // 4. Current Month Time Breakdown (Usado para os dados do Radar)
  const currentMonthKey = today.slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const monthSessions = sessions.filter(s => (s.date || "").startsWith(currentMonthKey));

  const monthByCat = {};
  monthSessions.forEach(s => {
    const c = s.cat || "Geral";
    monthByCat[c] = (monthByCat[c] || 0) + Number(s.min);
  });
  const maxMonthSubjectMin = Math.max(1, ...Object.values(monthByCat));

  // --- Radar de Domínio (Gráfico de Teia) ---
  const topMonthSubjects = Object.entries(monthByCat)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // Pega no máximo as 6 matérias mais estudadas para não poluir

  let radarHtml = "";

  if (topMonthSubjects.length >= 3) {
    const N = topMonthSubjects.length;
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 100;

    // 1. Fundo da Teia (3 níveis de anéis)
    let webLines = "";
    for (let level = 1; level <= 3; level++) {
      const r = maxRadius * (level / 3);
      let points = [];
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI * 2 * i) / N - Math.PI / 2; // -PI/2 para o eixo iniciar no topo
        points.push(`${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`);
      }
      webLines += `<polygon points="${points.join(" ")}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    }

    // 2. Eixos, Dados e Rótulos
    let axesHtml = "";
    let labelsHtml = "";
    let dataPoints = [];

    topMonthSubjects.forEach(([cat, mins], i) => {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const xEdge = centerX + maxRadius * Math.cos(angle);
      const yEdge = centerY + maxRadius * Math.sin(angle);

      // Linha do eixo
      axesHtml += `<line x1="${centerX}" y1="${centerY}" x2="${xEdge}" y2="${yEdge}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;

      // Ponto de dado
      const dataRadius = maxRadius * (mins / maxMonthSubjectMin);
      const dx = centerX + dataRadius * Math.cos(angle);
      const dy = centerY + dataRadius * Math.sin(angle);
      dataPoints.push(`${dx},${dy}`);

      // Rótulo da matéria (ligeiramente fora do raio máximo)
      const labelRadius = maxRadius + 22;
      const lx = centerX + labelRadius * Math.cos(angle);
      const ly = centerY + labelRadius * Math.sin(angle);
      const shortCat = cat.length > 12 ? cat.substring(0, 10) + "..." : cat; // Trunca nomes gigantes

      labelsHtml += `<text x="${lx}" y="${ly}" fill="var(--mu)" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="middle" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${escapeHtml(shortCat)}</text>`;
    });

    // Polígono de Dados com preenchimento translúcido e borda neon
    const dataPolygon = `<polygon points="${dataPoints.join(" ")}" fill="rgba(45,255,122,0.12)" stroke="var(--g)" stroke-width="2" style="filter:drop-shadow(0 0 6px rgba(45,255,122,0.4))"/>`;

    // Pontos (bolinhas) nos vértices
    const dataDots = dataPoints.map(pt => {
      const [px, py] = pt.split(",");
      return `<circle cx="${px}" cy="${py}" r="3" fill="#131814" stroke="var(--g)" stroke-width="1.5"/>`;
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
  } else {
    // Fallback elegante caso tenha menos de 3 matérias
    radarHtml = `
      <div class="empty" style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; opacity:0.7;">
        <div style="font-size:24px; margin-bottom:12px; filter:grayscale(1); opacity:0.5;">🕸️</div>
        <div style="font-size:12px; max-width:180px; line-height:1.5;">O Radar de Domínio requer estudo em pelo menos <b>3 matérias diferentes</b> neste mês para cruzar os dados.</div>
      </div>
    `;
  }

  // 5. Quiz Performance Evolution Chart (SVG Area Chart Premium)
  const recentResults = results.slice(-12);
  let points = recentResults.map(r => ((r.score || 0) / (r.total || 1)) * 100);

  let isPlaceholder = false;
  // Se não houver testes suficientes, geramos dados falsos de demonstração
  if (points.length < 2) {
    points = [30, 45, 40, 65, 55, 80, 75, 95];
    isPlaceholder = true;
  }

  // Calcula as coordenadas do gráfico
  const coords = points.map((p, i) => ({
    x: (i * 300) / (points.length - 1),
    y: 100 - (p * 0.9)
  }));

  const linePoints = coords.map(c => `${c.x},${c.y}`).join(" ");
  // Pontos do polígono para fechar a área embaixo da linha
  const polygonPoints = `${coords[0].x},100 ${linePoints} ${coords[coords.length - 1].x},100`;

  // Bolinhas em cada ponto de dado
  const circlesHtml = coords.map(c =>
    `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="#131814" stroke="var(--g)" stroke-width="2" />`
  ).join("");

  const chartSvgHtml = `
    <div style="padding:10px 0; width:100%; position:relative;">
      
      <!-- Overlay se for gráfico de exemplo -->
      ${isPlaceholder ? `
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); backdrop-filter:blur(2px); z-index:10; border-radius:8px; flex-direction:column; gap:8px;">
          <span style="font-size:12px; font-weight:700; color:var(--tx); text-transform:uppercase; letter-spacing:1px;">Gráfico de Demonstração</span>
          <button class="btn o" style="font-size:11px; padding:6px 12px;" onclick="window.studai.switchTab('quiz')">Fazer Testes</button>
        </div>
      ` : ""}
      
      <!-- O Gráfico SVG -->
      <svg viewBox="0 0 300 100" style="width:100%; height:auto; overflow:visible; ${isPlaceholder ? 'opacity:0.3;' : ''}">
        <defs>
          <linearGradient id="gradNeon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--g)" stop-opacity="0.4" />
            <stop offset="100%" stop-color="var(--g)" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        
        <!-- Preenchimento Colorido (Área) -->
        <polygon fill="url(#gradNeon)" points="${polygonPoints}" />
        
        <!-- Linha Verde -->
        <polyline fill="none" stroke="var(--g)" stroke-width="2.5" style="filter:drop-shadow(0 0 4px rgba(45,255,122,0.4))" points="${linePoints}" />
        
        <!-- Bolinhas -->
        ${circlesHtml}
      </svg>
    </div>
  `;

  // --- Lógica do StudAI Insights (Expansão Científica Diária) ---
  const weekTotalMins = last7Days.reduce((sum, d) => sum + d.totalMin, 0);
  let insightText = "O cérebro precisa de pausas para consolidar a memória. Quando quiser iniciar o ciclo de dopamina, abra o timer.";

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
        ${dailyGoalMinutes > 0 ? `
          <div class="daily-goal-progress" style="margin-top:10px;">
            <span>${Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100))}% da meta</span>
            <div class="bar" style="flex:1; height:5px;">
              <i style="width:${Math.min(100, (todayMinutes / dailyGoalMinutes) * 100).toFixed(1)}%; background:${todayMinutes >= dailyGoalMinutes ? 'var(--g)' : 'var(--yellow)'}; box-shadow: 0 0 6px ${todayMinutes >= dailyGoalMinutes ? 'var(--g)' : 'var(--yellow)'}"></i>
            </div>
            <span>${todayMinutes >= dailyGoalMinutes ? '🎉' : formatDuration(Math.max(0, dailyGoalMinutes - todayMinutes)) + ' restam'}</span>
          </div>
        ` : ''}
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

    <!-- Últimos 7 Dias com StudAI Insights lado a lado -->
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

    <div class="grid" style="align-items: stretch;">
      <!-- CARD 1: Radar de Domínio -->
      <div class="card" style="display:flex; flex-direction:column; max-height:380px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-shrink:0;">
          <h3 style="margin:0;">Radar de Domínio · ${escapeHtml(currentMonthName)}</h3>
        </div>
        
        <!-- Área do Gráfico de Teia -->
        <div style="flex:1; display:flex; align-items:center; justify-content:center; padding-bottom:12px;">
          ${radarHtml}
        </div>
      </div>
      
      <!-- CARD 2: Evolução nos Testes (Com Surpresas Visuais) -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; max-height:380px;">
        
        <div>
          <!-- Cabeçalho com Selo Neon -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0;">Evolução nos testes (%)</h3>
            <span class="tag" style="background:rgba(45,255,122,0.08); color:var(--g); border:1px solid rgba(45,255,122,0.25); margin:0; font-weight:700;">
              <i style="font-style:normal; font-size:10px; margin-right:4px;">🎯</i> Análise Ativa
            </span>
          </div>
          
          <!-- Gráfico -->
          <div style="padding-bottom:8px;">
            ${chartSvgHtml}
          </div>
        </div>
        
        <!-- A Surpresa: Caixa de Insight Inteligente -->
        <div style="margin-top:auto; padding:14px; background:rgba(0,0,0,0.25); border:1px solid var(--line); border-left:3px solid var(--g); border-radius:10px; display:flex; gap:12px; align-items:center; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="font-size:18px; background:rgba(45,255,122,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; min-width:36px; height:36px;">
            💡
          </div>
          <div style="font-size:12px; color:var(--mu); line-height:1.5;">
            <b style="color:var(--tx); font-size:13px; display:block; margin-bottom:2px;">Insight do StudAI</b>
            A constância constrói a genialidade. Faça um quiz rápido logo após aprender um tópico novo para dobrar sua retenção!
          </div>
        </div>
        
      </div>
    </div>
  `;
}

document.addEventListener('click', (evento) => {
  const elementoClicado = evento.target;

  // Verifica se o elemento clicado (ou o pai dele) tem a classe btn-resgatar
  if (elementoClicado.closest('.btn-resgatar')) {
    // Dispara a animação de +25 XP na posição exata do rato
    animarGanhoXP(25, evento.clientX, evento.clientY);
  }
});