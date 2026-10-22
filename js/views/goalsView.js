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
    const list = (store.state.tasks || []).filter(t => {
      if (t.status !== key) return false;

      // NOVO: Auto-limpeza de 3 dias para a coluna "Concluído"
      if (key === "done") {
        // Usa a data de conclusão ou a data de criação (se o ID for um timestamp)
        const taskTime = t.completedAt || Number(t.id);
        const tresDiasEmMs = 3 * 24 * 60 * 60 * 1000;

        if (taskTime && (Date.now() - taskTime > tresDiasEmMs)) {
          return false; // Esconde a tarefa
        }
      }
      return true;
    });

    // --- NOVO: Agrupar as tarefas por matéria ---
    const tasksByCat = {};
    list.forEach(t => {
      const catName = t.cat || "Geral";
      if (!tasksByCat[catName]) tasksByCat[catName] = [];
      tasksByCat[catName].push(t);
    });

    // Agora iteramos sobre os grupos (matérias) em vez das tarefas individuais
    const taskCardsHtml = Object.entries(tasksByCat).map(([cat, tasksInCat]) => {
      const color = store.getSubjectColor(cat);
      const catTag = `<span class="tag" style="border-color:${color};color:${color};margin:0;background:rgba(0,0,0,0.4)">${escapeHtml(cat)}</span>`;
      const countBadge = `<span style="font-size:10px; color:var(--mu); background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:10px; margin-left:8px;">${tasksInCat.length}</span>`;

      // Gera o HTML das tarefas individuais dentro desta matéria
      const tasksHtml = tasksInCat.map((t, index) => {
        const prevStatus = key === "done" ? "doing" : (key === "doing" ? "todo" : null);
        const nextStatus = key === "todo" ? "doing" : (key === "doing" ? "done" : null);

        const isTodo = key === "todo";
        const editableProps = isTodo
          ? `contenteditable="true" onblur="window.studai.editTask('${t.id}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}" title="Clique para editar"`
          : "";

        // Adiciona uma linha divisória se não for a última tarefa do grupo
        const borderBottom = index < tasksInCat.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05);" : "";

        return `
          <div style="padding:14px 12px; ${borderBottom}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
              <!-- Texto da Tarefa -->
              <div style="flex:1; word-break:break-word; font-weight:500; line-height:1.5; outline:none; transition:0.2s; ${key === "done" ? "text-decoration:line-through; color:var(--mu);" : "color:var(--tx);"} ${isTodo ? "cursor:text;" : ""}" ${editableProps}>
                ${escapeHtml(t.text)}
              </div>
              <!-- Botão Apagar -->
              <button class="btn x" style="padding:2px 8px; font-size:10px; margin-left:8px;" onclick="window.studai.deleteTask('${t.id}')">✕</button>
            </div>
            
            <!-- Setas de Movimentação do Kanban -->
            <div style="display:flex; justify-content:flex-end; gap:6px;">
              ${prevStatus ? `<button class="btn o" style="padding:4px 12px; font-size:12px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${prevStatus}')">← Mover</button>` : ""}
              ${nextStatus ? `<button class="btn o" style="padding:4px 12px; font-size:12px; border-radius:6px;" onclick="window.studai.moveTask('${t.id}', '${nextStatus}')">${key === 'todo' ? 'Iniciar →' : 'Concluir ✓'}</button>` : ""}
            </div>
          </div>
        `;
      }).join("");

      // Retorna a "Sanfona" da Matéria com as tarefas dentro
      return `
        <details style="background:rgba(0, 0, 0, 0.39); border:1px solid var(--line); border-left:4px solid ${color}; border-radius:10px; margin-bottom:10px; box-shadow:0 4px 12px rgba(0,0,0,0.15); overflow:hidden;">
          <summary style="padding:12px; cursor:pointer; outline:none; display:flex; justify-content:space-between; align-items:center; list-style:none; background:transparent; transition:background 0.2s;" onmouseover="this.style.background='rgba(45,255,122,0.05)'" onmouseout="this.style.background='transparent'">
            <div style="display:flex; align-items:center;">
              ${catTag}
              ${countBadge}
            </div>
            <span style="font-size:10px; color:var(--mu);">▼</span>
          </summary>
          
          <div style="padding:0; border-top:1px solid rgba(7, 4, 4, 0.31);">
            ${tasksHtml}
          </div>
        </details>
      `;
    }).join("");

    return `
      <div class="card" style="flex:1; min-width:240px; padding:14px; margin:0; display:flex; flex-direction:column;">
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
        <h3 style="margin:0;">Kanban de Tarefas</h3>
        <span class="tag" style="background:rgba(45,255,122,0.06); color:var(--g); border:1px dashed var(--g); margin:0;">+5 XP por tarefa concluída</span>
      </div>
      
      ${datalistHtml}
      
      <!-- Formulário de Adição em Linha (Grid) -->
      <div style="display:grid; grid-template-columns: 2fr 1fr auto; gap:12px; margin:20px 0; align-items:stretch;">
        <input id="kb-txt" placeholder="Nova tarefa (ex: Ler capítulo 4, Fazer exercícios)" style="margin:0; height:100%;">
        
        <div class="custom-dropdown" id="kb-cat-dropdown" style="margin:0; height:100%;">
          <div class="dropdown-selected" style="height:100%; display:flex; align-items:center; justify-content:space-between;">
            <span class="selected-text">Matéria</span> 
            <span class="arrow">▼</span>
          </div>
          <div class="dropdown-options">
            <div class="option" data-value="">Nenhuma (Geral)</div>
            ${subjects.map(s => `<div class="option" data-value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>`).join("")}
          </div>
          <input type="hidden" id="kb-cat" value="">
        </div>
        
        <button class="btn" style="margin:0; height:100%; white-space:nowrap; padding:0 20px;" onclick="window.studai.addTask()">
          + Adicionar
        </button>
      </div>
      
      <!-- Colunas do Kanban -->
      <div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; border-top:1px solid rgba(255,255,255,0.05); padding-top:20px;">
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
