/**
 * StudAI — Timer & Pomodoro Engine (Clean Code)
 */
import { sounds } from "./audio.js";
import { store } from "./store.js";
import { showToast, escapeHtml } from "./utils.js";

class TimerEngine {
  constructor() {
    this.mode = "prog"; // 'prog' (cronômetro) or 'pomo' (pomodoro)

    // Stopwatch state
    this.stopwatch = {
      isRunning: false,
      startTime: 0,
      accumulatedMinutes: 0
    };

    // Pomodoro state
    this.pomodoro = {
      isRunning: false,
      endTime: 0,
      phase: "foco", // 'foco', 'pausa', 'longa'
      secondsLeft: 25 * 60,
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      completedCycles: 0,
      accumulatedFocusMinutes: 0,
      autoNextPhase: true
    };

    // Input fields state (preserved across tab switches)
    this.form = {
      category: "",
      topic: "",
      notes: ""
    };

    this.manualForm = {
      category: "",
      minutes: "",
      date: "",
      topic: "",
      notes: ""
    };

    // Picture-in-picture window & smart auto-pip state
    this.pipWindow = null;
    this.pipInterval = null;
    this.autoPipEnabled = true;
    try {
      this.autoPipEnabled = localStorage.getItem("studai_auto_pip") !== "false";
    } catch {}
    this.pipCompactMode = false;
    this.aiQuotes = [
      { text: "Zona de foco profundo ativada.", icon: "🎯" },
      { text: "Seu cérebro absorve melhor sem alternar janelas.", icon: "🧠" },
      { text: "Cada minuto dedicado aqui constrói seu resultado.", icon: "🚀" },
      { text: "Mantenha a postura ereta e respire fundo.", icon: "🧘" },
      { text: "Beba água para manter a clareza mental.", icon: "💧" },
      { text: "Consistência diária supera intensidade esporádica!", icon: "⚡" },
      { text: "Pausa merecida! Afaste os olhos da tela por 20s.", icon: "☕" }
    ];
    this.currentQuoteIndex = 0;

    // Start background tick
    this.interval = setInterval(() => this.tick(), 500);

    // Setup auto-pip listeners
    this.setupAutoPipListeners();
  }

  // --- Stopwatch Methods ---

  getStopwatchElapsedMinutes() {
    if (!this.stopwatch.isRunning) {
      return this.stopwatch.accumulatedMinutes;
    }
    return this.stopwatch.accumulatedMinutes + (Date.now() - this.stopwatch.startTime) / 60000;
  }

  toggleStopwatch() {
    if (this.stopwatch.isRunning) {
      this.stopwatch.accumulatedMinutes = this.getStopwatchElapsedMinutes();
      this.stopwatch.isRunning = false;
    } else {
      sounds.playPop();
      this.stopwatch.startTime = Date.now();
      this.stopwatch.isRunning = true;
    }
    this.updatePip();
  }

  resetStopwatch() {
    this.stopwatch.isRunning = false;
    this.stopwatch.startTime = 0;
    this.stopwatch.accumulatedMinutes = 0;
    this.updatePip();
  }

  saveStopwatchSession(category, topic, notes) {
    const minutes = this.getStopwatchElapsedMinutes();
    if (minutes < 0.1) {
      showToast("Tempo muito curto para salvar (mínimo 6 segundos).", "error");
      return false;
    }

    if (!category || !category.trim() || !topic || !topic.trim() || !notes || !notes.trim()) {
      showToast("Preencha matéria, tópico e o que estudou para salvar.", "error");
      return false;
    }

    store.addStudySession({
      minutes,
      category: category.trim(),
      topic: topic.trim(),
      what: notes.trim()
    });

    this.resetStopwatch();
    this.form = { category: "", topic: "", notes: "" };
    sounds.playSuccess();
    showToast(`Sessão de ${Math.round(minutes)}min salva com sucesso! +XP`);
    this.updatePip();
    return true;
  }

