/**
 * StudAI — Timer View (Tempo, Foco, Soundscapes, Histórico & Flashcards)
 */
import { store } from "../store.js";
import { timer } from "../timer.js";
import { escapeHtml, formatDuration, getTodayIso, formatDateBr, sortAlpha, renderSubjectDropdown } from "../utils.js";
import { sounds } from "../audio.js";

export let activeBlurMode = false;
export let editingHistoryKey = null;
export let isCreatingFlashcard = false;
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

export function toggleCreateFlashcard(open = null) {
  isCreatingFlashcard = open !== null ? open : !isCreatingFlashcard;
}

// Combina sessões e tópicos de histórico
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
    <div class="row" style="justify-content:center; gap:12px; margin-top:14px;">
      <button class="btn" onclick="window.studai.toggleStopwatch()" style="min-width:140px;">
        ${timer.stopwatch.isRunning ? "⏸ Pausar" : "▶ Iniciar"}
      </button>
      <button class="btn o" onclick="window.studai.saveStopwatch()">
        ✔ Finalizar e Salvar (+XP)
      </button>
    </div>
    <div class="shortcuts-bar">
      <span><kbd class="kbd">Espaço</kbd> Pausar/Iniciar</span>
      <span><kbd class="kbd">Z</kbd> Modo Foco Total</span>
    </div>
  `;
}

function renderPomodoroUI() {
  const phase = timer.pomodoro.phase;
  const isFocus = phase === "foco";
  const isLong = phase === "longa";

  const phaseTitle = isFocus ? "🍅 Bloco de Foco" : isLong ? "🛋️ Pausa Longa" : "☕ Pausa Curta";
  const phaseColor = isFocus ? "var(--red)" : "var(--g)";

  const mm = String(Math.floor(timer.pomodoro.secondsLeft / 60)).padStart(2, "0");
  const ss = String(timer.pomodoro.secondsLeft % 60).padStart(2, "0");

  const perm = "Notification" in window ? Notification.permission : "unsupported";
  const notifButtonHtml = perm === "granted"
    ? `<span class="tag" style="margin:0">🔔 Notificações ativas</span>`
    : perm === "denied"
      ? `<span class="sub">Notificações bloqueadas no navegador.</span>`
      : `<button class="btn o" style="font-size:12px; padding:4px 10px;" onclick="window.studai.requestNotif()">🔔 Ativar Notificações</button>`;

  const dots = timer.pomodoro.completedCycles > 0
    ? "🍅 ".repeat(Math.min(timer.pomodoro.completedCycles, 10))
    : "—";

  return `
    <div class="sub" style="text-align:center; font-weight:800; color:${phaseColor}; font-size:15px; letter-spacing:0.5px;">
      ${phaseTitle}
    </div>
    <div class="timer" id="ptmr_main">${mm}:${ss}</div>
    <div class="row" style="justify-content:center; gap:12px;">
      <button class="btn" style="background:${phaseColor}; color:#000; min-width:130px;" onclick="window.studai.togglePomodoro()">
        ${timer.pomodoro.isRunning ? "⏸ Pausar" : "▶ Iniciar Foco"}
      </button>
      <button class="btn o" onclick="window.studai.skipPomodoro()">⏭ Pular Fase</button>
      <button class="btn o" onclick="window.studai.savePomodoro()">✔ Salvar Sessão</button>
    </div>

    <div class="row" style="margin-top:16px;">
      <div style="flex:1; min-width:100px;">
        <label class="sub" style="display:block; margin-bottom:4px; font-weight:600;">Minutos Foco</label>
        <input type="number" min="1" value="${timer.pomodoro.focusMinutes}" onchange="window.studai.configPomodoro({ focus: this.value })">
      </div>
      <div style="flex:1; min-width:100px;">
        <label class="sub" style="display:block; margin-bottom:4px; font-weight:600;">Pausa Curta</label>
        <input type="number" min="1" value="${timer.pomodoro.breakMinutes}" onchange="window.studai.configPomodoro({ shortBreak: this.value })">
      </div>
      <div style="flex:1; min-width:100px;">
        <label class="sub" style="display:block; margin-bottom:4px; font-weight:600;">Pausa Longa</label>
        <input type="number" min="1" value="${timer.pomodoro.longBreakMinutes}" onchange="window.studai.configPomodoro({ longBreak: this.value })">
      </div>
    </div>

    <div class="row" style="align-items:center; justify-content:space-between; margin-top:8px;">
      <label class="sub" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" ${timer.pomodoro.autoNextPhase ? "checked" : ""} onchange="window.studai.configPomodoro({ autoNext: this.checked })" style="width:16px; height:16px; accent-color:var(--g); cursor:pointer;">
        Iniciar próxima fase automaticamente
      </label>
      <div>${notifButtonHtml}</div>
    </div>

    <div class="row" style="align-items:center; justify-content:space-around; margin-top:12px; background:rgba(0,0,0,0.25); padding:12px; border-radius:10px; border:1px solid var(--line);">
      <div style="text-align:center;">
        <div class="sub">Ciclos Concluídos</div>
        <div style="font-size:16px; margin-top:2px;">${dots}</div>
      </div>
      <div style="text-align:center;">
        <div class="sub">Foco Acumulado</div>
        <b style="color:var(--g); font-size:15px;">${formatDuration(timer.pomodoro.accumulatedFocusMinutes)}</b>
      </div>
      <div style="text-align:center;">
        <div class="sub">Próxima Pausa Longa</div>
        <b>em ${4 - (timer.pomodoro.completedCycles % 4)} ciclo(s)</b>
      </div>
    </div>
  `;
}

function renderSoundscapesWidget() {
  const state = sounds.getAmbientState();
  const currentType = state.type;
  const isPlaying = state.isPlaying;
  const volPct = Math.round((state.volume || 0.3) * 100);

  return `
    <div class="soundscape-box">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:18px;">🎧</span>
        <div>
          <b style="font-size:13px; color:var(--tx-bright);">Sons de Foco Sintetizados (Sem Anúncios / Offline)</b>
          <div class="sub" style="font-size:11.5px;">Áudio gerado em tempo real com Web Audio API para bloquear distrações.</div>
        </div>
      </div>

      <div class="sound-options">
        <button class="sound-pill ${isPlaying && currentType === 'rain' ? 'active' : ''}" onclick="window.studai.toggleSoundscapes('rain')">
          🌧️ Chuva Relaxante
        </button>
        <button class="sound-pill ${isPlaying && currentType === 'white' ? 'active' : ''}" onclick="window.studai.toggleSoundscapes('white')">
          🌊 Ruído Branco
        </button>
        <button class="sound-pill ${isPlaying && currentType === 'binaural' ? 'active' : ''}" onclick="window.studai.toggleSoundscapes('binaural')">
          🧠 Frequência 40Hz
        </button>
      </div>

      <div class="volume-control">
        <span style="font-size:11px; color:var(--mu);">Vol: ${volPct}%</span>
        <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="${state.volume || 0.3}" oninput="window.studai.setSoundVolume(this.value)">
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
        ? (lastRenderedDate = entry.date, `<div class="hdate" style="margin-top:14px; margin-bottom:6px; font-size:11px; font-weight:700; color:var(--mu); letter-spacing:1px;">${entry.date === getTodayIso() ? "HOJE" : formatDateBr(entry.date)}</div>`)
        : "";

      if (entry.key === editingHistoryKey) {
        return `
          ${isNewDateHeader}
          <div class="item" style="padding:14px; border:1px solid var(--line); border-radius:10px; background:rgba(0,0,0,0.3); margin-bottom:8px;">
            <div class="t">
              <div class="row">
                ${renderSubjectDropdown('eh-c', 'Matéria', entry.cat, store.getSubjects())}
                ${entry.sess ? `<input id="eh-m" type="number" step="any" value="${entry.sess.min}" placeholder="Minutos" style="max-width:120px;">` : ""}
                <input id="eh-d" type="date" value="${entry.date}" style="max-width:160px;">
              </div>
              ${entry.log ? `
                <div class="row">
                  <input id="eh-t" value="${escapeHtml(entry.log.topic)}" placeholder="Tópico aprendido *">
                </div>
                <textarea id="eh-w" rows="3" placeholder="O que você estudou? *" style="margin-bottom:8px;">${escapeHtml(entry.log.what)}</textarea>
              ` : ""}
              <div style="display:flex; gap:8px;">
                <button class="btn" onclick="window.studai.saveHistoryEntry('${entry.key}')">Salvar</button>
                <button class="btn o" onclick="window.studai.cancelHistoryEdit()">Cancelar</button>
              </div>
            </div>
          </div>
        `;
      }

      const blurClass = activeBlurMode ? "blur-box" : "";
      const blurAction = activeBlurMode ? `onclick="this.classList.toggle('revealed')"` : "";
      const tooltip = activeBlurMode ? `title="Clique para revelar o conteúdo"` : "";

      return `
        ${isNewDateHeader}
        <div class="item" style="border:1px solid var(--line-light); background:rgba(255,255,255,0.015); border-radius:8px; margin-bottom:8px; padding:12px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; width:100%;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:${entry.log ? '6px' : '0'}; flex-wrap:wrap;">
                ${entry.sess ? `<span class="tag" style="border-color:${color}; color:${color}; margin:0; font-size:11px;">${formatDuration(entry.sess.min)}</span>` : ""}
                ${entry.log ? `<b style="font-size:14px; color:#fff;">${escapeHtml(entry.log.topic)}</b>` : `<span class="sub" style="font-size:13px;">Ajuste manual de tempo</span>`}
              </div>
              
              ${entry.log && entry.log.what ? `
                <details style="margin-top:6px;">
                  <summary style="cursor:pointer; outline:none; font-size:12px; color:var(--mu); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                    Ver anotações detalhadas ▾
                  </summary>
                  <div class="hwhat ${blurClass}" ${blurAction}${tooltip} style="margin-top:8px; font-size:13px; line-height:1.55; color:var(--tx); padding-left:12px; border-left:2px solid ${color};">
                    ${applyPartialBlur(entry.log.what).replace(/\n/g, '<br>')}
                  </div>
                </details>
              ` : ""}
            </div>
            
            <div class="hact" style="display:flex; gap:4px;">
              <button class="gbtn" title="Editar" onclick="window.studai.startEditHistoryEntry('${entry.key}')">✎</button>
              <button class="gbtn x" title="Apagar" onclick="window.studai.deleteHistoryEntry('${entry.key}')">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <details class="hgrp" style="border-left:4px solid ${color}; background:rgba(255,255,255,0.02); border-radius:0 10px 10px 0; margin-bottom:10px; padding:12px 16px;">
        <summary style="cursor:pointer; outline:none; display:flex; justify-content:space-between; align-items:center; list-style:none;">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="color-dot" style="background:${color};"></i>
            <b style="color:${color}; font-size:14.5px;">${escapeHtml(cat)}</b>
            <span class="tag" style="border-color:${color}; color:${color}; margin:0; padding:2px 8px;">${formatDuration(totalMinutes)}</span>
          </div>
          <div class="sub" style="font-size:12px;">
            ${list.length} ${list.length === 1 ? "registro" : "registros"} ▾
          </div>
        </summary>
        
        <div style="margin-top:14px;">
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
          <h3 style="margin:0;">Histórico de Estudo em <span style="text-transform:capitalize">${escapeHtml(currentMonthName)}</span></h3>
          <div class="sub" style="display:flex; gap:14px; margin-top:4px;">
            <span><b style="color:var(--tx-bright);">${formatDuration(totalStudiedMinutesMonth)}</b> acumulados</span>
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

export function getFlashcardsDeck() {
  const allLogs = (store.state.logs || []).filter(l => l && l.topic && l.what);
  const deck = allLogs.filter(l => !flashcardState.category || (l.cat || "Geral") === flashcardState.category);

  deck.sort((a, b) => sortAlpha(a.cat || "Geral", b.cat || "Geral") || (b.date || "").localeCompare(a.date || ""));

  if (flashcardState.shuffledOrder && flashcardState.shuffledOrder.length > 0) {
    const orderMap = new Map(flashcardState.shuffledOrder.map((id, idx) => [id, idx]));
    deck.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
  }

  return deck;
}

function renderFlashcardsSection() {
  const subjectsWithNotes = [...new Set(
    (store.state.logs || [])
      .filter(l => l && l.topic && l.what)
      .map(l => l.cat || "Geral")
  )].sort(sortAlpha);

  const deck = getFlashcardsDeck();
  if (flashcardState.index >= deck.length) flashcardState.index = 0;
  if (flashcardState.index < 0) flashcardState.index = Math.max(0, deck.length - 1);
  const currentCard = deck[flashcardState.index];

  const createFlashcardFormHtml = isCreatingFlashcard ? `
    <div style="background:rgba(0,0,0,0.35); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:18px;">
      <h4 style="margin-bottom:10px; color:var(--g); font-size:13.5px;">+ Criar Novo Flashcard</h4>
      <div class="row">
        ${renderSubjectDropdown('qfc-cat', 'Matéria', flashcardState.category, store.getSubjects())}
        <input id="qfc-topic" placeholder="Frente do Cartão (Pergunta / Conceito / Fórmula) *" style="flex:2;">
      </div>
      <textarea id="qfc-what" rows="2" placeholder="Verso do Cartão (Resposta detalhada / Explicação) *" style="margin-bottom:10px;"></textarea>
      <div style="display:flex; gap:8px;">
        <button class="btn" onclick="window.studai.addQuickFlashcard()">Salvar Cartão (+20 XP)</button>
        <button class="btn o" onclick="window.studai.toggleCreateFlashcard(false)">Cancelar</button>
      </div>
    </div>
  ` : "";

  let cardContentHtml = `<div class="empty">Ainda não há flashcards nesta matéria. Crie um cartão abaixo ou registre sessões no timer!</div>`;

  if (currentCard) {
    const color = store.getSubjectColor(currentCard.cat || "Geral");
    cardContentHtml = `
      <div class="sub" style="text-align:center; margin-bottom:8px;">
        Cartão ${flashcardState.index + 1} de ${deck.length} · Registrado em ${formatDateBr(currentCard.date)}
      </div>
      <div class="fcard-wrap">
        <div class="fcard ${flashcardState.isFlipped ? 'flipped' : ''}" onclick="window.studai.flipFlashcard()">
          <span class="tag" style="border-color:${color}; color:${color}; position:absolute; top:14px; left:14px; margin:0;">
            ${escapeHtml(currentCard.cat || "Geral")}
          </span>
          ${flashcardState.isFlipped
        ? `<div style="font-size:15px; line-height:1.6; color:#d7f5df; max-width:540px;">${escapeHtml(currentCard.what)}</div>
               <div class="sub" style="margin-top:12px; color:var(--g);">✓ Toque para virar para a pergunta</div>`
        : `<div style="font-size:20px; font-weight:700; color:#fff; max-width:540px;">${escapeHtml(currentCard.topic)}</div>
               <div class="sub" style="margin-top:8px;">Toque para revelar a resposta 💡</div>`
      }
        </div>
      </div>
      <div class="row" style="justify-content:center; gap:10px; margin-top:12px;">
        <button class="btn o" onclick="window.studai.moveFlashcard(-1)">← Anterior</button>
        <button class="btn" onclick="window.studai.flipFlashcard()">${flashcardState.isFlipped ? "Ver Pergunta" : "Virar Resposta (F)"}</button>
        <button class="btn o" onclick="window.studai.moveFlashcard(1)">Próximo →</button>
      </div>
    `;
  }

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
        <h3 style="margin:0;">🃏 Flashcards de Revisão Ativa (${deck.length})</h3>
        <button class="btn o" style="font-size:12px; padding:6px 12px;" onclick="window.studai.toggleCreateFlashcard()">
          ${isCreatingFlashcard ? "Fechar" : "+ Novo Flashcard"}
        </button>
      </div>

      ${createFlashcardFormHtml}

      <div class="row" style="margin-bottom:14px;">
        <select onchange="window.studai.setFlashcardCategory(this.value)" style="flex:2;">
          <option value="">Todas as matérias (${(store.state.logs || []).filter(l => l && l.topic && l.what).length} cartões)</option>
          ${subjectsWithNotes.map(c => `<option value="${escapeHtml(c)}" ${c === flashcardState.category ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
        <button class="btn o" onclick="window.studai.shuffleFlashcards()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
          🔀 Embaralhar
        </button>
      </div>

      ${cardContentHtml}

      ${currentCard ? `
        <div class="shortcuts-bar">
          <span><kbd class="kbd">←</kbd> / <kbd class="kbd">J</kbd> Anterior</span>
          <span><kbd class="kbd">→</kbd> / <kbd class="kbd">K</kbd> Próximo</span>
          <span><kbd class="kbd">F</kbd> Virar Cartão</span>
        </div>
      ` : ''}
    </div>
  `;
}

export function renderTimer() {
  const subjects = store.getSubjects();

  const modeSwitcherHtml = `
    <div style="display:flex; background:rgba(0,0,0,0.4); border:1px solid var(--line); border-radius:14px; padding:4px; margin: 0 auto 20px; max-width: 400px;">
      <button style="flex:1; padding:9px; border-radius:10px; border:none; cursor:pointer; font-weight:700; font-family:var(--font); font-size:13.5px; transition:all 0.25s; ${timer.mode === "prog" ? "background:linear-gradient(135deg, #4fff97, #10b981); color:#03140a; box-shadow:0 4px 12px rgba(45,255,122,0.3);" : "background:transparent; color:var(--mu);"}" onclick="window.studai.setTimerMode('prog')">
        ⏱️ Cronômetro
      </button>
      <button style="flex:1; padding:9px; border-radius:10px; border:none; cursor:pointer; font-weight:700; font-family:var(--font); font-size:13.5px; transition:all 0.25s; ${timer.mode === "pomo" ? "background:linear-gradient(135deg, #f43f5e, #e11d48); color:#fff; box-shadow:0 4px 12px rgba(244,63,94,0.3);" : "background:transparent; color:var(--mu);"}" onclick="window.studai.setTimerMode('pomo')">
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
          <b style="font-size:13px; color:var(--tx-bright);">Pop-up Flutuante Inteligente (PiP HUD)</b>
          <div class="sub" style="font-size:11.5px;">Mini-janela Always-On-Top flutuando no topo de outros aplicativos enquanto você estuda.</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;" title="Abrir pop-up automaticamente ao alternar abas ou aplicativos">
          <input type="checkbox" ${timer.autoPipEnabled ? "checked" : ""} onchange="window.studai.toggleAutoPip(this.checked)" style="width:16px; height:16px; accent-color:var(--g); cursor:pointer;">
          <span class="sub" style="font-size:12px; font-weight:600; color:var(--tx-bright);">Auto ao sair</span>
        </label>
        <button class="btn o" style="font-size:12px; padding:6px 14px;" onclick="window.studai.togglePip()">
          ${timer.pipWindow ? "✖ Fechar HUD" : "🗗 Abrir Pop-up"}
        </button>
      </div>
    </div>
  `;

  const savedScratchpad = localStorage.getItem("studai_hud_scratchpad") || "";

  const activeTimerCardHtml = `
    <div class="card">
      ${modeSwitcherHtml}
      ${renderSoundscapesWidget()}
      ${smartPipBarHtml}
      ${activeTimerUi}

      <!-- Bloco de Notas Rápidas de Foco -->
      <div class="scratchpad-container">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:700; color:var(--g); text-transform:uppercase; letter-spacing:0.5px;">
            📝 Bloco de Rascunho Rápido (Auto-Save)
          </span>
          <span class="sub" style="font-size:10.5px;">Salvo automaticamente neste navegador</span>
        </div>
        <textarea class="scratchpad-textarea" placeholder="Anote fórmulas, pensamentos, tópicos ou dúvidas temporárias durante a sessão..." oninput="window.studai.saveScratchpad(this.value)">${escapeHtml(savedScratchpad)}</textarea>
      </div>

      <hr style="border:0; border-top:1px solid var(--line); margin: 20px 0;">
      
      <h4 style="font-size:14px; margin-bottom:10px;">Finalizar e Registrar Sessão:</h4>
      <div class="row">
        ${renderSubjectDropdown('sc', 'Matéria *', timer.form.category, subjects, "window.studai.setTimerFormField('category', this.value)")}
        <input id="st" placeholder="Tópico aprendido *" value="${escapeHtml(timer.form.topic)}" oninput="window.studai.setTimerFormField('topic', this.value)">
      </div>
      <textarea id="sw" rows="3" placeholder="O que você aprendeu ou praticou nesse tópico? *" oninput="window.studai.setTimerFormField('notes', this.value)" style="margin-bottom:8px;">${escapeHtml(timer.form.notes)}</textarea>
      <div class="sub">* Preencha para salvar no histórico, criar flashcards automáticos e pontuar XP.</div>
    </div>
  `;

  const manualEntryCardHtml = `
    <div class="card">
      <h3>Adicionar Sessão Manualmente</h3>
      <div class="row">
        ${renderSubjectDropdown('mc', 'Matéria *', timer.manualForm.category, subjects, "window.studai.setManualFormField('category', this.value)")}
        <input id="mm" type="number" min="1" placeholder="Minutos *" value="${escapeHtml(timer.manualForm.minutes)}" oninput="window.studai.setManualFormField('minutes', this.value)">
        <input id="md" type="date" value="${timer.manualForm.date || getTodayIso()}" oninput="window.studai.setManualFormField('date', this.value)">
      </div>
      <div class="row">
        <input id="mt" placeholder="Tópico aprendido *" value="${escapeHtml(timer.manualForm.topic)}" oninput="window.studai.setManualFormField('topic', this.value)">
      </div>
      <textarea id="mw" rows="2" placeholder="O que você estudou nesse tópico? *" oninput="window.studai.setManualFormField('notes', this.value)" style="margin-bottom:12px;">${escapeHtml(timer.manualForm.notes)}</textarea>
      <div class="row">
        <button class="btn" onclick="window.studai.addManualSession()">Registrar Sessão (+XP)</button>
      </div>
    </div>
  `;

  return activeTimerCardHtml + manualEntryCardHtml + renderHistorySection() + renderFlashcardsSection();
}
