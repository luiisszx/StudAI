/**
 * StudAI — Quiz & AI Generator View (Clean Code)
 */
import { store } from "../store.js";
import { aiConfig, getApiKey, getModelName, saveApiKey, generateQuizQuestions } from "../ai.js";
import { escapeHtml, getTodayIso, formatDateBr, sortAlpha } from "../utils.js";
import { sounds } from "../audio.js";

export let activeQuizGame = null;

export function setActiveQuizGame(game) {
  activeQuizGame = game;
}

export function renderQuiz() {
  // 1. If currently inside a quiz gameplay session:
  if (activeQuizGame) {
    if (activeQuizGame.isFinished) {
      const score = activeQuizGame.score;
      const total = activeQuizGame.questions.length;
      const pct = total > 0 ? (score / total) : 0;
      const feedback = pct === 1
        ? "Desempenho perfeito! 🏆 +50 XP bônus!"
        : pct >= 0.6
          ? "Muito bom trabalho! Continue assim! 💪"
          : "Continue praticando, você vai dominar esse conteúdo! 📈";

      return `
        <div class="card" style="text-align:center; padding:32px 20px;">
          <h3>Resultado do Teste</h3>
          <div class="big" style="margin:16px 0">${score} / ${total}</div>
          <p style="font-size:16px; margin-bottom:24px; color:var(--tx);">${feedback}</p>
          <button class="btn" onclick="window.studai.exitQuiz()">Voltar ao Quiz</button>
        </div>
      `;
    }

    const currentQuestion = activeQuizGame.questions[activeQuizGame.currentIndex];
    const userSelectedAnswer = activeQuizGame.userAnswer;
    const progressPct = ((activeQuizGame.currentIndex) / activeQuizGame.questions.length) * 100;

    return `
      <div class="card">
        <h3>Pergunta ${activeQuizGame.currentIndex + 1} de ${activeQuizGame.questions.length}</h3>
        <div class="bar" style="margin-bottom:18px">
          <i style="width:${progressPct}%"></i>
        </div>
        <p style="font-size:18px; font-weight:700; margin-bottom:16px;">${escapeHtml(currentQuestion.q)}</p>
        ${currentQuestion.opts.map((optText, optIndex) => {
          let optionClass = "";
          if (userSelectedAnswer !== null) {
            if (optIndex === currentQuestion.ans) optionClass = "ok";
            else if (optIndex === userSelectedAnswer) optionClass = "bad";
          }
          return `
            <button class="opt ${optionClass}" ${userSelectedAnswer !== null ? "disabled" : ""} onclick="window.studai.answerQuizQuestion(${optIndex})">
              ${escapeHtml(optText)}
            </button>
          `;
        }).join("")}
        ${userSelectedAnswer !== null ? `
          <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <button class="btn" onclick="window.studai.nextQuizQuestion()">
              ${activeQuizGame.currentIndex + 1 < activeQuizGame.questions.length ? "Próxima Pergunta →" : "Ver Resultado"}
            </button>
          </div>
        ` : ""}
      </div>
    `;
  }

  // 2. AI Quiz Generator Card
  const apiKey = getApiKey();
  const currentModel = getModelName();
  const subjects = store.getSubjects();
  const datalistHtml = `<datalist id="cats">${subjects.map(s => `<option value="${escapeHtml(s.name)}">`).join("")}</datalist>`;

  const availableLogsCount = (store.state.logs || [])
    .filter(l => !aiConfig.category || (l.cat || "Geral") === aiConfig.category).length;

  const aiKeyBoxHtml = `
    <div class="row">
      <input id="ai-key" type="password" placeholder="Chave de API do Gemini (AIza...)" value="${apiKey ? "••••••••" : ""}" onfocus="if(this.value.startsWith('•'))this.value=''">
      <input id="ai-model" placeholder="Modelo Gemini" value="${escapeHtml(currentModel)}" title="Modelo do Gemini" style="max-width:180px">
      <button class="btn o" onclick="window.studai.saveAiKey()">Salvar Chave</button>
    </div>
    <div class="sub" style="margin-bottom:14px">
      ${apiKey ? "✔ Chave salva neste navegador." : "Pegue sua chave gratuita em aistudio.google.com/apikey."} Ela fica salva apenas localmente.
    </div>
  `;

  const aiPreviewHtml = aiConfig.generatedItems ? `
    <div style="margin-top:18px; border-top:1px solid var(--line); padding-top:14px;">
      <h4 style="color:var(--g); margin-bottom:10px;">Perguntas geradas pela IA:</h4>
      ${aiConfig.generatedItems.map((item, qIdx) => `
        <div class="item">
          <input type="checkbox" ${item.selected ? "checked" : ""} onchange="window.studai.toggleAiQuestionSelection(${qIdx})">
          <div class="t">
            <b>${escapeHtml(item.q)}</b>
            ${item.opts.map((optText, optIdx) => {
              const isAnswered = item.userPick !== null;
              const optionClass = isAnswered
                ? (optIdx === item.ans ? "ok" : (optIdx === item.userPick ? "bad" : ""))
                : "";
              return `
                <button class="opt ${optionClass}" ${isAnswered ? "disabled" : ""} onclick="window.studai.previewAiAnswer(${qIdx}, ${optIdx})">
                  ${escapeHtml(optText)}
                </button>
              `;
            }).join("")}
            ${item.userPick !== null ? `
              <div class="sub" style="margin-top:4px; color:${item.userPick === item.ans ? "var(--g)" : "var(--red)"}">
                ${item.userPick === item.ans ? "✔ Correto!" : "✘ Incorreto — a resposta correta está destacada em verde."}
              </div>
            ` : ""}
          </div>
        </div>
      `).join("")}
      <div class="row" style="margin-top:14px">
        <button class="btn" onclick="window.studai.saveAiQuestionsToBank()">
          Adicionar selecionadas (${aiConfig.generatedItems.filter(x => x.selected).length})
        </button>
        <button class="btn o" onclick="window.studai.discardAiQuestions()">Descartar</button>
      </div>
    </div>
  ` : "";

  const aiGeneratorCard = `
    <div class="card">
      <h3>✨ Gerador de Quiz com Inteligência Artificial</h3>
      ${aiKeyBoxHtml}
      ${datalistHtml}
      <div class="row">
        <select onchange="window.studai.setAiSourceType(this.value)">
          <option value="logs" ${aiConfig.sourceType === "logs" ? "selected" : ""}>A partir dos meus tópicos de estudo</option>
          <option value="text" ${aiConfig.sourceType === "text" ? "selected" : ""}>A partir de um texto personalizado</option>
        </select>
        <input list="cats" placeholder="Matéria (filtro)" value="${escapeHtml(aiConfig.category)}" onchange="window.studai.setAiCategory(this.value)">
        <input type="number" min="1" max="15" value="${aiConfig.questionCount}" title="Quantidade de perguntas" oninput="window.studai.setAiQuestionCount(this.value)" style="max-width:90px">
      </div>
      ${aiConfig.sourceType === "text"
        ? `<textarea rows="4" placeholder="Cole aqui seu resumo, artigo ou anotação..." oninput="window.studai.setAiCustomText(this.value)" style="margin-bottom:8px">${escapeHtml(aiConfig.customText)}</textarea>`
        : `<div class="sub" style="margin-bottom:10px">${availableLogsCount} ${availableLogsCount === 1 ? "registro disponível" : "registros disponíveis"}${aiConfig.category ? " em " + escapeHtml(aiConfig.category) : ""}. Usa os mais recentes.</div>`
      }
      <button class="btn" onclick="window.studai.triggerAiGeneration()" ${aiConfig.isLoading ? "disabled" : ""}>
        ${aiConfig.isLoading ? "⏳ Gerando com IA..." : "✨ Gerar Perguntas"}
      </button>
      ${aiConfig.errorMessage ? `<div class="sub" style="color:var(--red);margin-top:8px">${escapeHtml(aiConfig.errorMessage)}</div>` : ""}
      ${aiPreviewHtml}
    </div>
  `;

  // 3. Quiz Game Launcher (Normal or Spaced Repetition Due)
  const today = getTodayIso();
  const quizList = store.state.quiz || [];
  const dueQuestions = quizList.filter(q => !q.due || q.due <= today);

  const quizLauncherCard = `
    <div class="card">
      <h3>Praticar e Testar Conhecimento</h3>
      ${quizList.length ? `
        <div class="row">
          <select id="qf">
            <option value="">Todas as matérias</option>
            ${[...new Set(quizList.map(q => q.cat).filter(Boolean))].sort(sortAlpha).map(c => `<option>${escapeHtml(c)}</option>`).join("")}
          </select>
          <button class="btn" onclick="window.studai.startQuiz(document.getElementById('qf').value)">Começar Teste</button>
        </div>
      ` : `<div class="empty">Crie perguntas abaixo ou gere com IA para iniciar um teste.</div>`}

      ${dueQuestions.length ? `
        <div class="row" style="margin-top:12px;">
          <button class="btn" onclick="window.studai.startSpacedRepetitionQuiz()">🔁 Revisão Espaçada do Dia (${dueQuestions.length})</button>
        </div>
        <div class="sub" style="margin-top:6px;">Sistema Leitner: perguntas que você acerta voltam em intervalos maiores (1, 3, 7, 16 dias).</div>
      ` : ""}
    </div>
  `;

  // 4. Manual Question Creator
  const manualCreatorCard = `
    <div class="card">
      <h3>Nova Pergunta Manual</h3>
      <div class="row">
        <input id="qq" placeholder="Enunciado da pergunta">
        <input id="qc" list="cats" placeholder="Matéria">
      </div>
      ${[0, 1, 2, 3].map(i => `
        <div class="row" style="flex-wrap:nowrap;align-items:center">
          <input type="radio" name="cr" value="${i}" ${i === 0 ? "checked" : ""} style="flex:0" title="Marcar como correta">
          <input id="qo${i}" placeholder="Alternativa ${i + 1}${i === 0 ? " (marque a alternativa correta ao lado)" : ""}">
        </div>
      `).join("")}
      <button class="btn" onclick="window.studai.addManualQuestion()">Salvar Pergunta no Banco</button>
    </div>
  `;

  // 5. Question Bank List
  const questionBankCard = `
    <div class="card">
      <h3>Banco de Perguntas (${quizList.length})</h3>
      ${quizList.length ? quizList.map(q => {
        const color = store.getSubjectColor(q.cat);
        return `
          <div class="item">
            <div class="t">
              <b>${escapeHtml(q.q)}</b>
              <br>
              <span class="tag" style="border-color:${color};color:${color};margin-top:4px;">${escapeHtml(q.cat || "Geral")}</span>
              <span class="sub">✔ Resposta correta: ${escapeHtml(q.opts[q.ans])}${q.due ? " · Próxima revisão: " + formatDateBr(q.due) : ""}</span>
            </div>
            <button class="btn x" title="Apagar" onclick="window.studai.deleteQuizQuestion('${q.id}')">✕</button>
          </div>
        `;
      }).join("") : `<div class="empty">Banco de perguntas vazio</div>`}
    </div>
  `;

  return aiGeneratorCard + quizLauncherCard + manualCreatorCard + questionBankCard;
}
