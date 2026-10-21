/**
 * StudAI — Timer View (Tempo, Histórico e Flashcards)
 */
import { store } from "../store.js";
import { timer } from "../timer.js";
import { escapeHtml, formatDuration, getTodayIso, formatDateBr, sortAlpha, renderSubjectDropdown } from "../utils.js";
import { sounds } from "../audio.js";

export let activeBlurMode = false;
export let editingHistoryKey = null;
export let flashcardState = {
  category: "",
  index: 0,
  isFlipped: false,
  shuffledOrder: null
};

export function toggleActiveBlur() {
  activeBlurMode = !activeBlurMode;
}

export function setEditingHistoryKey(key) {
  editingHistoryKey = key;
}

// Combine sessions and logs into paired history entries
function getUnifiedHistoryEntries() {
  const usedSessionIds = new Set();
  const entries = [];

  const logs = store.state.logs || [];
  const sessions = store.state.sessions || [];

  logs.forEach(log => {
    let sess = log.sid ? sessions.find(s => s.id === log.sid) : null;
    if (!sess) {
      sess = sessions.find(s =>
        !usedSessionIds.has(s.id) &&
        !logs.some(l => l.sid === s.id) &&
        s.date === log.date &&
        (s.cat || "Geral") === (log.cat || "Geral")
      );
    }
    if (sess) usedSessionIds.add(sess.id);

    entries.push({
      key: log.id,
      log,
      sess: sess || null,
      date: log.date,
      cat: log.cat || (sess && sess.cat) || "Geral"
    });
  });

  sessions.forEach(sess => {
    if (!usedSessionIds.has(sess.id)) {
      entries.push({
        key: sess.id,
        log: null,
        sess,
        date: sess.date,
        cat: sess.cat || "Geral"
      });
    }
  });

  return entries.reverse().sort((a, b) => b.date.localeCompare(a.date));
}

function renderStopwatchUI() {
  return `
    <div class="timer" id="tmr">00:00:00</div>
    <div class="row">
      <button class="btn" onclick="window.studai.toggleStopwatch()">
        ${timer.stopwatch.isRunning ? "⏸ Pausar" : "▶ Iniciar"}
      </button>
      <button class="btn o" onclick="window.studai.saveStopwatch()">
        ✔ Finalizar e salvar
      </button>
    </div>
  `;
}

function renderPomodoroUI() {
  const phase = timer.pomodoro.phase;
  const isFocus = phase === "foco";
  const isLong = phase === "longa";

  const phaseTitle = isFocus ? "🍅 Foco" : isLong ? "☕ Pausa Longa" : "☕ Pausa Curta";
  const phaseColor = isFocus ? "var(--red)" : "var(--g)";

  const mm = String(Math.floor(timer.pomodoro.secondsLeft / 60)).padStart(2, "0");
  const ss = String(timer.pomodoro.secondsLeft % 60).padStart(2, "0");

  const perm = "Notification" in window ? Notification.permission : "unsupported";
  const notifButtonHtml = perm === "granted"
    ? `<span class="tag" style="margin:0">🔔 Notificações ativas</span>`
    : perm === "denied"
      ? `<span class="sub">Notificações bloqueadas no navegador.</span>`
      : `<button class="btn o" style="font-size:12px;padding:6px 12px" onclick="window.studai.requestNotif()">🔔 Ativar notificações</button>`;

  const dots = timer.pomodoro.completedCycles > 0
    ? "🍅".repeat(Math.min(timer.pomodoro.completedCycles, 12))
    : "—";

  return `
    <div class="sub" style="text-align:center; font-weight:bold; color:${phaseColor}; font-size:16px;">
      ${phaseTitle}
    </div>
    <div class="timer" id="ptmr_main">${mm}:${ss}</div>
    <div class="row">
      <button class="btn" style="background:${phaseColor}; color:#000;" onclick="window.studai.togglePomodoro()">
        ${timer.pomodoro.isRunning ? "⏸ Pausar" : "▶ Iniciar"}
      </button>
      <button class="btn o" onclick="window.studai.skipPomodoro()">⏭ Pular fase</button>
      <button class="btn o" onclick="window.studai.savePomodoro()">✔ Finalizar e salvar</button>
    </div>

    <div class="row" style="margin-top:14px;">
      <div style="flex:1">
        <label class="sub">Minutos Foco</label>
        <input type="number" min="1" value="${timer.pomodoro.focusMinutes}" onchange="window.studai.configPomodoro({ focus: this.value })">
      </div>
      <div style="flex:1">
        <label class="sub">Minutos Pausa</label>
        <input type="number" min="1" value="${timer.pomodoro.breakMinutes}" onchange="window.studai.configPomodoro({ shortBreak: this.value })">
      </div>
      <div style="flex:1">
        <label class="sub">Pausa Longa</label>
        <input type="number" min="1" value="${timer.pomodoro.longBreakMinutes}" onchange="window.studai.configPomodoro({ longBreak: this.value })">
      </div>
    </div>

    <div class="row" style="align-items:center; justify-content:space-between; margin-top:10px;">
      <label class="sub" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" ${timer.pomodoro.autoNextPhase ? "checked" : ""} onchange="window.studai.configPomodoro({ autoNext: this.checked })">
        Iniciar próxima fase automaticamente
      </label>
      <div>${notifButtonHtml}</div>
    </div>

    <div class="row" style="align-items:center; margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px; border:1px solid var(--line);">
      <div>
        <div class="sub">Ciclos concluídos</div>
        <div style="font-size:20px">${dots}</div>
      </div>
      <div>
        <div class="sub">Foco acumulado</div>
        <b>${formatDuration(timer.pomodoro.accumulatedFocusMinutes)}</b>
      </div>
      <div>
        <div class="sub">Próxima pausa longa</div>
        <b>em ${4 - (timer.pomodoro.completedCycles % 4)} ciclo(s)</b>
      </div>
    </div>
  `;
}