  // --- Pomodoro Methods ---

  togglePomodoro() {
    if (this.pomodoro.isRunning) {
      this.pomodoro.isRunning = false;
    } else {
      sounds.playPop();
      this.pomodoro.endTime = Date.now() + (this.pomodoro.secondsLeft * 1000);
      this.pomodoro.isRunning = true;
    }
    this.updatePip();
  }

  skipPomodoroPhase() {
    sounds.playPop();
    this.advancePomodoroPhase(false);
  }

  advancePomodoroPhase(earnedFocus = true) {
    sounds.playSuccess();

    if (this.pomodoro.phase === "foco") {
      if (earnedFocus) {
        this.pomodoro.accumulatedFocusMinutes += this.pomodoro.focusMinutes;
        this.pomodoro.completedCycles++;
      }
      const isLong = this.pomodoro.completedCycles > 0 && this.pomodoro.completedCycles % 4 === 0;
      this.pomodoro.phase = isLong ? "longa" : "pausa";
      this.notifyBrowser(
        "🍅 Foco concluído!",
        isLong ? "Hora de uma pausa longa de 15 minutos." : "Hora de uma pausa curta de 5 minutos."
      );
    } else {
      this.pomodoro.phase = "foco";
      this.notifyBrowser("☕ Pausa concluída!", "De volta ao foco.");
    }

    const nextSeconds = this.getPhaseDurationSeconds(this.pomodoro.phase);
    this.pomodoro.secondsLeft = nextSeconds;

    if (this.pomodoro.autoNextPhase) {
      this.pomodoro.endTime = Date.now() + (nextSeconds * 1000);
      this.pomodoro.isRunning = true;
    } else {
      this.pomodoro.isRunning = false;
    }
  }

  getPhaseDurationSeconds(phase) {
    if (phase === "foco") return this.pomodoro.focusMinutes * 60;
    if (phase === "longa") return this.pomodoro.longBreakMinutes * 60;
    return this.pomodoro.breakMinutes * 60;
  }

  setPomodoroConfig({ focus, shortBreak, longBreak, autoNext }) {
    if (focus) this.pomodoro.focusMinutes = Math.max(1, parseInt(focus, 10));
    if (shortBreak) this.pomodoro.breakMinutes = Math.max(1, parseInt(shortBreak, 10));
    if (longBreak) this.pomodoro.longBreakMinutes = Math.max(1, parseInt(longBreak, 10));
    if (autoNext !== undefined) this.pomodoro.autoNextPhase = Boolean(autoNext);

    if (!this.pomodoro.isRunning) {
      this.pomodoro.secondsLeft = this.getPhaseDurationSeconds(this.pomodoro.phase);
    }
  }

  savePomodoroSession(category, topic, notes) {
    const currentPhaseElapsed = this.pomodoro.phase === "foco"
      ? (this.pomodoro.focusMinutes * 60 - this.pomodoro.secondsLeft) / 60
      : 0;

    const totalMinutes = this.pomodoro.accumulatedFocusMinutes + Math.max(0, currentPhaseElapsed);

    if (totalMinutes < 0.1) {
      showToast("Nenhum tempo de foco acumulado para salvar.", "error");
      return false;
    }

    if (!category || !category.trim() || !topic || !topic.trim() || !notes || !notes.trim()) {
      showToast("Preencha matéria, tópico e o que estudou para salvar.", "error");
      return false;
    }

    store.addStudySession({
      minutes: totalMinutes,
      category: category.trim(),
      topic: topic.trim(),
      what: notes.trim()
    });

    // Reset Pomodoro cycle state
    this.pomodoro.isRunning = false;
    this.pomodoro.phase = "foco";
    this.pomodoro.secondsLeft = this.pomodoro.focusMinutes * 60;
    this.pomodoro.completedCycles = 0;
    this.pomodoro.accumulatedFocusMinutes = 0;
    this.form = { category: "", topic: "", notes: "" };

    sounds.playSuccess();
    showToast(`Sessão Pomodoro de ${Math.round(totalMinutes)}min salva com sucesso! +XP`);
    return true;
  }

