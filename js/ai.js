/**
 * StudAI — Gemini AI Integration (Clean Code)
 */
import { store } from "./store.js";

const STORAGE_API_KEY = "studai_gemini_key";
const STORAGE_MODEL_KEY = "studai_gemini_model";
const DEFAULT_MODEL = "gemini-2.0-flash";

export const aiConfig = {
  sourceType: "logs", // 'logs' or 'text'
  category: "",
  questionCount: 5,
  customText: "",
  isLoading: false,
  errorMessage: "",
  generatedItems: null // questions awaiting user review
};

export function getApiKey() {
  try {
    return localStorage.getItem(STORAGE_API_KEY) || "";
  } catch {
    return "";
  }
}

export function saveApiKey(key, model) {
  try {
    if (key && !key.startsWith("•")) {
      localStorage.setItem(STORAGE_API_KEY, key.trim());
    }
    if (model && model.trim()) {
      localStorage.setItem(STORAGE_MODEL_KEY, model.trim());
    }
  } catch (err) {
    console.error("Failed to save Gemini key:", err);
  }
}

export function getModelName() {
  try {
    const saved = localStorage.getItem(STORAGE_MODEL_KEY);
    if (!saved || saved === "gemini-2.5-flash") return DEFAULT_MODEL;
    return saved;
  } catch {
    return DEFAULT_MODEL;
  }
}

/**
 * Sends a structured prompt to the Gemini API.
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function callGemini(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Cole sua chave de API do Gemini e clique em 'Salvar chave'.");
  }

  const model = getModelName();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || `Erro ${response.status} na API Gemini.`);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || "").join("");

  if (!text) {
    throw new Error("O Gemini não retornou texto. Tente novamente.");
  }

  return text;
}

/**
 * Builds the source study material text based on user selection.
 * @returns {string}
 */
export function buildSourceText() {
  if (aiConfig.sourceType === "text") {
    return aiConfig.customText.trim();
  }

  return store.state.logs
    .filter(log => !aiConfig.category || (log.cat || "Geral") === aiConfig.category)
    .slice(-40)
    .map(log => `- ${log.topic}: ${log.what}`)
    .join("\n");
}

/**
 * Generates smart quiz questions locally based on topics, materials or flashcards
 * without requiring an external API key (100% offline & instant).
 */