function renderHistorySection() {
  const currentMonth = getTodayIso().slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const entriesThisMonth = getUnifiedHistoryEntries().filter(e => (e.date || "").startsWith(currentMonth));

  const groups = {};
  entriesThisMonth.forEach(e => {
    groups[e.cat] = groups[e.cat] || [];
    groups[e.cat].push(e);
  });

  const subjectNames = Object.keys(groups).sort(sortAlpha);

  const applyPartialBlur = (text) => {
    if (!activeBlurMode) return escapeHtml(text);
    return text.split(/(\s+)/).map((word, i) => {
      if (!word.trim()) return word;
      const keepVisible = word.length <= 2 || (word.length + i) % 4 === 0;
      return keepVisible ? escapeHtml(word) : `<span class="b-w">${escapeHtml(word)}</span>`;
    }).join("");
  };

  const groupsHtml = subjectNames.map(cat => {
    const list = groups[cat];
    const color = store.getSubjectColor(cat);
    const totalMinutes = list.reduce((sum, e) => sum + (e.sess ? Number(e.sess.min) || 0 : 0), 0);

    let lastRenderedDate = "";
    const itemsHtml = list.map(entry => {
      const isNewDateHeader = entry.date !== lastRenderedDate
        ? (lastRenderedDate = entry.date, `<div class="hdate" style="margin-top:16px; margin-bottom:8px; font-size:11px; font-weight:700; color:var(--mu); letter-spacing:1px;">${entry.date === getTodayIso() ? "HOJE" : formatDateBr(entry.date)}</div>`)
        : "";

      if (entry.key === editingHistoryKey) {
        return `
          ${isNewDateHeader}
          <div class="item" style="padding:12px; border:1px solid rgba(255,255,255,0.05); border-radius:8px; background:rgba(0,0,0,0.2); margin-bottom:8px;">
            <div class="t">
              <div class="row">
${renderSubjectDropdown('eh-c', 'Matéria', entry.cat, store.getSubjects())}
                ${entry.sess ? `<input id="eh-m" type="number" step="any" value="${entry.sess.min}" placeholder="Minutos">` : ""}
                <input id="eh-d" type="date" value="${entry.date}">
              </div>
              ${entry.log ? `
                <div class="row">
                  <input id="eh-t" value="${escapeHtml(entry.log.topic)}" placeholder="Tópico *">
                </div>
                <textarea id="eh-w" rows="3" placeholder="O que você estudou? *" style="margin-bottom:8px">${escapeHtml(entry.log.what)}</textarea>
              ` : ""}
              <div style="display:flex;gap:8px">
                <button class="btn" onclick="window.studai.saveHistoryEntry('${entry.key}')">Salvar</button>
                <button class="btn o" onclick="window.studai.cancelHistoryEdit()">Cancelar</button>
              </div>
            </div>
          </div>
        `;
      }

      const blurClass = activeBlurMode ? "blur-box" : "";
      const blurAction = activeBlurMode ? `onclick="this.classList.toggle('revealed')"` : "";
      const tooltip = activeBlurMode ? `title="Toque para revelar o conteúdo"` : "";

      // Item ultra-minimalista com anotações recolhíveis
      return `
        ${isNewDateHeader}
        <div class="item" style="border: 1px solid rgba(255,255,255,0.03); background: rgba(255,255,255,0.01); border-radius: 8px; margin-bottom: 8px; padding: 12px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom: ${entry.log ? '6px' : '0'}; flex-wrap:wrap;">
                ${entry.sess ? `<span class="tag" style="border-color:${color}; color:${color}; background:transparent; padding:2px 6px; font-size:11px; margin:0;">${formatDuration(entry.sess.min)}</span>` : ""}
                ${entry.log ? `<b style="font-size:14.5px; color:#e4e4e7;">${escapeHtml(entry.log.topic)}</b>` : `<span class="sub" style="font-size:13px;">Ajuste manual de tempo</span>`}
              </div>
              
              ${entry.log && entry.log.what ? `
                <details style="margin-top:8px;">
                  <summary style="cursor:pointer; outline:none; font-size:12px; color:var(--mu); font-weight:600; list-style:none; display:inline-flex; align-items:center; gap:4px; transition:color 0.2s;" onmouseover="this.style.color='#a1a1aa'" onmouseout="this.style.color='var(--mu)'">
                    Ler anotações detalhadas ▾
                  </summary>
                  <div class="hwhat ${blurClass}" ${blurAction}${tooltip} style="margin-top:10px; font-size:13.5px; line-height:1.6; color:#a1a1aa; padding-left:12px; border-left:2px solid rgba(255,255,255,0.05);">
                    ${applyPartialBlur(entry.log.what).replace(/\n/g, '<br>')}
                  </div>
                </details>
              ` : ""}
            </div>
            
            <div class="hact" style="display:flex; gap:4px;">
              <button class="gbtn" title="Editar" onclick="window.studai.startEditHistoryEntry('${entry.key}')" style="background:transparent; border:none; color:#71717a; cursor:pointer; font-size:14px;">✎</button>
              <button class="gbtn x" title="Apagar" onclick="window.studai.deleteHistoryEntry('${entry.key}')" style="background:transparent; border:none; color:#71717a; cursor:pointer; font-size:14px;">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // O "open" foi removido daqui para as matérias ficarem fechadas por padrão
    return `
      <details class="hgrp" style="border-left:4px solid ${color}; background:rgba(255,255,255,0.02); border-radius:0 8px 8px 0; margin-bottom:8px; padding:14px; transition:background 0.2s;">
        <summary style="cursor:pointer; outline:none; display:flex; justify-content:space-between; align-items:center; list-style:none; width:100%;">
          
          <!-- Lado Esquerdo: Nome da Matéria e Tempo -->
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="color-dot" style="background:${color}; margin:0;"></i>
            <b style="color:${color}; font-size:15px;">${escapeHtml(cat)}</b>
            <span class="tag" style="border-color:${color}; color:${color}; margin:0; padding:2px 8px; background:transparent;">${formatDuration(totalMinutes)}</span>
          </div>
          
          <!-- Lado Direito: Quantidade de Registros -->
          <div class="sub" style="font-size:12px; white-space:nowrap;">
            ${list.length} ${list.length === 1 ? "registro" : "registros"} ▾
          </div>
          
        </summary>
        
        <div style="margin-top:16px;">
          ${itemsHtml}
        </div>
      </details>
    `;
  }).join("");

  const totalStudiedMinutesMonth = entriesThisMonth.reduce((sum, e) => sum + (e.sess ? Number(e.sess.min) || 0 : 0), 0);

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <h3 style="margin:0">Estudado em <span style="text-transform:capitalize">${escapeHtml(currentMonthName)}</span></h3>
          <div class="sub" style="display:flex; gap:14px; margin-top:4px;">
            <span><b style="color:var(--tx)">${formatDuration(totalStudiedMinutesMonth)}</b> de estudo</span>
            <span>${entriesThisMonth.length} registros</span>
            <span>${subjectNames.length} matérias</span>
          </div>
        </div>
        <button class="btn o" style="padding:6px 14px; font-size:12px; border-radius:8px;" onclick="window.studai.toggleBlurMode()">
          ${activeBlurMode ? "👁️ Desativar Revisão Ativa" : "🫣 Ativar Revisão (Borrão)"}
        </button>
      </div>
      ${groupsHtml || `<div class="empty">Nenhum estudo registrado neste mês ainda.</div>`}
    </div>
  `;
}

function getFlashcardsDeck() {
  const currentMonthStart = getTodayIso().slice(0, 7) + "-01";
  const deck = (store.state.logs || []).filter(l =>
    l.date < currentMonthStart &&
    l.topic &&
    l.what &&
    (!flashcardState.category || (l.cat || "Geral") === flashcardState.category)
  );

  deck.sort((a, b) => sortAlpha(a.cat || "Geral", b.cat || "Geral") || b.date.localeCompare(a.date));

  if (flashcardState.shuffledOrder) {
    const orderMap = new Map(flashcardState.shuffledOrder.map((id, idx) => [id, idx]));
    deck.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
  }

  return deck;
}

function renderFlashcardsSection() {
  const currentMonthStart = getTodayIso().slice(0, 7) + "-01";
  const pastSubjects = [...new Set(
    (store.state.logs || [])
      .filter(l => l.date < currentMonthStart && l.topic && l.what)
      .map(l => l.cat || "Geral")
  )].sort(sortAlpha);

  const deck = getFlashcardsDeck();
  if (flashcardState.index >= deck.length) flashcardState.index = 0;
  const currentCard = deck[flashcardState.index];

  let cardContentHtml = `<div class="empty">Ainda não há estudos de meses anteriores para virar flashcards.</div>`;

  if (currentCard) {
    const color = store.getSubjectColor(currentCard.cat || "Geral");
    cardContentHtml = `
      <div class="sub" style="text-align:center">
        Cartão ${flashcardState.index + 1} de ${deck.length} · Estudado em ${formatDateBr(currentCard.date)}
      </div>
      <div class="fcard" onclick="window.studai.flipFlashcard()">
        <span class="tag" style="border-color:${color};color:${color};margin:0">${escapeHtml(currentCard.cat || "Geral")}</span>
        ${flashcardState.isFlipped
        ? `<div style="font-size:15px; line-height:1.6;">${escapeHtml(currentCard.what)}</div>`
        : `<div style="font-size:20px; font-weight:700;">${escapeHtml(currentCard.topic)}</div><div class="sub">Toque para ver o que você aprendeu</div>`
      }
      </div>
      <div class="row">
        <button class="btn o" onclick="window.studai.moveFlashcard(-1)">← Anterior</button>
        <button class="btn" onclick="window.studai.flipFlashcard()">${flashcardState.isFlipped ? "Ver pergunta" : "Virar resposta"}</button>
        <button class="btn o" onclick="window.studai.moveFlashcard(1)">Próximo →</button>
      </div>
    `;
  }

  return `
    <div class="card">
      <h3>🃏 Flashcards de meses passados (Revisão Espaçada)</h3>
      <div class="row">
        <select onchange="window.studai.setFlashcardCategory(this.value)">
          <option value="">Todas as matérias</option>
          ${pastSubjects.map(c => `<option ${c === flashcardState.category ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
        <button class="btn o" onclick="window.studai.shuffleFlashcards()">🔀 Embaralhar</button>
      </div>
      ${cardContentHtml}
    </div>
  `;
}

export function renderTimer() {
  const subjects = store.getSubjects();
  const datalistHtml = `<datalist id="cats">${subjects.map(s => `<option value="${escapeHtml(s.name)}">`).join("")}</datalist>`;

  const modeSwitcherHtml = `
    <div style="display:flex; background:rgba(0,0,0,0.4); border:1px solid var(--line); border-radius:14px; padding:4px; margin: 0 auto 20px; max-width: 400px;">
      <button style="flex:1; padding:9px; border-radius:10px; border:none; cursor:pointer; font-weight:600; font-family:var(--font); font-size:13.5px; transition:all 0.25s; ${timer.mode === "prog" ? "background:rgba(255,255,255,0.12); color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.3);" : "background:transparent; color:var(--mu);"}" onclick="window.studai.setTimerMode('prog')">
        ⏱️ Cronômetro
      </button>
      <button style="flex:1; padding:9px; border-radius:10px; border:none; cursor:pointer; font-weight:600; font-family:var(--font); font-size:13.5px; transition:all 0.25s; ${timer.mode === "pomo" ? "background:rgba(255,255,255,0.12); color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.3);" : "background:transparent; color:var(--mu);"}" onclick="window.studai.setTimerMode('pomo')">
        🍅 Pomodoro
      </button>
    </div>
  `;

  const activeTimerUi = timer.mode === "prog" ? renderStopwatchUI() : renderPomodoroUI();

  const smartPipBarHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; background:rgba(45,255,122,0.05); border:1px solid rgba(45,255,122,0.2); border-radius:var(--radius-md); padding:10px 14px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">⚡</span>
        <div>
          <b style="font-size:13px; color:var(--tx);">Pop-up Flutuante Inteligente (PiP HUD)</b>
          <div class="sub" style="font-size:11.5px;">Abre uma mini-janela no topo de outros aplicativos e abas enquanto você estuda.</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;" title="Abrir pop-up automaticamente ao alternar abas ou aplicativos">
          <input type="checkbox" ${timer.autoPipEnabled ? "checked" : ""} onchange="window.studai.toggleAutoPip(this.checked)" style="width:16px; height:16px; accent-color:var(--g); cursor:pointer;">
          <span class="sub" style="font-size:12px; font-weight:600; color:var(--tx);">Auto ao sair</span>
        </label>
        <button class="btn o" style="font-size:12px; padding:6px 14px;" onclick="window.studai.togglePip()">
          ${timer.pipWindow ? "✖ Fechar HUD" : "🗗 Abrir Pop-up"}
        </button>
      </div>
    </div>
  `;

  const activeTimerCardHtml = `
    <div class="card">
      ${modeSwitcherHtml}
      ${smartPipBarHtml}
      ${datalistHtml}
      ${activeTimerUi}
      <hr style="border:0; border-top:1px solid var(--line); margin: 20px 0;">
      <div class="row">
${renderSubjectDropdown('sc', 'Matéria *', timer.form.category, subjects, "window.studai.setTimerFormField('category', this.value)")}        <input id="st" placeholder="Tópico aprendido *" value="${escapeHtml(timer.form.topic)}" oninput="window.studai.setTimerFormField('topic', this.value)">
      </div>
      <textarea id="sw" rows="3" placeholder="O que você estudou nesse tópico? *" oninput="window.studai.setTimerFormField('notes', this.value)" style="margin-bottom:8px">${escapeHtml(timer.form.notes)}</textarea>
      <div class="sub">* Campos obrigatórios para salvar a sessão no histórico e pontuar XP.</div>
    </div>
  `;

  const manualEntryCardHtml = `
    <div class="card">
      <h3>Adicionar sessão manualmente</h3>
      <div class="row">
${renderSubjectDropdown('mc', 'Matéria *', timer.manualForm.category, subjects, "window.studai.setManualFormField('category', this.value)")}        <input id="mm" type="number" min="1" placeholder="Minutos *" value="${escapeHtml(timer.manualForm.minutes)}" oninput="window.studai.setManualFormField('minutes', this.value)">
        <input id="md" type="date" value="${timer.manualForm.date || getTodayIso()}" oninput="window.studai.setManualFormField('date', this.value)">
      </div>
      <div class="row">
        <input id="mt" placeholder="Tópico aprendido *" value="${escapeHtml(timer.manualForm.topic)}" oninput="window.studai.setManualFormField('topic', this.value)">
      </div>
      <div class="row">
        <button class="btn" onclick="window.studai.addManualSession()">Registrar sessão</button>
      </div>
      <textarea id="mw" rows="2" placeholder="O que você estudou desse tópico? *" oninput="window.studai.setManualFormField('notes', this.value)" style="margin-bottom:8px">${escapeHtml(timer.manualForm.notes)}</textarea>
    </div>
  `;

  return activeTimerCardHtml + manualEntryCardHtml + renderHistorySection() + renderFlashcardsSection();
}
