/**
 * StudAI — Goals & Kanban View (Metas)
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration, getTodayIso, getWeekStartIso, formatDateBr, sortAlpha, renderSubjectDropdown } from "../utils.js";

export let editingGoalId = null;
export let isGoalFormOpen = false;

export function setEditingGoal(id) {
  editingGoalId = id;
}

export function setGoalFormOpen(isOpen) {
  isGoalFormOpen = isOpen;
}

function calculateGoalWeekMinutes(goal) {
  const weekStart = getWeekStartIso();
  const targetCategory = (goal.cat || "Geral").toLowerCase();

  return (store.state.sessions || [])
    .filter(s => s.date >= weekStart && (s.cat || "Geral").toLowerCase() === targetCategory)
    .reduce((sum, s) => sum + (Number(s.min) || 0), 0);
}

function getGoalDueStatus(goal) {
  if (!goal.due) return null;
  const brDate = formatDateBr(goal.due);
  if (goal.done) return { text: `Concluída (${brDate})`, className: "" };

  const today = getTodayIso();
  const diffDays = Math.round((new Date(goal.due + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000);

  if (diffDays < 0) {
    return { text: `Atrasada há ${-diffDays} ${diffDays === -1 ? "dia" : "dias"}`, className: "late" };
  }
  if (diffDays === 0) {
    return { text: "Vence hoje!", className: "warn" };
  }
  if (diffDays <= 3) {
    return { text: `Faltam ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`, className: "warn" };
  }
  return { text: `Até ${brDate}`, className: "" };
}

function renderGoalForm(goal = null) {
  const prefix = goal ? "eg" : "g";
  const subjects = store.getSubjects();
  const datalistHtml = `<datalist id="cats">${subjects.map(s => `<option value="${escapeHtml(s.name)}">`).join("")}</datalist>`;

  return `
    <div class="gform">
      ${datalistHtml}
      <div class="gform-grid">
        <label>
          <span class="sub">Meta semanal *</span>
          <input id="${prefix}t" value="${escapeHtml(goal ? goal.text : "")}" placeholder="Ex: Estudar 8h de Python">
        </label>
        <label>
          <span class="sub">Matéria *</span>
${renderSubjectDropdown(`${prefix}c`, 'Matéria *', goal ? goal.cat : '', subjects)}
        </label>
        <label>
          <span class="sub">Horas semanais *</span>
          <input id="${prefix}h" type="number" min="0.5" step="0.5" value="${goal ? goal.hours : ""}" placeholder="8">
        </label>
        <label>
          <span class="sub">Prazo final (opcional)</span>
          <input id="${prefix}d" type="date" value="${goal ? escapeHtml(goal.due || "") : ""}">
        </label>
      </div>
      <div class="gform-actions">
        ${goal
      ? `<button class="btn" onclick="window.studai.saveGoal('${goal.id}')">Salvar alterações</button>
             <button class="btn o" onclick="window.studai.cancelGoalEdit()">Cancelar</button>`
      : `<button class="btn" onclick="window.studai.addGoal()">Criar meta</button>
             <button class="btn o" onclick="window.studai.toggleGoalForm(false)">Cancelar</button>`
    }
      </div>
    </div>
  `;
}

function renderGoalCard(goal) {
  const color = store.getSubjectColor(goal.cat);

  if (goal.id === editingGoalId) {
    return `
      <div class="gcard" style="--c:${color};grid-column:1/-1">
        <div class="card h3" style="margin:0 0 10px">Editar meta</div>
        ${renderGoalForm(goal)}
      </div>
    `;
  }

  const weekMinutes = calculateGoalWeekMinutes(goal);
  const targetMinutes = (goal.hours || 0) * 60;
  const progressPct = targetMinutes > 0 ? Math.min(100, (weekMinutes / targetMinutes) * 100) : 0;
  const minutesLeft = Math.max(0, targetMinutes - weekMinutes);
  const isGoalHit = progressPct >= 100;
  const dueStatus = getGoalDueStatus(goal);

  return `
    <div class="gcard ${goal.done ? "done" : ""}" style="--c:${color}">
      <div class="gtop">
        <div class="gring" style="--p:${progressPct}">
          <span>${Math.round(progressPct)}%</span>
        </div>
        <div class="ginfo">
          <span class="gcat">${escapeHtml(goal.cat)}</span>
          <div class="gtitle">${escapeHtml(goal.text)}</div>
        </div>
        <div class="gact">
          <button class="gbtn" title="Editar" onclick="window.studai.startEditGoal('${goal.id}')">✎</button>
          <button class="gbtn x" title="Apagar" onclick="window.studai.deleteGoal('${goal.id}')">✕</button>
        </div>
      </div>
      <div class="bar">
        <i style="width:${progressPct}%;background:${color}"></i>
      </div>
      <div class="gmeta">
        <span><b>${formatDuration(weekMinutes)}</b> de ${goal.hours}h</span>
        <span>${isGoalHit ? "🎉 Meta da semana batida!" : `faltam ${formatDuration(minutesLeft)}`}</span>
      </div>
      <div class="gfoot">
        <span class="gchip ${dueStatus ? dueStatus.className : ""}">${dueStatus ? dueStatus.text : "Sem prazo"}</span>
        <button class="btn o gdone" onclick="window.studai.toggleGoal('${goal.id}')">
          ${goal.done ? "↩ Reabrir" : "✔ Concluir"}
        </button>
      </div>
    </div>
  `;
}

export function renderGoals() {
  // 1. Kanban Board
  const kanbanColumns = [
    { key: "todo", label: "📌 A Fazer" },
    { key: "doing", label: "⏳ Fazendo" },
    { key: "done", label: "✅ Concluído" }
  ];

  const kanbanColsHtml = kanbanColumns.map(({ key, label }) => {
    const list = (store.state.tasks || []).filter(t => t.status === key);

    const taskCardsHtml = list.map(t => {
      const color = store.getSubjectColor(t.cat);
      const prevStatus = key === "done" ? "doing" : (key === "doing" ? "todo" : null);
      const nextStatus = key === "todo" ? "doing" : (key === "doing" ? "done" : null);

      // --- NOVO: Define se é editável ---
      const isTodo = key === "todo";
      const editableProps = isTodo
        ? `contenteditable="true" onblur="window.studai.editTask('${t.id}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}" title="Clique para editar"`
        : "";

      return `
        <div style="background:rgba(255,255,255,0.035); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:10px; font-size:13px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            
            <!-- Texto da Tarefa (Editável apenas se isTodo for verdadeiro) -->
            <div style="flex:1; word-break:break-word; font-weight:500; outline:none; transition:0.2s; ${key === "done" ? "text-decoration:line-through; color:var(--mu);" : ""} ${isTodo ? "cursor:text;" : ""}" ${editableProps}>
              ${escapeHtml(t.text)}
            </div>
            
            <button class="btn x" style="padding:2px 8px; font-size:10px; margin-left:8px;" onclick="window.studai.deleteTask('${t.id}')">✕</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            ${t.cat ? `<span class="tag" style="border-color:${color};color:${color};margin:0;background:rgba(0,0,0,0.4)">${escapeHtml(t.cat)}</span>` : "<span></span>"}
            <div style="display:flex; gap:6px;">
              ${prevStatus ? `<button class="btn o" style="padding:4px 10px; font-size:12px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${prevStatus}')">←</button>` : ""}
              ${nextStatus ? `<button class="btn o" style="padding:4px 10px; font-size:12px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${nextStatus}')">→</button>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="flex:1; min-width:240px; background:rgba(0,0,0,0.22); border-radius:14px; padding:14px; border:1px solid var(--line);">
        <h4 style="margin:0 0 14px; text-align:center; color:var(--mu); font-size:12px; text-transform:uppercase; letter-spacing:0.1em; display:flex; justify-content:space-between;">
          <span>${label}</span>
          <span class="tag" style="margin:0">${list.length}</span>
        </h4>
        ${taskCardsHtml || `<div class="empty" style="padding:12px; font-size:13px;">Nenhuma tarefa</div>`}
      </div>
    `;
  }).join("");

  const subjects = store.getSubjects();
  const datalistHtml = `<datalist id="cats">${subjects.map(s => `<option value="${escapeHtml(s.name)}">`).join("")}</datalist>`;

  const kanbanCardHtml = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0">Kanban de Tarefas</h3>
        <span class="tag" style="background:rgba(45,255,122,0.06); color:var(--g); border:1px dashed var(--g);">+5 XP por tarefa concluída</span>
      </div>
      ${datalistHtml}
      <div class="row" style="margin-top:14px;">
        <input id="kb-txt" placeholder="Nova tarefa (ex: Ler capítulo 4, Fazer exercícios)">
  <div class="custom-dropdown" id="kb-cat-dropdown" style="flex: 1; min-width: 140px;">
    <div class="dropdown-selected"><span class="selected-text">Matéria </span> <span class="arrow">▼</span></div>
    <div class="dropdown-options">
      <div class="option" data-value="">Nenhuma (Geral)</div>
      ${subjects.map(s => `<div class="option" data-value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>`).join("")}
    </div>
    <!-- Input oculto para o sistema continuar a guardar corretamente a tarefa -->
    <input type="hidden" id="kb-cat" value="">
  </div>
</div>     
 </div>
      <button class="btn" onclick="window.studai.addTask()">+ Adicionar Tarefa</button>
      <div style="display:flex; gap:16px; margin-top:20px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin;">
        ${kanbanColsHtml}
      </div>
    </div>
  `;

  // 2. Weekly Goals Section
  const allGoals = store.state.goals || [];
  const activeGoals = allGoals
    .filter(g => !g.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || sortAlpha(a.cat, b.cat));
  const finishedGoals = allGoals.filter(g => g.done);

  const goalsHitCount = activeGoals.filter(g => {
    const mins = calculateGoalWeekMinutes(g);
    return (g.hours || 0) > 0 && mins >= g.hours * 60;
  }).length;

  const totalWeekMinutesStudied = activeGoals.reduce((sum, g) => sum + calculateGoalWeekMinutes(g), 0);
  const totalWeekMinutesTarget = activeGoals.reduce((sum, g) => sum + (g.hours || 0) * 60, 0);
  const weekStartFormatted = formatDateBr(getWeekStartIso());

  const statsHtml = `
    <div class="gstats">
      <div class="gstat">
        <b>${activeGoals.length}</b>
        <span>metas ativas</span>
      </div>
      <div class="gstat">
        <b>${goalsHitCount}</b>
        <span>batidas nesta semana</span>
      </div>
      <div class="gstat">
        <b>${formatDuration(totalWeekMinutesStudied)}</b>
        <span>de ${formatDuration(totalWeekMinutesTarget)} planejados</span>
      </div>
    </div>
  `;

  const emptyGoalsHtml = `<div class="empty">Nenhuma meta semanal cadastrada. Crie uma para monitorar seu ritmo de estudo!</div>`;

  const goalsCardHtml = `
    <div class="card">
      <div class="ghead">
        <div>
          <h3>Metas semanais</h3>
          <div class="sub">O progresso é recalculado semanalmente (desde segunda-feira, ${weekStartFormatted})</div>
        </div>
        <button class="btn ${isGoalFormOpen ? "o" : ""}" onclick="window.studai.toggleGoalForm(!${isGoalFormOpen})">
          ${isGoalFormOpen ? "Fechar" : "+ Nova meta"}
        </button>
      </div>
      ${allGoals.length ? statsHtml : ""}
      ${isGoalFormOpen ? renderGoalForm(null) : ""}
      ${activeGoals.length ? `<div class="ggrid">${activeGoals.map(renderGoalCard).join("")}</div>` : (isGoalFormOpen ? "" : emptyGoalsHtml)}
      ${finishedGoals.length ? `
        <details style="margin-top:20px;">
          <summary class="sub" style="cursor:pointer; font-weight:700; color:var(--tx); margin-bottom:12px;">
            ✅ Metas Concluídas (${finishedGoals.length}) ▾
          </summary>
          <div class="ggrid">${finishedGoals.map(renderGoalCard).join("")}</div>
        </details>
      ` : ""}
    </div>
  `;

  return kanbanCardHtml + goalsCardHtml;
}