export function generateOfflineQuizQuestions() {
  const logs = store.state.logs || [];
  const subjects = store.getSubjects ? store.getSubjects() : [];
  const selectedCat = aiConfig.category || (subjects[0] ? subjects[0].name : "Geral");
  const filteredLogs = logs.filter(l => !selectedCat || (l.cat || "Geral") === selectedCat);

  const pool = filteredLogs.length > 0 ? filteredLogs : logs;
  if (pool.length === 0) {
    // Se não houver logs de estudo, gera perguntas de metodologias e técnicas de estudo ativo
    return [
      {
        q: `Qual é o objetivo principal da técnica de Repetição Espaçada (Spaced Repetition)?`,
        opts: [
          `Superar a curva do esquecimento revisando o conteúdo em intervalos progressivos.`,
          `Estudar 10 horas seguidas no dia anterior à prova sem pausas.`,
          `Memorizar respostas sem compreender o conceito fundamental.`,
          `Substituir anotações por resumos passivos sublinhados.`
        ],
        ans: 0,
        selected: true,
        userPick: null
      },
      {
        q: `No método Pomodoro tradicional, qual é a estrutura de foco e pausa recomendada?`,
        opts: [
          `50 minutos de estudo e 30 minutos de pausa.`,
          `25 minutos de foco absoluto seguidos de 5 minutos de pausa.`,
          `120 minutos contínuos sem intervalos.`,
          `10 minutos de foco com 20 minutos de descanso.`
        ],
        ans: 1,
        selected: true,
        userPick: null
      },
      {
        q: `Por que a Recordação Ativa (Active Recall) é mais eficiente que a releitura passiva?`,
        opts: [
          `Porque força o cérebro a recuperar a informação, fortalecendo as conexões sinápticas.`,
          `Porque consome menos energia mental do que ler um texto com marcatexto.`,
          `Porque garante memorização instantânea sem necessidade de repetição.`,
          `Porque elimina completamente a necessidade de sono para consolidação.`
        ],
        ans: 0,
        selected: true,
        userPick: null
      }
    ];
  }

  const count = Math.max(1, Math.min(10, parseInt(aiConfig.questionCount, 10) || 4));
  const selectedItems = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);

  return selectedItems.map((item, idx) => {
    const topic = item.topic || "Conceito";
    const what = item.what || "Detalhe relevante aprendido durante a sessão";
    const cat = item.cat || selectedCat;

    const correct = `Em ${topic}: ${what.slice(0, 120)}${what.length > 120 ? "..." : ""}`;
    const distractor1 = `Em ${topic}: aplica-se apenas superficialmente sem relevância prática.`;
    const distractor2 = `Não possui relação direta com os fundamentos de ${cat}.`;
    const distractor3 = `Trata-se de uma hipótese desatualizada já substituída nos estudos modernos.`;

    const rawOpts = [correct, distractor1, distractor2, distractor3];
    // Randomiza a posição da correta
    const shuffled = rawOpts
      .map((val, i) => ({ val, isCorrect: i === 0, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort);

    const ansIdx = shuffled.findIndex(s => s.isCorrect);

    return {
      q: `Em ${cat}, sobre "${topic}": qual afirmação melhor sintetiza o que foi estudado?`,
      opts: shuffled.map(s => s.val),
      ans: ansIdx >= 0 ? ansIdx : 0,
      selected: true,
      userPick: null
    };
  });
}

/**
 * Generates quiz questions using Gemini API.
 * @returns {Promise<Array>}
 */
export async function generateQuizQuestions() {
  const apiKey = getApiKey();
  if (!apiKey) {
    const msg = "Cole sua chave de API do Gemini no campo acima e clique em 'Salvar Chave' para gerar perguntas com IA.";
    aiConfig.errorMessage = msg;
    throw new Error(msg);
  }

  const source = buildSourceText();
  if (!source) {
    const msg = aiConfig.sourceType === "text"
      ? "Cole um texto para gerar as perguntas."
      : "Nenhum registro de estudo encontrado para essa matéria.";
    aiConfig.errorMessage = msg;
    throw new Error(msg);
  }

  const count = Math.max(1, Math.min(15, parseInt(aiConfig.questionCount, 10) || 5));
  aiConfig.isLoading = true;
  aiConfig.errorMessage = "";
  aiConfig.generatedItems = null;

  try {
    const prompt =
      `Você é um professor especializado criando um teste de estudo objetivo e didático. ` +
      `Crie exatamente ${count} perguntas de múltipla escolha em português do Brasil, ` +
      `baseadas EXCLUSIVAMENTE no material a seguir. Cada pergunta deve ter exatamente 4 alternativas (opts), ` +
      `com apenas 1 correta e 3 alternativas incorretas porém plausíveis. Varie a posição da alternativa correta. ` +
      `Responda EXCLUSIVAMENTE em formato JSON puro, sem marcações markdown ou blocos de código, no seguinte formato:\n` +
      `[{"q":"Pergunta aqui","opts":["Opção 1","Opção 2","Opção 3","Opção 4"],"ans":0}]\n` +
      `onde "ans" é o índice numérico (0 a 3) da opção correta.\n\n` +
      `MATERIAL:\n${source}`;

    const rawJson = await callGemini(prompt);
    const startIdx = rawJson.indexOf("[");
    const endIdx = rawJson.lastIndexOf("]");

    if (startIdx < 0 || endIdx < 0) {
      throw new Error("A resposta da IA não veio no formato JSON esperado.");
    }

    const parsed = JSON.parse(rawJson.slice(startIdx, endIdx + 1));
    const validated = parsed
      .filter(item => item && item.q && Array.isArray(item.opts) && item.opts.length === 4 && Number.isInteger(item.ans))
      .map(item => ({
        q: String(item.q),
        opts: item.opts.map(String),
        ans: item.ans,
        selected: true,
        userPick: null
      }));

    if (validated.length === 0) {
      throw new Error("Nenhuma pergunta válida pôde ser estruturada a partir da resposta da IA.");
    }

    aiConfig.generatedItems = validated;
    return validated;
  } catch (err) {
    aiConfig.errorMessage = err.message || String(err);
    throw err;
  } finally {
    aiConfig.isLoading = false;
  }
}

