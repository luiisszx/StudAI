/**
 * StudAI — Goals & Kanban View (Metas & Fluxo de Estudo Moderno)
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

  return `
    <div class="gform" style="background:rgba(0,0,0,0.3); padding:16px; border-radius:12px; border:1px solid var(--line); margin-bottom:16px;">
      <div class="gform-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        <label>
          <span class="sub" style="font-weight:600; display:block; margin-bottom:4px;">Meta semanal *</span>
          <input id="${prefix}t" value="${escapeHtml(goal ? goal.text : "")}" placeholder="Ex: Estudar 8h de Algoritmos">
        </label>
        <label>
          <span class="sub" style="font-weight:600; display:block; margin-bottom:4px;">Matéria *</span>
          ${renderSubjectDropdown(`${prefix}c`, 'Matéria *', goal ? goal.cat : '', subjects)}
        </label>
        <label>
          <span class="sub" style="font-weight:600; display:block; margin-bottom:4px;">Horas semanais *</span>
          <input id="${prefix}h" type="number" min="0.5" step="0.5" value="${goal ? goal.hours : ""}" placeholder="8">
        </label>
        <label>
          <span class="sub" style="font-weight:600; display:block; margin-bottom:4px;">Prazo final (opcional)</span>
          <input id="${prefix}d" type="date" value="${goal ? escapeHtml(goal.due || "") : ""}">
        </label>
      </div>
      <div class="gform-actions" style="margin-top:14px; display:flex; gap:8px;">
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
      <div class="gcard" style="--c:${color}; grid-column:1/-1;">
        <div class="card h3" style="margin:0 0 10px;">Editar meta</div>
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
        <i style="width:${progressPct}%; background:${color}; box-shadow:0 0 8px ${color}"></i>
      </div>
      <div class="gmeta">
        <span><b>${formatDuration(weekMinutes)}</b> de ${goal.hours}h</span>
        <span>${isGoalHit ? "🎉 Meta batida!" : `restam ${formatDuration(minutesLeft)}`}</span>
      </div>
      <div class="gfoot">
        <span class="gchip ${dueStatus ? dueStatus.className : ""}">${dueStatus ? dueStatus.text : "Sem prazo definido"}</span>
        <button class="btn o gdone" style="padding:4px 12px; font-size:12px;" onclick="window.studai.toggleGoal('${goal.id}')">
          ${goal.done ? "↩ Reabrir" : "✔ Concluir (+50 XP)"}
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
    const list = (store.state.tasks || []).filter(t => {
      if (t.status !== key) return false;

      // Auto-limpeza de 3 dias para a coluna "Concluído"
      if (key === "done") {
        const taskTime = t.completedAt || Number(t.id);
        const tresDiasEmMs = 3 * 24 * 60 * 60 * 1000;
        if (taskTime && (Date.now() - taskTime > tresDiasEmMs)) {
          return false;
        }
      }
      return true;
    });

    // Agrupar as tarefas por matéria
    const tasksByCat = {};
    list.forEach(t => {
      const catName = t.cat || "Geral";
      if (!tasksByCat[catName]) tasksByCat[catName] = [];
      tasksByCat[catName].push(t);
    });

    const taskCardsHtml = Object.entries(tasksByCat).map(([cat, tasksInCat]) => {
      const color = store.getSubjectColor(cat);
      const catTag = `<span class="tag" style="border-color:${color};color:${color};margin:0;background:rgba(0,0,0,0.4)">${escapeHtml(cat)}</span>`;
      const countBadge = `<span style="font-size:10px; color:var(--mu); background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:10px; margin-left:6px;">${tasksInCat.length}</span>`;

      const tasksHtml = tasksInCat.map((t, index) => {
        const prevStatus = key === "done" ? "doing" : (key === "doing" ? "todo" : null);
        const nextStatus = key === "todo" ? "doing" : (key === "doing" ? "done" : null);

        const isTodo = key === "todo";
        const editableProps = isTodo
          ? `contenteditable="true" onblur="window.studai.editTask('${t.id}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}" title="Clique para editar"`
          : "";

        const borderBottom = index < tasksInCat.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05);" : "";

        return `
          <div style="padding:12px; ${borderBottom}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div style="flex:1; word-break:break-word; font-weight:500; line-height:1.45; outline:none; transition:0.2s; ${key === "done" ? "text-decoration:line-through; color:var(--mu);" : "color:var(--tx-bright);"} ${isTodo ? "cursor:text;" : ""}" ${editableProps}>
                ${escapeHtml(t.text)}
              </div>
              <button class="btn x" style="padding:2px 7px; font-size:11px; margin-left:8px;" onclick="window.studai.deleteTask('${t.id}')">✕</button>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:6px;">
              ${prevStatus ? `<button class="btn o" style="padding:3px 10px; font-size:11.5px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${prevStatus}')">← Voltar</button>` : ""}
              ${nextStatus ? `<button class="btn o" style="padding:3px 10px; font-size:11.5px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${nextStatus}')">${key === 'todo' ? 'Iniciar ⏳' : 'Concluir ✓ (+5 XP)'}</button>` : ""}
            </div>
          </div>
        `;
      }).join("");

      return `
        <details style="background:rgba(0,0,0,0.32); border:1px solid var(--line-light); border-left:4px solid ${color}; border-radius:10px; margin-bottom:10px; overflow:hidden;" open>
          <summary style="padding:10px 12px; cursor:pointer; outline:none; display:flex; justify-content:space-between; align-items:center; background:transparent;">
            <div style="display:flex; align-items:center;">
              ${catTag}
              ${countBadge}
            </div>
            <span style="font-size:10px; color:var(--mu);">▼</span>
          </summary>
          <div style="padding:0; border-top:1px solid rgba(255,255,255,0.04);">
            ${tasksHtml}
          </div>
        </details>
      `;
    }).join("");

    return `
      <div class="card" style="flex:1; min-width:240px; padding:16px; margin:0; display:flex; flex-direction:column;">
        <h4 style="margin:0 0 14px; text-align:center; color:var(--mu); font-size:12px; text-transform:uppercase; letter-spacing:0.08em; display:flex; justify-content:space-between; align-items:center;">
          <span>${label}</span>
          <span class="tag" style="margin:0">${list.length}</span>
        </h4>
        ${taskCardsHtml || `<div class="empty" style="padding:18px 10px; font-size:12.5px;">Nenhuma tarefa</div>`}
      </div>
    `;
  }).join("");

  const subjects = store.getSubjects();

  const kanbanCardHtml = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0;">Kanban de Tarefas & Estudo</h3>
        <span class="tag" style="background:rgba(45,255,122,0.08); color:var(--g); border-color:rgba(45,255,122,0.3); margin:0;">
          +5 XP por tarefa concluída
        </span>
      </div>
      
      <!-- Formulário de Adição Responsivo -->
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin:18px 0; align-items:stretch;">
        <input id="kb-txt" placeholder="Nova tarefa (ex: Resolver 10 exercícios, Ler cap. 5)" style="flex:2; min-width:200px; margin:0;">
        
        <div class="custom-dropdown" id="kb-cat-dropdown" style="flex:1; min-width:140px; margin:0;">
          <div class="dropdown-selected" style="height:100%; display:flex; align-items:center; justify-content:space-between;">
            <span class="selected-text">Matéria</span> 
            <span class="arrow" style="font-size:10px; color:var(--mu);">▼</span>
          </div>
          <div class="dropdown-options">
            <div class="option" data-value="">Nenhuma (Geral)</div>
            ${subjects.map(s => `<div class="option" data-value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>`).join("")}
          </div>
          <input type="hidden" id="kb-cat" value="">
        </div>
        
        <button class="btn" style="margin:0; white-space:nowrap; padding:0 20px;" onclick="window.studai.addTask()">
          + Adicionar
        </button>
      </div>
      
      <!-- Colunas do Kanban -->
      <div style="display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; border-top:1px solid rgba(255,255,255,0.05); padding-top:18px;">
        ${kanbanColsHtml}
      </div>
    </div>
  `;

  // 2. Metas Semanais
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
        <span>batidas esta semana</span>
      </div>
      <div class="gstat">
        <b>${formatDuration(totalWeekMinutesStudied)}</b>
        <span>de ${formatDuration(totalWeekMinutesTarget)} planejados</span>
      </div>
    </div>
  `;

  const emptyGoalsHtml = `<div class="empty">Nenhuma meta semanal cadastrada. Crie uma para monitorar seu ritmo e ganhar XP!</div>`;

  const goalsCardHtml = `
    <div class="card">
      <div class="ghead">
        <div>
          <h3 style="margin:0;">Metas Semanais de Foco</h3>
          <div class="sub" style="margin-top:2px;">Recálculo automático toda segunda-feira (início: ${weekStartFormatted})</div>
        </div>
        <button class="btn ${isGoalFormOpen ? "o" : ""}" onclick="window.studai.toggleGoalForm(!${isGoalFormOpen})">
          ${isGoalFormOpen ? "Fechar" : "+ Nova Meta"}
        </button>
      </div>
      ${allGoals.length ? statsHtml : ""}
      ${isGoalFormOpen ? renderGoalForm(null) : ""}
      ${activeGoals.length ? `<div class="ggrid">${activeGoals.map(renderGoalCard).join("")}</div>` : (isGoalFormOpen ? "" : emptyGoalsHtml)}
      ${finishedGoals.length ? `
        <details style="margin-top:20px;">
          <summary class="sub" style="cursor:pointer; font-weight:700; color:var(--tx-bright); margin-bottom:12px;">
            ✅ Metas Concluídas (${finishedGoals.length}) ▾
          </summary>
          <div class="ggrid">${finishedGoals.map(renderGoalCard).join("")}</div>
        </details>
      ` : ""}
    </div>
  `;

  return kanbanCardHtml + goalsCardHtml;
}
