/**
 * StudAI — Main Application Controller & Router (Clean Code)
 */
import { store } from "./store.js";
import { timer } from "./timer.js";
import { sounds } from "./audio.js";
import { calculateXP, calculateLevelData } from "./gamification.js";
import { showToast, showConfirm, generateId, getTodayIso, escapeHtml } from "./utils.js";
import { aiConfig, saveApiKey, generateQuizQuestions } from "./ai.js";

// Import Views
import { renderDashboard } from "./views/dashboardView.js";
import { renderSubjects } from "./views/subjectsView.js";
import {
  renderGoals,
  setEditingGoal,
  setGoalFormOpen,
  editingGoalId,
  isGoalFormOpen
} from "./views/goalsView.js";
import {
  renderTimer,
  toggleActiveBlur,
  setEditingHistoryKey,
  editingHistoryKey,
  flashcardState
} from "./views/timerView.js";
import {
  renderQuiz,
  activeQuizGame,
  setActiveQuizGame,
  quizBankFilter,
  quizHistoryFilter,
  setQuizBankFilter,
  resetQuizBankFilters,
  setQuizHistoryFilter,
  getFilteredQuizList,
  renderQuizBankItems
} from "./views/quizView.js";
import {
  renderCalendar,
  calendarMonthOffset,
  setCalendarMonthOffset,
  setSelectedCalendarDate
} from "./views/calendarView.js";
import {
  renderData,
  exportData,
  importBackupFile,
  isWipePendingConfirmation,
  setWipePending
} from "./views/dataView.js";

const TABS = [
  ["painel", "📊 Painel"],
  ["materias", "📚 Matérias"],
  ["metas", "🎯 Metas"],
  ["tempo", "⏱️ Tempo"],
  ["quiz", "🧠 Quiz"],
  ["calendario", "📅 Calendário"],
  ["dados", "💾 Dados"]
];

class Application {
  constructor() {
    this.currentTab = "painel";

    // Attach reactive store subscriber
    store.subscribe(() => {
      this.render();
    });
  }

  init() {
    this.render();
  }

