/**
 * StudAI — Quiz & AI Generator View (Clean Code)
 */
import { store } from "../store.js";
import { aiConfig, getApiKey, getModelName, saveApiKey, generateQuizQuestions } from "../ai.js";
import { escapeHtml, getTodayIso, formatDateBr, sortAlpha, renderSubjectDropdown } from "../utils.js";
import { sounds } from "../audio.js";

export let activeQuizGame = null;

export function setActiveQuizGame(game) {
  activeQuizGame = game;
}

export const quizBankFilter = {
  category: "",
  search: "",
  status: "all" // 'all' | 'due' | 'learned'
};

export const quizHistoryFilter = {
  category: ""
};

export function setQuizBankFilter(key, value) {
  quizBankFilter[key] = value;
}

export function resetQuizBankFilters() {
  quizBankFilter.category = "";
  quizBankFilter.search = "";
  quizBankFilter.status = "all";
}

export function setQuizHistoryFilter(key, value) {
  quizHistoryFilter[key] = value;
}

export function getFilteredQuizList() {
  const today = getTodayIso();
  const allQuizList = store.state.quiz || [];

  return allQuizList.filter(q => {
    // 1. Matéria (Category)
    if (quizBankFilter.category && (q.cat || "Geral") !== quizBankFilter.category) {
      return false;
    }
    // 2. Status de Revisão (Leitner)
    if (quizBankFilter.status === "due") {
      const isDue = !q.due || q.due <= today;
      if (!isDue) return false;
    } else if (quizBankFilter.status === "learned") {
      const isLearned = (q.box || 0) > 0 && q.due && q.due > today;
      if (!isLearned) return false;
    }
    // 3. Busca por texto (pergunta ou respostas)
    if (quizBankFilter.search) {
      const query = quizBankFilter.search.toLowerCase().trim();
      const questionMatches = (q.q || "").toLowerCase().includes(query);
      const answerMatches = q.opts && q.opts[q.ans] && q.opts[q.ans].toLowerCase().includes(query);
      const anyOptMatches = q.opts && q.opts.some(opt => (opt || "").toLowerCase().includes(query));
      const catMatches = (q.cat || "").toLowerCase().includes(query);
      if (!questionMatches && !answerMatches && !anyOptMatches && !catMatches) {
        return false;
      }
    }
    return true;
  });
}

