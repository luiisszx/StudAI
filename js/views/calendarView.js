/**
 * StudAI — Calendar & Analytics View (Calendário)
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration, getTodayIso, formatDateBr, sortAlpha } from "../utils.js";

export let calendarMonthOffset = 0;
export let selectedCalendarDate = null;

export function setCalendarMonthOffset(offset) {
  calendarMonthOffset = offset;
}

export function setSelectedCalendarDate(dateKey) {
  selectedCalendarDate = dateKey;
}

export function renderCalendar() {
  const baseDate = new Date();
  baseDate.setDate(1);
  baseDate.setMonth(baseDate.getMonth() + calendarMonthOffset);

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekIndex = baseDate.getDay();

  const makeDateKey = (dayNum) => `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

  const sessions = store.state.sessions || [];
  const goals = store.state.goals || [];
  const logs = store.state.logs || [];

  const getMinutesForDate = (dateKey) =>
    sessions.filter(s => s.date === dateKey).reduce((sum, s) => sum + (Number(s.min) || 0), 0);

  const getSubjectsForDate = (dateKey) => {
    const map = {};
    sessions.filter(s => s.date === dateKey).forEach(s => {
      const c = s.cat || "Geral";
      map[c] = (map[c] || 0) + Number(s.min);
    });
    return Object.keys(map);
  };

  const monthAllDayMinutes = Array.from({ length: totalDaysInMonth }, (_, i) => getMinutesForDate(makeDateKey(i + 1)));
  const maxDayMinutes = Math.max(30, ...monthAllDayMinutes);

  let cellsHtml = "";
  // Empty slots before month start
  for (let i = 0; i < firstDayWeekIndex; i++) {
    cellsHtml += "<div></div>";
  }

  const todayIso = getTodayIso();
  for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
    const dateKey = makeDateKey(dayNum);
    const dayMins = getMinutesForDate(dateKey);
    const intensity = dayMins > 0 ? 0.25 + (dayMins / maxDayMinutes) * 0.75 : 0;

    const hasPendingGoal = goals.some(g => g.due === dateKey && !g.done);
    const hasFinishedGoal = goals.some(g => g.due === dateKey && g.done);
    const subjectsStudied = getSubjectsForDate(dateKey);

    const dotsHtml = subjectsStudied.length
      ? `<div class="day-colors">
          ${subjectsStudied.slice(0, 4).map(c => `<i style="background:${store.getSubjectColor(c)}" title="${escapeHtml(c)}"></i>`).join("")}
          ${subjectsStudied.length > 4 ? "<i style='background:#666;font-size:7px;color:#fff'>+</i>" : ""}
         </div>`
      : "";

    const isSelected = dateKey === selectedCalendarDate;
    const isToday = dateKey === todayIso;
    const borderColor = isSelected ? "var(--g)" : (isToday ? "var(--g2)" : "var(--line)");

    cellsHtml += `
      <button onclick="window.studai.selectCalendarDate('${dateKey}')" style="aspect-ratio:1; border-radius:10px; border:1px solid ${borderColor}; background:rgba(45,255,122,${(intensity * 0.45).toFixed(2)}); color:var(--tx); cursor:pointer; font-family:var(--font); font-size:13px; position:relative; padding:4px 2px; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:var(--transition);">
        ${dayNum}
        ${hasPendingGoal ? '<span style="position:absolute;top:2px;right:3px;font-size:10px;">🎯</span>' : (hasFinishedGoal ? '<span style="position:absolute;top:2px;right:3px;font-size:10px;">✅</span>' : "")}
        ${dotsHtml}
      </button>
    `;
  }

  // Selected Day Details Card
  let dayDetailsHtml = "";
  if (selectedCalendarDate) {
    const daySessions = sessions.filter(s => s.date === selectedCalendarDate);
    const dayLogs = logs.filter(l => l.date === selectedCalendarDate);
    const dayGoals = goals.filter(g => g.due === selectedCalendarDate);

    const hasActivity = daySessions.length > 0 || dayLogs.length > 0 || dayGoals.length > 0;

    dayDetailsHtml = `
      <div class="card">
        <h3>Detalhes de ${formatDateBr(selectedCalendarDate)}</h3>
        ${daySessions.map(s => `
          <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
            <i class="color-dot" style="background:${store.getSubjectColor(s.cat)}"></i>
            ⏱️ <b>${formatDuration(s.min)}</b>
            <span class="tag" style="border-color:${store.getSubjectColor(s.cat)}; color:${store.getSubjectColor(s.cat)}">${escapeHtml(s.cat || "Geral")}</span>
          </div>
        `).join("")}
        ${dayLogs.map(t => `
          <div style="margin:6px 0;">📚 <b>${escapeHtml(t.topic)}</b>: <span class="sub">${escapeHtml(t.what)}</span></div>
        `).join("")}
        ${dayGoals.map(g => `
          <div style="margin:6px 0;">🎯 Meta: <b>${escapeHtml(g.text)}</b> ${g.done ? "✔ Concluída" : "⏳ Pendente"}</div>
        `).join("")}
        ${!hasActivity ? '<div class="empty">Nenhum estudo ou meta registrada neste dia.</div>' : ""}
      </div>
    `;
  }

  // Monthly Analytics Summary
  const monthNameYear = baseDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthSessions = sessions.filter(s => (s.date || "").startsWith(monthPrefix));
  const totalMonthMinutes = monthSessions.reduce((sum, s) => sum + (Number(s.min) || 0), 0);

  // Subject ranking in month
  const monthByCat = {};
  monthSessions.forEach(s => {
    const c = s.cat || "Geral";
    monthByCat[c] = (monthByCat[c] || 0) + Number(s.min);
  });
  const rankingSubjects = Object.entries(monthByCat)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);

  // Weekday ranking in month
  const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const weekdayMinutes = Array(7).fill(0);
  const weekdayDatesSets = Array.from({ length: 7 }, () => new Set());

  monthSessions.forEach(s => {
    const wd = new Date(s.date + "T12:00:00").getDay();
    weekdayMinutes[wd] += Number(s.min);
    if (s.min > 0) weekdayDatesSets[wd].add(s.date);
  });

  const rankingWeekdays = weekdayMinutes
    .map((mins, idx) => ({ idx, mins, count: weekdayDatesSets[idx].size }))
    .filter(x => x.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const maxRankSubjectMin = rankingSubjects.length ? rankingSubjects[0][1] : 1;
  const maxRankWeekdayMin = rankingWeekdays.length ? rankingWeekdays[0].mins : 1;
  const getMedal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}º`;

  const rankingSubjectsHtml = rankingSubjects.map(([cat, mins], i) => `
    <div class="hb" style="grid-template-columns: 28px 110px 1fr 56px">
      <span>${getMedal(i)}</span>
      <span style="display:flex; align-items:center; gap:6px">
        <i class="color-dot" style="background:${store.getSubjectColor(cat)}"></i>
        ${escapeHtml(cat)}
      </span>
      <div class="bar">
        <i style="width:${(mins / maxRankSubjectMin) * 100}%; background:${store.getSubjectColor(cat)}"></i>
      </div>
      <span>${formatDuration(mins)}</span>
    </div>
  `).join("");

  const rankingWeekdaysHtml = rankingWeekdays.map((item, i) => `
    <div class="hb" style="grid-template-columns: 28px 110px 1fr 56px">
      <span>${getMedal(i)}</span>
      <span>${weekdayNames[item.idx]} <span class="sub">· ${item.count}x</span></span>
      <div class="bar">
        <i style="width:${(item.mins / maxRankWeekdayMin) * 100}%"></i>
      </div>
      <span>${formatDuration(item.mins)}</span>
    </div>
  `).join("");

  // Monthly goals status
  const getGoalStatus = (g) => g.done ? "ok" : (g.due && g.due < todayIso ? "late" : "pend");
  const monthGoals = goals
    .filter(g => (g.due || g.created || "").startsWith(monthPrefix))
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));

  const hitGoalsCount = monthGoals.filter(g => getGoalStatus(g) === "ok").length;
  const lateGoalsCount = monthGoals.filter(g => getGoalStatus(g) === "late").length;
  const pendGoalsCount = monthGoals.length - hitGoalsCount - lateGoalsCount;

  const monthGoalsCardHtml = `
    <div class="card">
      <h3>Metas de ${escapeHtml(monthNameYear)}</h3>
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
        <span>✅ <b>${hitGoalsCount}</b> <span class="sub">atingidas</span></span>
        <span>⏳ <b>${pendGoalsCount}</b> <span class="sub">pendentes</span></span>
        <span>❌ <b>${lateGoalsCount}</b> <span class="sub">não atingidas</span></span>
      </div>
      ${monthGoals.map(g => {
        const st = getGoalStatus(g);
        const icon = st === "ok" ? "✅" : (st === "late" ? "❌" : "⏳");
        const color = st === "ok" ? "var(--g)" : (st === "late" ? "var(--red)" : "var(--mu)");
        return `
          <div class="item">
            <span>${icon}</span>
            <div class="t">
              <b style="color:${color}">${escapeHtml(g.text)}</b><br>
              ${g.cat ? `<span class="tag" style="border-color:${store.getSubjectColor(g.cat)};color:${store.getSubjectColor(g.cat)};margin-top:4px;">${escapeHtml(g.cat)}</span>` : ""}
              <span class="sub">${g.due ? "Prazo: " + formatDateBr(g.due) : "Sem prazo"} · ${g.hours || 0}h semanais</span>
            </div>
          </div>
        `;
      }).join("") || `<div class="empty">Nenhuma meta com prazo neste mês.</div>`}
    </div>
  `;

  const calendarCardHtml = `
    <div class="card">
      <div class="row" style="align-items:center; flex-wrap:nowrap">
        <button class="btn o" onclick="window.studai.changeCalendarMonth(-1)">←</button>
        <h3 style="text-align:center; margin:0; flex:3; text-transform:capitalize;">${escapeHtml(monthNameYear)}</h3>
        ${calendarMonthOffset !== 0 ? `<button class="btn o" style="font-size:11px; padding:6px 10px; white-space:nowrap;" onclick="window.studai.goToToday()">Hoje</button>` : '<div style="width:60px"></div>'}
        <button class="btn o" onclick="window.studai.changeCalendarMonth(1)">→</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-top:14px">
        ${["D", "S", "T", "Q", "Q", "S", "S"].map(letter => `<div class="sub" style="text-align:center; font-weight:700;">${letter}</div>`).join("")}
        ${cellsHtml}
      </div>
      <div class="sub" style="margin-top:12px">
        Legenda: Cores mais vivas indicam mais tempo de estudo no dia. 🎯 = meta a vencer · ✅ = meta atingida.
      </div>
      <div class="legend">
        ${store.getSubjects().map(s => `<span><i class="color-dot" style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`).join("")}
      </div>
    </div>
  `;

  const summarySectionHtml = `
    <div class="card">
      <h3>Resumo Geral · ${escapeHtml(monthNameYear)}</h3>
      <div class="big">${formatDuration(totalMonthMinutes)}</div>
      <div class="sub">tempo total dedicado ao estudo neste mês</div>
    </div>
    ${monthGoalsCardHtml}
    <div class="grid">
      <div class="card">
        <h3>Tempo por Matéria</h3>
        ${rankingSubjectsHtml || `<div class="empty">Nenhum estudo neste mês</div>`}
      </div>
      <div class="card">
        <h3>Dias da Semana Mais Estudados</h3>
        ${rankingWeekdaysHtml || `<div class="empty">Nenhum estudo neste mês</div>`}
      </div>
    </div>
  `;

  return calendarCardHtml + dayDetailsHtml + summarySectionHtml;
}
