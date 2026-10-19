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

    // Picture-in-picture window reference
    this.pipWindow = null;
    this.pipInterval = null;

    // Start background tick
    this.interval = setInterval(() => this.tick(), 500);
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

  // --- Picture-in-Picture Floating Window ---

  async togglePictureInPicture() {
    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
      return;
    }

    if (!("documentPictureInPicture" in window)) {
      showToast("Seu navegador não suporta janela flutuante PiP. Use Chrome ou Edge no computador.", "info");
      return;
    }

    try {
      this.pipWindow = await window.documentPictureInPicture.requestWindow({ width: 340, height: 380 });
    } catch (err) {
      showToast("Não foi possível abrir a janela flutuante: " + err.message, "error");
      return;
    }

    const doc = this.pipWindow.document;
    doc.head.innerHTML = `
      <meta charset="utf-8">
      <title>StudAI Timer</title>
      <style>
        * { box-sizing: border-box; margin:0; padding:0; }
        body { background: #070d08; color: #d7f5df; font-family: "Segoe UI", system-ui, sans-serif; padding: 14px; font-size: 13px; }
        .timer { font-family: "Courier New", monospace; font-size: 40px; font-weight: 800; color: #2dff7a; text-align: center; margin: 8px 0 14px; text-shadow: 0 0 16px rgba(45,255,122,0.4); }
        .btn { width: 100%; background: #2dff7a; color: #021207; font-weight: 700; border: none; border-radius: 8px; padding: 9px; cursor: pointer; font-size: 13px; margin-bottom: 6px; }
        .btn.o { background: transparent; color: #2dff7a; border: 1px solid #2dff7a; }
        input, textarea { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(45,255,122,0.2); border-radius: 6px; color: #fff; padding: 8px; margin-bottom: 6px; font-family: inherit; font-size: 12px; }
        input:focus, textarea:focus { outline: none; border-color: #2dff7a; }
      </style>
    `;

    doc.body.innerHTML = `
      <div class="timer" id="pip-timer">00:00:00</div>
      <button class="btn" id="pip-toggle">▶ Iniciar</button>
      <button class="btn o" id="pip-save">✔ Finalizar e Salvar</button>
      <input id="pip-cat" placeholder="Matéria *" value="${escapeHtml(this.form.category)}">
      <input id="pip-topic" placeholder="Tópico aprendido *" value="${escapeHtml(this.form.topic)}">
      <textarea id="pip-notes" rows="2" placeholder="O que você estudou? *">${escapeHtml(this.form.notes)}</textarea>
    `;

    doc.getElementById("pip-toggle").onclick = () => {
      this.toggleStopwatch();
      this.updatePip();
    };

    doc.getElementById("pip-save").onclick = () => {
      const saved = this.saveStopwatchSession(
        doc.getElementById("pip-cat").value,
        doc.getElementById("pip-topic").value,
        doc.getElementById("pip-notes").value
      );
      if (saved && this.pipWindow) {
        this.pipWindow.close();
      }
    };

    doc.getElementById("pip-cat").oninput = (e) => { this.form.category = e.target.value; };
    doc.getElementById("pip-topic").oninput = (e) => { this.form.topic = e.target.value; };
    doc.getElementById("pip-notes").oninput = (e) => { this.form.notes = e.target.value; };

    this.pipWindow.addEventListener("pagehide", () => {
      this.pipWindow = null;
    });

    this.updatePip();
  }

  updatePip() {
    if (!this.pipWindow) return;
    const doc = this.pipWindow.document;
    const timerEl = doc.getElementById("pip-timer");
    const toggleBtn = doc.getElementById("pip-toggle");

    if (timerEl) {
      const totalSeconds = Math.floor(this.getStopwatchElapsedMinutes() * 60);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      timerEl.textContent = `${hh}:${mm}:${ss}`;
    }

    if (toggleBtn) {
      toggleBtn.textContent = this.stopwatch.isRunning ? "⏸ Pausar" : "▶ Iniciar";
    }
  }
}

export const timer = new TimerEngine();