  // --- Browser Notification ---

  notifyBrowser(title, body) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    } catch {
      // Ignored if permissions not active
    }
  }

  requestNotificationPermission() {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }

  // --- Background Clock Loop ---

  tick() {
    // 1. Pomodoro countdown update
    if (this.pomodoro.isRunning) {
      this.pomodoro.secondsLeft = Math.max(0, Math.round((this.pomodoro.endTime - Date.now()) / 1000));
      if (this.pomodoro.secondsLeft === 0) {
        this.advancePomodoroPhase(true);
      }
    }

    // 2. Document title countdown
    if (this.mode === "pomo" && this.pomodoro.isRunning) {
      const mm = String(Math.floor(this.pomodoro.secondsLeft / 60)).padStart(2, "0");
      const ss = String(this.pomodoro.secondsLeft % 60).padStart(2, "0");
      const icon = this.pomodoro.phase === "foco" ? "🍅" : "☕";
      document.title = `${mm}:${ss} ${icon} · StudAI`;
    } else if (this.mode === "prog" && this.stopwatch.isRunning) {
      const totalSeconds = Math.floor(this.getStopwatchElapsedMinutes() * 60);
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      document.title = `${mm}:${ss} ⏱️ · StudAI`;
    } else {
      document.title = "StudAI";
    }

    // 3. Update DOM timer digits if currently visible
    this.updateDomDisplays();
    this.updatePip();
  }

  updateDomDisplays() {
    const stopwatchDisplay = document.getElementById("tmr");
    if (stopwatchDisplay && this.mode === "prog") {
      const totalSeconds = Math.floor(this.getStopwatchElapsedMinutes() * 60);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      stopwatchDisplay.textContent = `${hh}:${mm}:${ss}`;
    }

    const pomodoroDisplay = document.getElementById("ptmr_main");
    if (pomodoroDisplay && this.mode === "pomo") {
      const mm = String(Math.floor(this.pomodoro.secondsLeft / 60)).padStart(2, "0");
      const ss = String(this.pomodoro.secondsLeft % 60).padStart(2, "0");
      pomodoroDisplay.textContent = `${mm}:${ss}`;
    }
  }

  // --- Intelligent Auto & Manual Picture-in-Picture Floating Window ---

  isAnyRunning() {
    return (this.mode === "prog" && this.stopwatch.isRunning) ||
           (this.mode === "pomo" && this.pomodoro.isRunning);
  }

  setAutoPip(enabled) {
    this.autoPipEnabled = Boolean(enabled);
    try {
      localStorage.setItem("studai_auto_pip", this.autoPipEnabled ? "true" : "false");
    } catch {}
    showToast(
      this.autoPipEnabled
        ? "⚡ Pop-up automático ativado! Ao trocar de aba ou app ele surgirá."
        : "Pop-up automático desativado.",
      "info"
    );
    if (window.studai && window.studai.render) {
      window.studai.render();
    }
  }

  setupAutoPipListeners() {
    const triggerAutoPip = async () => {
      if (!this.autoPipEnabled) return;
      if (!this.isAnyRunning()) return;
      if (this.pipWindow) return; // Already active

      if (document.hidden) {
        try {
          await this.togglePictureInPicture(true);
        } catch (err) {
          console.log("Auto-PiP gesture constraint:", err);
          this.notifyBrowser(
            "⏱️ Sessão Ativa no StudAI",
            "O timer continua registrando seu tempo de foco! Clique para abrir o pop-up."
          );
        }
      }
    };

    document.addEventListener("visibilitychange", triggerAutoPip);
    window.addEventListener("blur", triggerAutoPip);
  }

  switchMode(targetMode) {
    if (targetMode) {
      this.mode = targetMode;
    } else {
      this.mode = this.mode === "prog" ? "pomo" : "prog";
    }
    sounds.playPop();
    this.updatePip();
    if (window.studai && window.studai.render) {
      window.studai.render();
    }
  }

  async togglePictureInPicture(isAuto = false) {
    if (this.pipWindow) {
      if (isAuto) return;
      this.pipWindow.close();
      this.pipWindow = null;
      return;
    }

    if (!("documentPictureInPicture" in window)) {
      if (!isAuto) {
        showToast("Seu navegador não suporta janela flutuante PiP. Use Chrome ou Edge no computador.", "info");
      }
      return;
    }

    try {
      this.pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 360,
        height: 485
      });
    } catch (err) {
      if (!isAuto) {
        showToast("Não foi possível abrir o pop-up: " + err.message, "error");
      }
      return;
    }

    const doc = this.pipWindow.document;
    const subjects = store.getSubjects();
    const pillsHtml = subjects.length
      ? subjects.map(s => `
          <button class="spill ${this.form.category === s.name ? "active" : ""}" data-cat="${escapeHtml(s.name)}">
            ${escapeHtml(s.name)}
          </button>
        `).join("")
      : `<button class="spill active" data-cat="Geral">Geral</button>`;

    doc.head.innerHTML = `
      <meta charset="utf-8">
      <title>StudAI Focus HUD</title>
      <style>
        :root {
          --bg: #050805;
          --line: rgba(45, 255, 122, 0.18);
          --g: #2dff7a;
          --g2: #14b34f;
          --amber: #f59e0b;
          --tx: #d7f5df;
          --mu: #7f9a86;
          --font: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: radial-gradient(circle at 85% 0%, rgba(45, 255, 122, 0.12), transparent 50%),
                      radial-gradient(circle at 10% 100%, rgba(59, 130, 246, 0.08), transparent 50%),
                      var(--bg);
          color: var(--tx);
          font-family: var(--font);
          padding: 12px;
          font-size: 13px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          user-select: none;
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(45, 255, 122, 0.25); border-radius: 99px; }

        .hud-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--line);
        }
        .brand {
          font-weight: 800;
          font-size: 13.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .brand b { color: var(--g); text-shadow: 0 0 10px rgba(45,255,122,0.6); }
        .pulse-orb {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--g);
          box-shadow: 0 0 8px var(--g);
          animation: pulse 1.6s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.85); }
        }

        .hud-actions {
          display: flex;
          gap: 5px;
        }
        .mini-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--line);
          color: var(--tx);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mini-btn:hover {
          background: rgba(45,255,122,0.18);
          border-color: var(--g);
          color: #fff;
        }

        .ring-wrap {
          position: relative;
          width: 148px;
          height: 148px;
          margin: 4px auto 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ring-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        .ring-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.06);
          stroke-width: 7;
        }
        .ring-val {
          fill: none;
          stroke: var(--g);
          stroke-width: 7;
          stroke-linecap: round;
          stroke-dasharray: 383;
          stroke-dashoffset: 0;
          transition: stroke-dashoffset 0.5s ease, stroke 0.3s;
          filter: drop-shadow(0 0 8px rgba(45, 255, 122, 0.45));
        }
        .ring-val.break {
          stroke: var(--amber);
          filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.45));
        }
        .ring-center {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .mode-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--g);
          margin-bottom: 2px;
        }
        .mode-tag.break { color: var(--amber); }
        .digits {
          font-family: "Courier New", monospace;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--g);
          text-shadow: 0 0 14px rgba(45,255,122,0.4);
        }
        .digits.break {
          color: var(--amber);
          text-shadow: 0 0 14px rgba(245,158,11,0.4);
        }
        .xp-chip {
          font-size: 10px;
          font-weight: 700;
          background: rgba(45, 255, 122, 0.12);
          color: var(--g);
          padding: 1px 7px;
          border-radius: 99px;
          margin-top: 2px;
        }

        .ctrl-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-bottom: 10px;
        }
        .btn {
          background: linear-gradient(135deg, #5dffa3, var(--g2));
          color: #03140a;
          border: 0;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(20, 179, 79, 0.35);
        }
        .btn.o {
          background: rgba(45, 255, 122, 0.08);
          color: var(--g);
          border: 1px solid rgba(45, 255, 122, 0.3);
          box-shadow: none;
        }
        .btn.o:hover {
          background: rgba(45, 255, 122, 0.18);
        }

        .ai-hud {
          background: rgba(45, 255, 122, 0.05);
          border: 1px solid rgba(45, 255, 122, 0.18);
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 10px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ai-hud .icon { font-size: 16px; flex-shrink: 0; }
        .ai-hud .msg { font-size: 11px; line-height: 1.35; color: var(--tx); }
        .ai-hud .msg b { color: var(--g); }

        .pills-title {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--mu);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 5px;
        }
        .pills-row {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin-bottom: 10px;
        }
        .spill {
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 99px;
          border: 1px solid var(--line);
          background: rgba(0, 0, 0, 0.4);
          color: var(--tx);
          cursor: pointer;
          transition: all 0.2s;
        }
        .spill:hover {
          border-color: var(--g);
          background: rgba(45,255,122,0.15);
        }
        .spill.active {
          background: var(--g);
          color: #03140a;
          border-color: var(--g);
          font-weight: 700;
        }

        input, textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid var(--line);
          border-radius: 7px;
          color: #fff;
          padding: 6px 9px;
          margin-bottom: 6px;
          font-family: inherit;
          font-size: 11.5px;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: var(--g);
          background: rgba(0, 0, 0, 0.65);
        }

        .compact-hidden {
          display: block;
        }
        body.is-compact .compact-hidden {
          display: none !important;
        }
        body.is-compact .ring-wrap {
          width: 120px;
          height: 120px;
          margin: 2px auto 8px;
        }
        body.is-compact .digits {
          font-size: 22px;
        }
      </style>
    `;

    doc.body.innerHTML = `
      <div class="hud-top">
        <div class="brand">
          <span class="pulse-orb"></span>
          Stud<b>AI</b> <span style="font-size:10px;opacity:0.6;margin-left:2px;">HUD</span>
        </div>
        <div class="hud-actions">
          <button class="mini-btn" id="pip-switch-mode" title="Alternar entre Cronômetro e Pomodoro">⏱️ / 🍅</button>
          <button class="mini-btn" id="pip-toggle-compact" title="Alternar Modo Mini">🔍 Mini</button>
        </div>
      </div>

      <div class="ring-wrap">
        <svg class="ring-svg" viewBox="0 0 140 140">
          <circle class="ring-bg" cx="70" cy="70" r="61" />
          <circle class="ring-val" id="pip-ring" cx="70" cy="70" r="61" />
        </svg>
        <div class="ring-center">
          <span class="mode-tag" id="pip-mode-label">Foco</span>
          <span class="digits" id="pip-timer">00:00:00</span>
          <span class="xp-chip" id="pip-xp">+0 XP</span>
        </div>
      </div>

      <div class="ctrl-grid">
        <button class="btn" id="pip-toggle">▶ Iniciar</button>
        <button class="btn o" id="pip-secondary">✔ Salvar</button>
      </div>

      <div class="ai-hud compact-hidden" id="pip-ai-card">
        <span class="icon" id="pip-ai-icon">🧠</span>
        <div class="msg"><b id="pip-ai-title">Focus Coach:</b> <span id="pip-ai-text">Mantenha a mente no presente e elimine distrações.</span></div>
      </div>

      <div class="compact-hidden">
        <div class="pills-title">Matéria da Sessão</div>
        <div class="pills-row" id="pip-pills">${pillsHtml}</div>
      </div>

      <div class="compact-hidden">
        <input id="pip-cat" placeholder="Matéria *" value="${escapeHtml(this.form.category)}">
        <input id="pip-topic" placeholder="Tópico *" value="${escapeHtml(this.form.topic)}">
        <textarea id="pip-notes" rows="2" placeholder="O que estudou? *">${escapeHtml(this.form.notes)}</textarea>
      </div>
    `;

    // Bind subject pills
    doc.querySelectorAll(".spill").forEach(btn => {
      btn.onclick = () => {
        const cat = btn.getAttribute("data-cat");
        this.form.category = cat;
        const catInput = doc.getElementById("pip-cat");
        if (catInput) catInput.value = cat;
        doc.querySelectorAll(".spill").forEach(b => b.classList.toggle("active", b.getAttribute("data-cat") === cat));
        const mainCat = document.getElementById("sc");
        if (mainCat) mainCat.value = cat;
      };
    });

    doc.getElementById("pip-switch-mode").onclick = () => {
      this.switchMode();
    };

    doc.getElementById("pip-toggle-compact").onclick = () => {
      this.pipCompactMode = !this.pipCompactMode;
      doc.body.classList.toggle("is-compact", this.pipCompactMode);
      doc.getElementById("pip-toggle-compact").textContent = this.pipCompactMode ? "🗗 Cheio" : "🔍 Mini";
    };

    doc.getElementById("pip-toggle").onclick = () => {
      if (this.mode === "prog") {
        this.toggleStopwatch();
      } else {
        this.togglePomodoro();
      }
      this.updatePip();
      if (window.studai && window.studai.render) window.studai.render();
    };

    doc.getElementById("pip-secondary").onclick = () => {
      if (this.mode === "prog") {
        const cat = doc.getElementById("pip-cat")?.value || this.form.category;
        const topic = doc.getElementById("pip-topic")?.value || this.form.topic;
        const notes = doc.getElementById("pip-notes")?.value || this.form.notes;
        const saved = this.saveStopwatchSession(cat, topic, notes);
        if (saved && this.pipWindow) {
          this.pipWindow.close();
        }
      } else {
        this.skipPomodoroPhase();
        this.updatePip();
      }
      if (window.studai && window.studai.render) window.studai.render();
    };

    doc.getElementById("pip-cat").oninput = (e) => {
      this.form.category = e.target.value;
      const mainCat = document.getElementById("sc");
      if (mainCat) mainCat.value = e.target.value;
    };
    doc.getElementById("pip-topic").oninput = (e) => {
      this.form.topic = e.target.value;
      const mainTopic = document.getElementById("st");
      if (mainTopic) mainTopic.value = e.target.value;
    };
    doc.getElementById("pip-notes").oninput = (e) => {
      this.form.notes = e.target.value;
      const mainNotes = document.getElementById("sw");
      if (mainNotes) mainNotes.value = e.target.value;
    };

    this.pipWindow.addEventListener("pagehide", () => {
      this.pipWindow = null;
      if (window.studai && window.studai.render) window.studai.render();
    });

    this.updatePip();
    if (window.studai && window.studai.render) window.studai.render();
  }

  updatePip() {
    if (!this.pipWindow) return;
    const doc = this.pipWindow.document;

    const timerEl = doc.getElementById("pip-timer");
    const toggleBtn = doc.getElementById("pip-toggle");
    const secondaryBtn = doc.getElementById("pip-secondary");
    const ringEl = doc.getElementById("pip-ring");
    const modeLabelEl = doc.getElementById("pip-mode-label");
    const xpEl = doc.getElementById("pip-xp");
    const aiTextEl = doc.getElementById("pip-ai-text");
    const aiIconEl = doc.getElementById("pip-ai-icon");

    const circumference = 383; // 2 * Math.PI * 61

    if (this.mode === "prog") {
      const totalMinutes = this.getStopwatchElapsedMinutes();
      const totalSeconds = Math.floor(totalMinutes * 60);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");

      if (timerEl) {
        timerEl.textContent = `${hh}:${mm}:${ss}`;
        timerEl.classList.remove("break");
      }
      if (modeLabelEl) {
        modeLabelEl.textContent = "⏱️ Cronômetro";
        modeLabelEl.classList.remove("break");
      }
      if (ringEl) {
        ringEl.classList.remove("break");
        const breathingPct = (totalSeconds % 60) / 60;
        ringEl.style.strokeDashoffset = String(circumference * (1 - breathingPct));
      }
      if (xpEl) {
        const estimatedXp = Math.max(1, Math.floor(totalMinutes * 0.5));
        xpEl.textContent = `✨ +${estimatedXp} XP`;
      }
      if (toggleBtn) {
        toggleBtn.textContent = this.stopwatch.isRunning ? "⏸ Pausar" : "▶ Iniciar";
        toggleBtn.style.background = this.stopwatch.isRunning
          ? "linear-gradient(135deg, #f59e0b, #d97706)"
          : "linear-gradient(135deg, #5dffa3, var(--g2))";
      }
      if (secondaryBtn) {
        secondaryBtn.textContent = "✔ Finalizar";
      }

      // Rotate coach quote based on elapsed minutes
      if (aiTextEl && aiIconEl) {
        const quoteIdx = Math.floor(totalMinutes / 5) % (this.aiQuotes.length - 1);
        aiIconEl.textContent = this.aiQuotes[quoteIdx].icon;
        aiTextEl.textContent = this.aiQuotes[quoteIdx].text;
      }
    } else {
      // Pomodoro
      const isFocus = this.pomodoro.phase === "foco";
      const totalSeconds = this.getPhaseDurationSeconds(this.pomodoro.phase);
      const elapsed = Math.max(0, totalSeconds - this.pomodoro.secondsLeft);
      const pct = Math.min(1, Math.max(0, elapsed / totalSeconds));
      const mm = String(Math.floor(this.pomodoro.secondsLeft / 60)).padStart(2, "0");
      const ss = String(this.pomodoro.secondsLeft % 60).padStart(2, "0");

      if (timerEl) {
        timerEl.textContent = `${mm}:${ss}`;
        timerEl.classList.toggle("break", !isFocus);
      }
      if (modeLabelEl) {
        modeLabelEl.textContent = isFocus
          ? `🍅 Foco (Ciclo ${this.pomodoro.completedCycles + 1}/4)`
          : `☕ Pausa (${this.pomodoro.phase === "longa" ? "Longa" : "Curta"})`;
        modeLabelEl.classList.toggle("break", !isFocus);
      }
      if (ringEl) {
        ringEl.classList.toggle("break", !isFocus);
        ringEl.style.strokeDashoffset = String(circumference * (1 - pct));
      }
      if (xpEl) {
        xpEl.textContent = `🍅 ${this.pomodoro.completedCycles} ciclo(s) (+${this.pomodoro.completedCycles * 25} XP)`;
      }
      if (toggleBtn) {
        toggleBtn.textContent = this.pomodoro.isRunning ? "⏸ Pausar" : "▶ Iniciar";
        toggleBtn.style.background = this.pomodoro.isRunning
          ? "linear-gradient(135deg, #f59e0b, #d97706)"
          : "linear-gradient(135deg, #5dffa3, var(--g2))";
      }
      if (secondaryBtn) {
        secondaryBtn.textContent = isFocus ? "⏭ Pular Fase" : "▶ Voltar ao Foco";
      }

      if (aiTextEl && aiIconEl) {
        if (!isFocus) {
          aiIconEl.textContent = "☕";
          aiTextEl.textContent = "Momento de descompressão! Respire fundo e alongue os ombros.";
        } else {
          const quoteIdx = (this.pomodoro.completedCycles) % (this.aiQuotes.length - 1);
          aiIconEl.textContent = this.aiQuotes[quoteIdx].icon;
          aiTextEl.textContent = this.aiQuotes[quoteIdx].text;
        }
      }
    }
  }
}

export const timer = new TimerEngine();
