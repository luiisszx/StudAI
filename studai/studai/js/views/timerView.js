/**
 * StudAI — Timer View (Tempo, Histórico e Flashcards)
 */
import { store } from "../store.js";
import { timer } from "../timer.js";
import { escapeHtml, formatDuration, getTodayIso, formatDateBr, sortAlpha } from "../utils.js";
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
        ? (lastRenderedDate = entry.date, `<div class="hdate">${entry.date === getTodayIso() ? "HOJE" : formatDateBr(entry.date)}</div>`)
        : "";

      if (entry.key === editingHistoryKey) {
        return `
          ${isNewDateHeader}
          <div class="item">
            <div class="t">
              <div class="row">
                <input id="eh-c" list="cats" value="${escapeHtml(entry.cat)}" placeholder="Matéria">
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

      return `
        ${isNewDateHeader}
        <div class="item">
          <div class="t">
            <div class="hline">
              ${entry.sess ? `<span class="tag" style="border-color:${color};color:#fff;background:rgba(0,0,0,0.4)">${formatDuration(entry.sess.min)}</span>` : ""}
              ${entry.log ? `<b>${escapeHtml(entry.log.topic)}</b>` : `<span class="sub">Ajuste manual de tempo</span>`}
            </div>
            ${entry.log ? `<div class="hwhat ${blurClass}" ${blurAction} ${tooltip}>${applyPartialBlur(entry.log.what)}</div>` : ""}
          </div>
          <div class="hact">
            <button class="gbtn" title="Editar" onclick="window.studai.startEditHistoryEntry('${entry.key}')">✎</button>
            <button class="gbtn x" title="Apagar" onclick="window.studai.deleteHistoryEntry('${entry.key}')">✕</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <details class="hgrp" open style="border-left:4px solid ${color}">
        <summary>
          <i class="color-dot" style="background:${color}"></i>
          <b style="color:${color}">${escapeHtml(cat)}</b>
          <span class="tag" style="border-color:${color};color:#fff;margin:0 0 0 8px;background:rgba(0,0,0,0.4)">${formatDuration(totalMinutes)}</span>
          <span class="sub" style="margin-left:auto">${list.length} ${list.length === 1 ? "registro" : "registros"}</span>
        </summary>
        ${itemsHtml}
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

  const activeTimerCardHtml = `
    <div class="card">
      ${modeSwitcherHtml}
      ${datalistHtml}
      ${activeTimerUi}
      <hr style="border:0; border-top:1px solid var(--line); margin: 20px 0;">
      <div class="row">
        <input id="sc" list="cats" placeholder="Matéria *" value="${escapeHtml(timer.form.category)}" oninput="window.studai.setTimerFormField('category', this.value)">
        <input id="st" placeholder="Tópico aprendido *" value="${escapeHtml(timer.form.topic)}" oninput="window.studai.setTimerFormField('topic', this.value)">
      </div>
      <textarea id="sw" rows="3" placeholder="O que você estudou nesse tópico? *" oninput="window.studai.setTimerFormField('notes', this.value)" style="margin-bottom:8px">${escapeHtml(timer.form.notes)}</textarea>
      <div class="sub">* Campos obrigatórios para salvar a sessão no histórico e pontuar XP.</div>
    </div>
  `;

  const manualEntryCardHtml = `
    <div class="card">
      <h3>Adicionar sessão manualmente</h3>
      <div class="row">
        <input id="mc" list="cats" placeholder="Matéria *" value="${escapeHtml(timer.manualForm.category)}" oninput="window.studai.setManualFormField('category', this.value)">
        <input id="mm" type="number" min="1" placeholder="Minutos *" value="${escapeHtml(timer.manualForm.minutes)}" oninput="window.studai.setManualFormField('minutes', this.value)">
        <input id="md" type="date" value="${timer.manualForm.date || getTodayIso()}" oninput="window.studai.setManualFormField('date', this.value)">
      </div>
      <div class="row">
        <input id="mt" placeholder="Tópico aprendido *" value="${escapeHtml(timer.manualForm.topic)}" oninput="window.studai.setManualFormField('topic', this.value)">
      </div>
      <div class="row">
        <button class="btn" onclick="window.studai.addManualSession()">Registrar sessão</button>
        <button class="btn o" onclick="window.studai.togglePip()">${timer.pipWindow ? "✖ Fechar pop-up" : "🗗 Pop-up flutuante"}</button>
      </div>
      <textarea id="mw" rows="2" placeholder="O que você estudou desse tópico? *" oninput="window.studai.setManualFormField('notes', this.value)" style="margin-bottom:8px">${escapeHtml(timer.manualForm.notes)}</textarea>
    </div>
  `;

  return activeTimerCardHtml + manualEntryCardHtml + renderHistorySection() + renderFlashcardsSection();
}