  switchTab(tabKey) {
    if (this.currentTab === tabKey) return;
    this.currentTab = tabKey;
    sounds.playPop();

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        this.render();
      });
    } else {
      this.render();
    }
  }

  updateHeader() {
    try {
      // 1. Calcula o XP
      const totalXp = calculateXP(store.state) || 0;
      console.log("🛠️ DIAGNÓSTICO 1 - XP Calculado:", totalXp);

      // 2. Calcula o Nível\\
      const nivelData = calculateLevelData(totalXp);
      console.log("🛠️ DIAGNÓSTICO 2 - Dados Nível:", nivelData);

      // 3. Procura a barra no HTML (DOM)
      const lvlTxtEl = document.getElementById("lvlTxt");
      const xpBarEl = document.getElementById("xpBar");
      console.log("🛠️ DIAGNÓSTICO 3 - Elementos HTML encontrados:", {
        texto: !!lvlTxtEl,
        barra: !!xpBarEl
      });

      // 4. Injeta os dados
      if (lvlTxtEl) {
        lvlTxtEl.innerHTML = `
          Nível ${nivelData.level} <span style="opacity:0.75; font-size:11.5px; margin-left:4px">${nivelData.rankTitle}</span>
          <div style="font-weight:800; color:var(--g); margin-top:2px">${totalXp} XP</div>
        `;
      }

      if (xpBarEl) {
        xpBarEl.style.width = `${nivelData.progressPct}%`;
      }
    } catch (err) {
      console.error("Erro ao desenhar o cabeçalho:", err);
    }
  } updateNav() {
    const navEl = document.getElementById("nav");
    if (!navEl) return;

    navEl.innerHTML = TABS.map(([key, label]) => `
      <button class="${key === this.currentTab ? "on" : ""}" onclick="window.studai.switchTab('${key}')">
        ${label}
      </button>
    `).join("");
  }

  render() {
    this.updateHeader();
    this.updateNav();

    const mainEl = document.getElementById("main");
    if (!mainEl) return;

    switch (this.currentTab) {
      case "painel":
        mainEl.innerHTML = renderDashboard();
        break;
      case "materias":
        mainEl.innerHTML = renderSubjects();
        break;
      case "metas":
        mainEl.innerHTML = renderGoals();
        break;
      case "tempo":
        mainEl.innerHTML = renderTimer();
        break;
      case "quiz":
        mainEl.innerHTML = renderQuiz();
        break;
      case "calendario":
        mainEl.innerHTML = renderCalendar();
        break;
      case "dados":
        mainEl.innerHTML = renderData();
        break;
      default:
        mainEl.innerHTML = renderDashboard();
    }

    this.updateFloatingTimerDock();
  }

  // --- Actions Dispatcher (Exposed to Global window.studai) ---

  claimMission(missionId) {
    sounds.playSuccess();
    const today = getTodayIso();
    const missionKey = `${today}_${missionId}`;
    if (!store.state.claimed_missions.includes(missionKey)) {
      store.state.claimed_missions.push(missionKey);
      store.save();
      showToast("Missão resgatada com sucesso! +25 XP adicionados.");
    }
  }

  // Matérias
  addSubject() {
    const inputName = document.getElementById("mn");
    const inputColor = document.getElementById("mc");
    if (!inputName) return;

    try {
      store.addSubject(inputName.value, inputColor ? inputColor.value : null);
      inputName.value = "";
      sounds.playSuccess();
      showToast("Matéria adicionada com sucesso!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  startEditSubject(id) {
    document.querySelectorAll(".subj-item").forEach(el => el.classList.remove("editing"));
    const target = document.getElementById(`subj-${id}`);
    if (target) target.classList.add("editing");
  }

  cancelEditSubject(id) {
    const target = document.getElementById(`subj-${id}`);
    if (target) target.classList.remove("editing");
  }

  saveSubject(id) {
    const nameInput = document.getElementById(`en-${id}`);
    const colorInput = document.getElementById(`ec-${id}`);
    const timeInput = document.getElementById(`et-${id}`);

    if (!nameInput) return;

    try {
      store.updateSubject(
        id,
        nameInput.value,
        colorInput ? colorInput.value : null,
        timeInput ? parseFloat(timeInput.value) || 0 : 0
      );
      sounds.playPop();
      showToast("Matéria atualizada!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  deleteSubject(id) {
    const subject = store.state.subjects.find(s => s.id === id);
    if (!subject) return;

    showConfirm(`Deseja realmente apagar a matéria "${subject.name}"?`, () => {
      store.deleteSubject(id);
      sounds.playPop();
      showToast("Matéria removida.");
    });
  }

  // Metas & Kanban
  addTask() {
    const txtInput = document.getElementById("kb-txt");
    const catInput = document.getElementById("kb-cat");
    if (!txtInput) return;

    const text = txtInput.value.trim();
    if (!text) {
      showToast("Digite a descrição da tarefa.", "error");
      return;
    }

    const cat = catInput ? catInput.value.trim() : "";
    if (cat) store.ensureSubject(cat);

    store.state.tasks.push({
      id: generateId(),
      text,
      cat,
      status: "todo",
      date: getTodayIso()
    });

    txtInput.value = "";
    if (catInput) catInput.value = "";
    sounds.playPop();
    store.save();
    showToast("Tarefa adicionada ao Kanban!");
  }

moveTask(id, newStatus) {
    const task = store.state.tasks.find(t => t.id === id);
    if (!task) return;
    
    task.status = newStatus;
    
    // NOVO: Anota a data se for concluída, ou apaga se voltar para trás
    if (newStatus === "done") {
      task.completedAt = Date.now();
    } else {
      delete task.completedAt;
    }
    store.save();
  }

  deleteTask(id) {
    showConfirm("Deseja apagar esta tarefa?", () => {
      store.state.tasks = store.state.tasks.filter(t => t.id !== id);
      sounds.playPop();
      store.save();
    });
  }
  editTask(id, newText) {
    const task = store.state.tasks.find(t => t.id === id);
    if (!task) return;

    // Impede edição se a tarefa não estiver na coluna 'A Fazer' (segurança extra)
    if (task.status !== "todo") return;

    const cleanText = newText.trim();
    if (!cleanText) return; // Ignora se o usuário apagar tudo

    if (task.text !== cleanText) {
      task.text = cleanText;
      store.save();
    }
  }

  toggleGoal(id) {
    const goal = store.state.goals.find(g => g.id === id);
    if (!goal) return;

    goal.done = !goal.done;
    if (goal.done) {
      sounds.playSuccess();
      showToast("Meta concluída! +50 XP");
    } else {
      sounds.playPop();
    }
    store.save();
  }

  toggleGoalForm(isOpen) {
    setGoalFormOpen(isOpen);
    setEditingGoal(null);
    this.render();
  }

  addGoal() {
    const textInput = document.getElementById("gt");
    const catInput = document.getElementById("gc");
    const hoursInput = document.getElementById("gh");
    const dueInput = document.getElementById("gd");

    const text = textInput ? textInput.value.trim() : "";
    const cat = catInput ? catInput.value.trim() : "";
    const hours = hoursInput ? parseFloat(hoursInput.value) : 0;

    if (!text || !cat || hours <= 0) {
      showToast("Preencha meta, matéria e horas semanais válidas.", "error");
      return;
    }

    store.ensureSubject(cat);
    store.state.goals.push({
      id: generateId(),
      text,
      cat,
      hours,
      due: dueInput ? dueInput.value : "",
      done: false,
      created: getTodayIso()
    });

    setGoalFormOpen(false);
    sounds.playSuccess();
    store.save();
    showToast("Meta semanal criada com sucesso!");
  }

  startEditGoal(id) {
    setEditingGoal(id);
    setGoalFormOpen(false);
    this.render();
  }

  cancelGoalEdit() {
    setEditingGoal(null);
    this.render();
  }

  saveGoal(id) {
    const goal = store.state.goals.find(g => g.id === id);
    if (!goal) return;

    const text = document.getElementById("egt")?.value.trim();
    const cat = document.getElementById("egc")?.value.trim();
    const hours = parseFloat(document.getElementById("egh")?.value) || 0;
    const due = document.getElementById("egd")?.value || "";

    if (!text || !cat || hours <= 0) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    store.ensureSubject(cat);
    goal.text = text;
    goal.cat = cat;
    goal.hours = hours;
    goal.due = due;

    setEditingGoal(null);
    sounds.playPop();
    store.save();
    showToast("Meta atualizada!");
  }

  deleteGoal(id) {
    showConfirm("Deseja apagar esta meta?", () => {
      store.state.goals = store.state.goals.filter(g => g.id !== id);
      if (editingGoalId === id) setEditingGoal(null);
      sounds.playPop();
      store.save();
      showToast("Meta removida.");
    });
  }

  // Timer & Pomodoro
  setTimerMode(mode) {
    timer.mode = mode;
    this.render();
  }

  toggleStopwatch() {
    timer.toggleStopwatch();
    this.render();
  }

  saveStopwatch() {
    const cat = timer.form.category;
    const topic = timer.form.topic;
    const notes = timer.form.notes;
    const success = timer.saveStopwatchSession(cat, topic, notes);
    if (success) this.render();
  }

  togglePomodoro() {
    timer.togglePomodoro();
    this.render();
  }

  skipPomodoro() {
    timer.skipPomodoroPhase();
    this.render();
  }

  savePomodoro() {
    const cat = timer.form.category;
    const topic = timer.form.topic;
    const notes = timer.form.notes;
    const success = timer.savePomodoroSession(cat, topic, notes);
    if (success) this.render();
  }

  configPomodoro(opts) {
    timer.setPomodoroConfig(opts);
    this.render();
  }

  requestNotif() {
    timer.requestNotificationPermission();
    setTimeout(() => this.render(), 500);
  }

  setTimerFormField(field, value) {
    timer.form[field] = value;
  }

  setManualFormField(field, value) {
    timer.manualForm[field] = value;
  }

  addManualSession() {
    const cat = timer.manualForm.category.trim();
    const minutes = parseFloat(timer.manualForm.minutes);
    const date = timer.manualForm.date || getTodayIso();
    const topic = timer.manualForm.topic.trim();
    const notes = timer.manualForm.notes.trim();

    if (!cat || !minutes || minutes <= 0 || !topic || !notes) {
      showToast("Preencha matéria, minutos, tópico e o que estudou.", "error");
      return;
    }

    store.addStudySession({
      minutes,
      category: cat,
      topic,
      what: notes,
      date
    });

    timer.manualForm = { category: "", minutes: "", date: "", topic: "", notes: "" };
    sounds.playSuccess();
    showToast("Sessão manual adicionada! +XP");
  }

  togglePip() {
    timer.togglePictureInPicture();
    this.render();
  }

  toggleAutoPip(enabled) {
    timer.setAutoPip(enabled);
  }

  toggleTimerFromDock() {
    if (timer.mode === "prog") {
      timer.toggleStopwatch();
    } else {
      timer.togglePomodoro();
    }
    this.updateFloatingTimerDock();
  }

  updateFloatingTimerDock() {
    let dockEl = document.getElementById("floating-timer-dock");
    const isRunning = timer.isAnyRunning();

    if (!isRunning || this.currentTab === "tempo") {
      if (dockEl) dockEl.style.display = "none";
      return;
    }

    if (!dockEl) {
      dockEl = document.createElement("div");
      dockEl.id = "floating-timer-dock";
      dockEl.className = "floating-timer-dock";
      dockEl.onclick = () => this.switchTab("tempo");
      document.body.appendChild(dockEl);
    }

    dockEl.style.display = "flex";

    let timeText = "00:00";
    let icon = "⏱️";
    if (timer.mode === "prog") {
      const totalSec = Math.floor(timer.getStopwatchElapsedMinutes() * 60);
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      timeText = `${mm}:${ss}`;
      icon = "⏱️";
    } else {
      const mm = String(Math.floor(timer.pomodoro.secondsLeft / 60)).padStart(2, "0");
      const ss = String(timer.pomodoro.secondsLeft % 60).padStart(2, "0");
      timeText = `${mm}:${ss}`;
      icon = timer.pomodoro.phase === "foco" ? "🍅" : "☕";
    }

    const cat = timer.form.category || "Estudo";

    dockEl.innerHTML = `
      <span class="color-dot" style="background:var(--g);box-shadow:0 0 8px var(--g);"></span>
      <span style="font-size:12.5px; font-weight:700; color:var(--g); font-family:var(--font-mono);">${timeText}</span>
      <span style="font-size:12px;">${icon}</span>
      <span class="tag" style="margin:0; padding:2px 8px; font-size:11px;">${escapeHtml(cat)}</span>
      <button class="btn o" style="padding:3px 8px; font-size:11px; margin-left:2px;" title="${isRunning ? "Pausar" : "Iniciar"}" onclick="event.stopPropagation(); window.studai.toggleTimerFromDock();">
        ${isRunning ? "⏸" : "▶"}
      </button>
      <button class="btn o" style="padding:3px 8px; font-size:11px;" title="Abrir pop-up flutuante no topo de outros apps" onclick="event.stopPropagation(); window.studai.togglePip();">
        🗗
      </button>
    `;
  }

  toggleBlurMode() {
    toggleActiveBlur();
    this.render();
  }

  startEditHistoryEntry(key) {
    setEditingHistoryKey(key);
    this.render();
  }

  cancelHistoryEdit() {
    setEditingHistoryKey(null);
    this.render();
  }

  saveHistoryEntry(key) {
    const cat = document.getElementById("eh-c")?.value.trim();
    const date = document.getElementById("eh-d")?.value;
    const minInput = document.getElementById("eh-m");
    const topicInput = document.getElementById("eh-t");
    const whatInput = document.getElementById("eh-w");

    if (!cat || !date) {
      showToast("Preencha matéria e data.", "error");
      return;
    }

    store.ensureSubject(cat);

    const log = store.state.logs.find(l => l.id === key);
    const sess = store.state.sessions.find(s => s.id === key || (log && s.id === log.sid));

    if (sess) {
      sess.cat = cat;
      sess.date = date;
      if (minInput) sess.min = parseFloat(minInput.value) || sess.min;
    }

    if (log) {
      log.cat = cat;
      log.date = date;
      if (topicInput) log.topic = topicInput.value.trim();
      if (whatInput) log.what = whatInput.value.trim();
    }

    setEditingHistoryKey(null);
    sounds.playPop();
    store.save();
    showToast("Histórico atualizado!");
  }

  deleteHistoryEntry(key) {
    showConfirm("Deseja apagar este registro do histórico?", () => {
      const log = store.state.logs.find(l => l.id === key);
      const sessId = log ? log.sid : key;

      store.state.logs = store.state.logs.filter(l => l.id !== key);
      if (sessId) {
        store.state.sessions = store.state.sessions.filter(s => s.id !== sessId);
      }

      setEditingHistoryKey(null);
      sounds.playPop();
      store.save();
      showToast("Registro apagado.");
    });
  }

  // Flashcards
  flipFlashcard() {
    flashcardState.isFlipped = !flashcardState.isFlipped;
    sounds.playPop();
    this.render();
  }

  moveFlashcard(dir) {
    const deck = (store.state.logs || []).filter(l => l.topic && l.what);
    if (!deck.length) return;
    flashcardState.index = (flashcardState.index + dir + deck.length) % deck.length;
    flashcardState.isFlipped = false;
    sounds.playPop();
    this.render();
  }

  shuffleFlashcards() {
    const deck = (store.state.logs || []).filter(l => l.topic && l.what);
    flashcardState.shuffledOrder = deck.map(l => l.id).sort(() => Math.random() - 0.5);
    flashcardState.index = 0;
    flashcardState.isFlipped = false;
    sounds.playSuccess();
    this.render();
  }

  setFlashcardCategory(category) {
    flashcardState.category = category;
    flashcardState.index = 0;
    flashcardState.isFlipped = false;
    flashcardState.shuffledOrder = null;
    this.render();
  }

  // AI & Quiz
  saveAiKey() {
    const key = document.getElementById("ai-key")?.value || "";
    const model = document.getElementById("ai-model")?.value || "";
    saveApiKey(key, model);
    showToast("Configurações do Gemini salvas!");
    this.render();
  }

  setAiSourceType(type) {
    aiConfig.sourceType = type;
    this.render();
  }

  setAiCategory(cat) {
    aiConfig.category = cat;
    this.render();
  }

  setAiQuestionCount(n) {
    aiConfig.questionCount = n;
  }

  setAiCustomText(text) {
    aiConfig.customText = text;
  }

  async triggerAiGeneration() {
    try {
      this.render();
      await generateQuizQuestions();
      sounds.playSuccess();
      showToast("Perguntas geradas pela IA!");
    } catch (err) {
      showToast(err.message, "error");
    }
    this.render();
  }

  toggleAiQuestionSelection(index) {
    if (aiConfig.generatedItems?.[index]) {
      aiConfig.generatedItems[index].selected = !aiConfig.generatedItems[index].selected;
      this.render();
    }
  }

  previewAiAnswer(qIdx, optIdx) {
    const item = aiConfig.generatedItems?.[qIdx];
    if (!item || item.userPick !== null) return;
    item.userPick = optIdx;
    if (optIdx === item.ans) sounds.playSuccess();
    else sounds.playPop();
    this.render();
  }

  saveAiQuestionsToBank() {
    if (!aiConfig.generatedItems) return;
    const cat = (aiConfig.category || "Geral").trim();
    store.ensureSubject(cat);

    const selected = aiConfig.generatedItems.filter(x => x.selected);
    const timeStamp = new Date().toISOString(); // <-- Cria o carimbo exato de hora para o Lote inteiro

    selected.forEach(x => {
      store.state.quiz.push({
        id: generateId(),
        q: x.q,
        cat,
        opts: x.opts,
        ans: x.ans,
        box: 0,
        due: getTodayIso(),
        createdAt: timeStamp // <-- Salva a hora exata
      });
    });

    aiConfig.generatedItems = null;
    sounds.playSuccess();
    store.save();
    showToast(`${selected.length} perguntas adicionadas ao banco!`);
  }
  discardAiQuestions() {
    aiConfig.generatedItems = null;
    this.render();
  }

  startQuiz(category = "") {
    let pool = store.state.quiz || [];
    if (category) {
      pool = pool.filter(q => q.cat === category);
    }

    if (!pool.length) {
      showToast("Nenhuma pergunta encontrada para esta matéria.", "error");
      return;
    }

    // Shuffle questions and options
    const randomizedQuestions = pool.map(q => {
      const optionsWithMeta = q.opts.map((text, idx) => ({ text, isCorrect: idx === q.ans }));
      optionsWithMeta.sort(() => Math.random() - 0.5);
      return {
        id: q.id,
        q: q.q,
        cat: q.cat,
        opts: optionsWithMeta.map(o => o.text),
        ans: optionsWithMeta.findIndex(o => o.isCorrect)
      };
    }).sort(() => Math.random() - 0.5);

    setActiveQuizGame({
      questions: randomizedQuestions,
      currentIndex: 0,
      score: 0,
      userAnswer: null,
      category,
      isFinished: false
    });

    sounds.playPop();
    this.render();
  }

  startSpacedRepetitionQuiz() {
    const today = getTodayIso();
    const dueQuestions = (store.state.quiz || []).filter(q => !q.due || q.due <= today);

    if (!dueQuestions.length) {
      showToast("Nenhuma pergunta agendada para revisão hoje!", "info");
      return;
    }

    const randomizedQuestions = dueQuestions.map(q => {
      const optionsWithMeta = q.opts.map((text, idx) => ({ text, isCorrect: idx === q.ans }));
      optionsWithMeta.sort(() => Math.random() - 0.5);
      return {
        id: q.id,
        q: q.q,
        cat: q.cat,
        opts: optionsWithMeta.map(o => o.text),
        ans: optionsWithMeta.findIndex(o => o.isCorrect)
      };
    }).sort(() => Math.random() - 0.5);

    setActiveQuizGame({
      questions: randomizedQuestions,
      currentIndex: 0,
      score: 0,
      userAnswer: null,
      category: "",
      isFinished: false
    });

    sounds.playPop();
    this.render();
  }

  answerQuizQuestion(optIndex) {
    if (!activeQuizGame || activeQuizGame.userAnswer !== null) return;
    const question = activeQuizGame.questions[activeQuizGame.currentIndex];
    const isCorrect = optIndex === question.ans;

    activeQuizGame.userAnswer = optIndex;
    if (isCorrect) {
      activeQuizGame.score++;
      sounds.playSuccess();
    } else {
      sounds.playPop();
    }

    // Update Spaced Repetition Leitner Box interval
    const originalQuizItem = store.state.quiz.find(q => q.id === question.id);
    if (originalQuizItem) {
      const intervals = [1, 3, 7, 16];
      originalQuizItem.box = isCorrect ? Math.min(4, (originalQuizItem.box || 0) + 1) : 0;

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + (isCorrect ? intervals[originalQuizItem.box - 1] : 0));

      // CORREÇÃO: Aplica a data futura em formato YYYY-MM-DD em vez de getTodayIso()
      originalQuizItem.due = nextDueDate.toISOString().split("T")[0];

      store.save();
    }
  }
  nextQuizQuestion() {
    // 1. BLOQUEIO DE CLIQUE DUPLO: Aborta se o quiz já estiver finalizado
    if (!activeQuizGame || activeQuizGame.isFinished) return;

    if (activeQuizGame.currentIndex + 1 < activeQuizGame.questions.length) {
      activeQuizGame.currentIndex++;
      activeQuizGame.userAnswer = null;
    } else {
      activeQuizGame.isFinished = true;

      // 2. SALVAMENTO ESTRITO: Garante que os números não quebrem o XP
      store.state.results.push({
        id: generateId(),
        date: getTodayIso(),
        cat: activeQuizGame.category || "Geral",
        score: Number(activeQuizGame.score),
        total: Number(activeQuizGame.questions.length)
      });
      sounds.playSuccess();
      store.save();
    }
    this.render();
  }

  exitQuiz() {
    setActiveQuizGame(null);
    this.render();
  }

  addManualQuestion() {
    const q = document.getElementById("qq")?.value.trim();
    const cat = document.getElementById("qc")?.value.trim() || "Geral";
    const opts = [0, 1, 2, 3].map(i => document.getElementById(`qo${i}`)?.value.trim());

    if (!q || opts.filter(Boolean).length < 2) {
      showToast("Digite o enunciado e pelo menos 2 alternativas.", "error");
      return;
    }

    const selectedRadio = document.querySelector("[name=cr]:checked");
    const correctIdx = selectedRadio ? parseInt(selectedRadio.value, 10) : 0;

    if (!opts[correctIdx]) {
      showToast("A alternativa marcada como correta não pode ser vazia.", "error");
      return;
    }

    const cleanOpts = [];
    let cleanAnswerIndex = 0;
    opts.forEach((optText, i) => {
      if (optText) {
        if (i === correctIdx) cleanAnswerIndex = cleanOpts.length;
        cleanOpts.push(optText);
      }
    });

    store.ensureSubject(cat);
    store.state.quiz.push({
      id: generateId(),
      q,
      cat,
      opts: cleanOpts,
      ans: cleanAnswerIndex,
      box: 0,
      due: getTodayIso(),
      createdAt: new Date().toISOString() // <-- Carimbo para a pergunta manual
    });

    sounds.playSuccess();
    store.save();
    showToast("Pergunta adicionada ao banco!");
  }

  deleteQuizQuestion(id) {
    showConfirm("Deseja apagar esta pergunta do banco?", () => {
      store.state.quiz = store.state.quiz.filter(q => q.id !== id);
      sounds.playPop();
      store.save();
      showToast("Pergunta removida.");
    });
  }

  onQuizBankSearch(query) {
    setQuizBankFilter("search", query);
    this.refreshQuizBankList();
  }

  onQuizBankCategory(cat) {
    setQuizBankFilter("category", cat);
    this.refreshQuizBankList();
  }

  onQuizBankStatus(status) {
    setQuizBankFilter("status", status);
    this.refreshQuizBankList();
  }

  resetQuizBankFilters() {
    resetQuizBankFilters();
    sounds.playPop();
    const searchInput = document.getElementById("qb-search");
    const catSelect = document.getElementById("qb-cat");
    const statusSelect = document.getElementById("qb-status");
    if (searchInput) searchInput.value = "";
    if (catSelect) catSelect.value = "";
    if (statusSelect) statusSelect.value = "all";
    this.refreshQuizBankList();
  }

  refreshQuizBankList() {
    const container = document.getElementById("qb-items-container");
    const countEl = document.getElementById("qb-count");
    if (!container) {
      this.render();
      return;
    }

    const today = getTodayIso();
    const allQuizList = store.state.quiz || [];
    const filteredQuizList = getFilteredQuizList();

    container.innerHTML = renderQuizBankItems(filteredQuizList, today);

    if (countEl) {
      countEl.textContent = filteredQuizList.length === allQuizList.length
        ? `${allQuizList.length} ${allQuizList.length === 1 ? "pergunta salva" : "perguntas salvas"}`
        : `Exibindo ${filteredQuizList.length} de ${allQuizList.length} perguntas`;
    }

    const clearBtnContainer = document.getElementById("qb-clear-container");
    if (clearBtnContainer) {
      const hasActive = Boolean(quizBankFilter.search || quizBankFilter.category || quizBankFilter.status !== "all");
      clearBtnContainer.style.display = hasActive ? "block" : "none";
    }
  }

  setQuizHistoryCategory(cat) {
    setQuizHistoryFilter("category", cat);
    this.render();
  }

  clearQuizHistory() {
    showConfirm("Deseja apagar todo o histórico de testes realizados?", () => {
      store.state.results = [];
      sounds.playPop();
      store.save();
      showToast("Histórico de testes apagado com sucesso.");
    });
  }

  // Calendário
  changeCalendarMonth(delta) {
    setCalendarMonthOffset(calendarMonthOffset + delta);
    setSelectedCalendarDate(null);
    sounds.playPop();
    this.render();
  }

  selectCalendarDate(dateKey) {
    setSelectedCalendarDate(dateKey);
    sounds.playPop();
    this.render();
  }

  // Dados
  exportData(type) {
    exportData(type);
  }

  importBackup(file) {
    importBackupFile(file);
  }

  wipeAllData() {
    if (!isWipePendingConfirmation) {
      setWipePending(true);
      showToast("Atenção: Clique novamente no botão para confirmar a exclusão de todos os dados.", "error");
      this.render();
      return;
    }

    setWipePending(false);
    store.resetAll();
    sounds.playPop();
    showToast("Todos os dados foram apagados com sucesso.");
  }
}

// Instantiate and expose globally
const app = new Application();
window.studai = app;

// Bootstrap once DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => app.init());
} else {
  app.init();
}
// --- Lógica Global do Dropdown ---
document.addEventListener('click', (e) => {
  const dropdown = e.target.closest('.custom-dropdown');

  // Se clicou fora, fecha todas as listas abertas
  if (!dropdown) {
    document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
    return;
  }

  // Abre ou fecha ao clicar na barra principal
  if (e.target.closest('.dropdown-selected')) {
    dropdown.classList.toggle('open');
  }
  // Seleciona a opção
  else if (e.target.closest('.option')) {
    const clickedOption = e.target.closest('.option');
    const hiddenInput = dropdown.querySelector('input[type="hidden"]');
    const selectedText = dropdown.querySelector('.selected-text');

    // 1. Muda o texto visível e a cor
    if (selectedText) {
      selectedText.textContent = clickedOption.textContent;
      selectedText.style.opacity = "1";
    }

    // 2. O TRUQUE: Atualiza o input invisível e avisa o sistema do StudAI
    if (hiddenInput) {
      hiddenInput.value = clickedOption.dataset.value;
      // Estas duas linhas são o segredo para o Timer e Metas gravarem o valor!
      hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    dropdown.classList.remove('open');
  }
});