export function renderQuizBankItems(questions, today) {
  if (!questions.length) {
    const hasAnyInStore = (store.state.quiz || []).length > 0;
    return `
      <div class="empty" style="opacity:0.7; border:1px dashed rgba(255,255,255,0.1); border-radius:8px; padding:30px;">
        ${hasAnyInStore
        ? `Nenhuma pergunta encontrada.<br><button class="btn o" style="margin-top:12px;" onclick="window.studai.resetQuizBankFilters()">Limpar filtros</button>`
        : "Banco de perguntas vazio. Adicione perguntas acima ou gere com a IA."
      }
      </div>
    `;
  }

  const intervals = [1, 3, 7, 16];

  // 1. Agrupar perguntas pela data/hora de criação
  const groups = {};
  questions.forEach(q => {
    let key = "Perguntas Antigas";
    let sortVal = 0;

    if (q.createdAt) {
      const d = new Date(q.createdAt);
      const dateStr = d.toLocaleDateString("pt-BR");
      const timeStr = d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      key = `${dateStr} • ${timeStr}`;
      sortVal = d.getTime();
    }

    if (!groups[key]) {
      groups[key] = { title: key, sortVal, items: [] };
    }
    groups[key].items.push(q);
  });

  // 2. Ordenar grupos (mais recentes primeiro)
  const sortedGroups = Object.values(groups).sort((a, b) => b.sortVal - a.sortVal);

  // 3. Renderizar cada grupo
  return sortedGroups.map(group => {
    // Cabeçalho do Grupo (Data e Hora)
    const groupHeader = `
      <div style="margin: 24px 0 12px 0; font-size: 11px; font-weight: 700; color: var(--g); text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; display:flex; align-items:center; gap:6px;">
        <i style="font-style:normal; font-size:14px;">⏱️</i> Lote gerado em: ${group.title}
      </div>
    `;

    // Itens minimalistas dentro do grupo
    const itemsHtml = group.items.map(q => {
      const color = store.getSubjectColor(q.cat);
      const isDue = !q.due || q.due <= today;
      const box = q.box || 0;
      const boxLabel = box === 0 ? "Novo" : `Caixa ${box} (${intervals[box - 1] || 1}d)`;

      const statusIcon = isDue
        ? `<span style="color:#f59e0b;">🟠 Pendente</span>`
        : `<span style="color:var(--g);">🟢 Em dia</span>`;

      return `
        <div class="item" id="q-item-${q.id}" style="border:1px solid rgba(255,255,255,0.03); background:rgba(255,255,255,0.01); border-radius:8px; padding:16px; margin-bottom:8px; display:flex; gap:16px; align-items:flex-start;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
              <span style="color:${color}; display:flex; align-items:center; gap:4px;">
                <i style="width:6px; height:6px; border-radius:50%; background:${color};"></i>
                ${escapeHtml(q.cat || "Geral")}
              </span>
              <span style="color:var(--mu);">·</span>
              <span style="color:var(--mu);">${boxLabel}</span>
              <span style="color:var(--mu);">·</span>
              ${statusIcon}
            </div>
            
            <b style="font-size:14.5px; color:#e4e4e7; line-height:1.5; display:block; margin-bottom:8px;">
              ${escapeHtml(q.q)}
            </b>
            
            <div style="font-size:13px; color:#a1a1aa; line-height:1.5;">
              <span style="color:var(--g); font-weight:700; margin-right:4px;">R:</span>${escapeHtml(q.opts[q.ans])}
            </div>

            ${q.opts && q.opts.length > 1 ? `
              <details style="margin-top:10px; font-size:12px; color:#71717a;">
                <summary style="cursor:pointer; outline:none; transition:color 0.2s;" onmouseover="this.style.color='#a1a1aa'" onmouseout="this.style.color='#71717a'">
                  Ver as ${q.opts.length} alternativas
                </summary>
                <ul style="margin:8px 0 0 16px; padding:0; list-style-type:circle;">
                  ${q.opts.map((opt, idx) => `
                    <li style="margin-bottom:4px; color:${idx === q.ans ? "var(--g)" : "#71717a"}; opacity:${idx === q.ans ? "1" : "0.7"};">
                      ${escapeHtml(opt)}
                    </li>
                  `).join("")}
                </ul>
              </details>
            ` : ""}
          </div>
          <button class="btn x" title="Apagar pergunta" onclick="window.studai.deleteQuizQuestion('${q.id}')" style="background:transparent; border:none; color:#71717a; padding:4px 8px; font-size:14px; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#71717a'">✕</button>
        </div>
      `;
    }).join("");

    return groupHeader + itemsHtml;
  }).join("");
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
${renderSubjectDropdown('ai-cat', 'Matéria (filtro)', aiConfig.category, subjects, "window.studai.setAiCategory(this.value)")}        <input type="number" min="1" max="15" value="${aiConfig.questionCount}" title="Quantidade de perguntas" oninput="window.studai.setAiQuestionCount(this.value)" style="max-width:90px">
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
${renderSubjectDropdown('qc', 'Matéria', '', subjects)}
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

  // 5. Question Bank List with Filter
  const allQuizList = store.state.quiz || [];
  const filteredQuizList = getFilteredQuizList();
  const availableCategories = [...new Set([...allQuizList.map(q => q.cat || "Geral"), ...subjects.map(s => s.name)])].sort(sortAlpha);
  const hasActiveBankFilters = Boolean(quizBankFilter.search || quizBankFilter.category || quizBankFilter.status !== "all");

  const questionBankCard = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
        <h3 style="margin:0;">Banco de Perguntas & Respostas (${allQuizList.length})</h3>
        <span class="sub" id="qb-count">
          ${filteredQuizList.length === allQuizList.length
      ? `${allQuizList.length} ${allQuizList.length === 1 ? "pergunta salva" : "perguntas salvas"}`
      : `Exibindo ${filteredQuizList.length} de ${allQuizList.length} perguntas`
    }
        </span>
      </div>

      ${allQuizList.length > 0 ? `
        <div class="row" style="align-items:center; gap:8px; margin-bottom:14px;">
          <input
            id="qb-search"
            type="search"
            placeholder="🔍 Buscar pergunta ou resposta..."
            value="${escapeHtml(quizBankFilter.search)}"
            oninput="window.studai.onQuizBankSearch(this.value)"
            style="min-width:180px; flex:2;"
          >
          <select
            id="qb-cat"
            onchange="window.studai.onQuizBankCategory(this.value)"
            style="min-width:140px; flex:1;"
          >
            <option value="">Todas as matérias</option>
            ${availableCategories.map(c => `
              <option value="${escapeHtml(c)}" ${quizBankFilter.category === c ? "selected" : ""}>
                ${escapeHtml(c)}
              </option>
            `).join("")}
          </select>
          <select
            id="qb-status"
            onchange="window.studai.onQuizBankStatus(this.value)"
            style="min-width:130px; flex:1;"
          >
            <option value="all" ${quizBankFilter.status === "all" ? "selected" : ""}>Todos os status</option>
            <option value="due" ${quizBankFilter.status === "due" ? "selected" : ""}>🔁 Revisão pendente</option>
            <option value="learned" ${quizBankFilter.status === "learned" ? "selected" : ""}>✔ Em dia</option>
          </select>
          <div id="qb-clear-container" style="display:${hasActiveBankFilters ? "block" : "none"}; flex:0 0 auto;">
            <button class="btn o" title="Limpar todos os filtros" onclick="window.studai.resetQuizBankFilters()" style="padding:10px 14px;">
              Limpar
            </button>
          </div>
        </div>
      ` : ""}

      <div id="qb-items-container">
        ${renderQuizBankItems(filteredQuizList, today)}
      </div>
    </div>
  `;

  // 6. Test History Card with Filter
  const allResults = store.state.results || [];
  const availableHistoryCats = [...new Set(allResults.map(r => r.cat || "Geral"))].sort(sortAlpha);
  const filteredResults = allResults.filter(r => {
    if (quizHistoryFilter.category && (r.cat || "Geral") !== quizHistoryFilter.category) {
      return false;
    }
    return true;
  }).slice().reverse();

  const testHistoryCard = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
        <h3 style="margin:0;">Histórico de Testes Realizados (${allResults.length})</h3>
        ${allResults.length > 0 ? `
          <button class="btn x" style="padding:4px 10px; font-size:12px;" onclick="window.studai.clearQuizHistory()">
            Limpar Histórico
          </button>
        ` : ""}
      </div>

      ${allResults.length > 0 ? `
        <div class="row" style="margin-bottom:14px; align-items:center;">
          <select onchange="window.studai.setQuizHistoryCategory(this.value)" style="max-width:260px;">
            <option value="">Todas as matérias (${allResults.length})</option>
            ${availableHistoryCats.map(c => `
              <option value="${escapeHtml(c)}" ${quizHistoryFilter.category === c ? "selected" : ""}>
                ${escapeHtml(c)} (${allResults.filter(r => (r.cat || "Geral") === c).length})
              </option>
            `).join("")}
          </select>
          ${quizHistoryFilter.category ? `
            <button class="btn o" style="padding:8px 14px;" onclick="window.studai.setQuizHistoryCategory('')">
              Todas as matérias
            </button>
          ` : ""}
        </div>
      ` : ""}

      ${filteredResults.length ? filteredResults.map(r => {
    const color = store.getSubjectColor(r.cat);
    const score = Number(r.score) || 0;
    const total = Number(r.total) || 1;
    const pct = Math.round((score / total) * 100);
    const barColor = pct >= 70 ? "var(--g)" : pct >= 50 ? "var(--yellow)" : "var(--red)";

    return `
          <div class="item">
            <div class="t">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                  <span class="tag" style="border-color:${color};color:${color};">${escapeHtml(r.cat || "Geral")}</span>
                  <span class="sub">${formatDateBr(r.date)}</span>
                </div>
                <div style="font-weight:700; color:${barColor}; font-size:14px;">
                  ${score} / ${total} acertos (${pct}%)
                </div>
              </div>
              <div class="bar" style="margin-top:8px; height:6px;">
                <i style="width:${pct}%; background:${barColor}; box-shadow:0 0 8px ${barColor};"></i>
              </div>
            </div>
          </div>
        `;
  }).join("") : `
        <div class="empty">
          ${allResults.length === 0
      ? "Nenhum teste concluído ainda. Inicie um teste acima para registrar seus resultados!"
      : "Nenhum resultado encontrado para esta matéria."
    }
        </div>
      `}
    </div>
  `;

  return aiGeneratorCard + quizLauncherCard + manualCreatorCard + questionBankCard + testHistoryCard;
}
