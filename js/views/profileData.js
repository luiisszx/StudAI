/**
 * StudAI — View de Perfil
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration, getTodayIso, downloadFile, showToast } from "../utils.js";
import { calculateXP, calculateLevelData } from "../gamification.js";

export let isWipePendingConfirmation = false;
export let lastExportedContent = "";

export function setWipePending(pending) {
  isWipePendingConfirmation = pending;
}

export function setLastExported(content) {
  lastExportedContent = content;
}

export function saveProfile(event) {
  event.preventDefault();
  const formData = new FormData(event.target);

  if (!store.state.profile) store.state.profile = {};

  store.state.profile.name = formData.get("name") || "Estudante";
  store.state.profile.email = formData.get("email") || "";
  store.state.profile.targetGoal = formData.get("targetGoal") || "";
  store.state.profile.dailyGoalHours = Number(formData.get("dailyGoalHours")) || 2;
  store.state.profile.avatarUrl = formData.get("avatarUrl") || "";

  if (typeof store.save === 'function') store.save();

  showToast("Perfil atualizado com sucesso!");
  window.studai.render();
}

export function exportData(type) {
  const today = getTodayIso();
  const state = store.state;
  const profile = state.profile || {};

  if (type === "json") {
    const filename = `studai-backup-${today}.json`;
    const jsonString = JSON.stringify(state, null, 2);
    downloadFile(filename, jsonString, "application/json");
    setLastExported(jsonString);
    showToast("Backup JSON gerado com sucesso!");
  } else if (type === "csv") {
    const filename = `studai-sessoes-${today}.csv`;
    const header = "data,minutos,categoria\n";
    const rows = (state.sessions || [])
      .map(s => [s.date, s.min, `"${(s.cat || "").replace(/"/g, '""')}"`].join(","))
      .join("\n");
    const csvContent = header + rows;
    downloadFile(filename, csvContent, "text/csv;charset=utf-8");
    setLastExported(csvContent);
    showToast("Planilha CSV exportada com sucesso!");
  } else if (type === "md") {
    const filename = `studai-resumo-${today}.md`;
    const totalMinutes = (state.sessions || []).reduce((a, s) => a + (Number(s.min) || 0), 0);
    const subjects = store.getSubjects ? store.getSubjects() : [];
    const realXp = calculateXP(state);

    const mdContent = [
      `# 🎓 StudAI - Relatório de Desempenho`,
      `**Estudante**: ${profile.name || "Não informado"}`,
      `**Foco/Objetivo**: ${profile.targetGoal || "Geral"}`,
      `**Data de Emissão**: ${today}\n`,
      `---`,
      `## 📊 Visão Geral de Estudo`,
      `- **Tempo Total Acumulado**: ${formatDuration(totalMinutes)} (${realXp} XP)`,
      `- **Meta Diária**: ${profile.dailyGoalHours || 0} horas`,
      `- **Tópicos Registrados**: ${(state.logs || []).length}`,
      `- **Testes Realizados**: ${(state.results || []).length}`,
      `- **Tarefas no Kanban**: ${(state.tasks || []).length}\n`,
      `## 📚 Tempo por Matéria`,
      subjects.length > 0
        ? subjects.map(s => `- **${s.name}**: ${formatDuration(store.getTotalSubjectTime(s.name))}`).join("\n")
        : "_Nenhuma matéria registrada._"
    ].join("\n");

    downloadFile(filename, mdContent, "text/markdown;charset=utf-8");
    setLastExported(mdContent);
    showToast("Resumo Markdown gerado com sucesso!");
  }

  window.studai.render();
}

export function importBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("Arquivo não contém um objeto JSON válido.");
      store.replaceData(data);
      showToast("Backup importado com sucesso! Dados restaurados.");
      const msgEl = document.getElementById("impMsg");
      if (msgEl) msgEl.textContent = "✔ Backup importado com sucesso!";
    } catch (err) {
      showToast("Arquivo de backup inválido: " + err.message, "error");
      const msgEl = document.getElementById("impMsg");
      if (msgEl) msgEl.textContent = "Erro: Arquivo inválido.";
    }
  };

  reader.readAsText(file);
}

export function renderData() {
  const profile = store.state.profile || {
    name: "Digite seu nome",
    email: "",
    targetGoal: "Curso ou Concurso",
    dailyGoalHours: 2,
    avatarUrl: ""
  };

  const realXp = calculateXP(store.state);
  const levelData = calculateLevelData(realXp);

  return `
    <!-- Esconde a barra de nível global no cabeçalho -->
    <style>
      .user-level-container { 
        display: none !important; 
      }
    </style>

    <!-- Cartão de Perfil Principal -->
    <div class="card profile-header" style="display: flex; gap: 20px; align-items: center; background: rgba(255, 255, 255, 0.03);">
      <div class="avatar-container" style="text-align: center;">
        <img 
          src="${escapeHtml(profile.avatarUrl) || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(profile.name)}" 
          alt="Avatar" 
          style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #6c5ce7;"
        />
      </div>
      <div style="flex: 1;">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
          ${escapeHtml(profile.name)}
          <span style="font-size: 12px; background: #6c5ce7; color: white; padding: 3px 8px; border-radius: 12px; font-weight: normal;">
            Nível ${levelData.level} ${levelData.rankTitle}
          </span>
        </h2>
        <p style="font-size: 14px; font-weight: bold; color: #00e676; margin: 4px 0 8px 0;">
          🌟 ${realXp} XP
        </p>
        <p class="sub" style="margin: 4px 0 8px 0;">🎯 <strong>Objetivo:</strong> ${escapeHtml(profile.targetGoal)}</p>
      </div>
    </div>

    <!-- Editar Perfil -->
    <div class="card">
      <h3>👤 Editar Meu Perfil</h3>
      <form onsubmit="window.studai.saveProfile(event)" style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <div class="row">
          <div style="flex: 1;">
            <label style="font-size: 12px;">Nome / Apelido:</label>
            <input type="text" name="name" value="${escapeHtml(profile.name)}" required style="width: 100%; margin-top: 4px;">
          </div>
          <div style="flex: 1;">
            <label style="font-size: 12px;">E-mail (opcional):</label>
            <input type="email" name="email" value="${escapeHtml(profile.email)}" style="width: 100%; margin-top: 4px;">
          </div>
        </div>

        <div class="row">
          <div style="flex: 2;">
            <label style="font-size: 12px;">Curso / Concurso / Objetivo Principal:</label>
            <input type="text" name="targetGoal" value="${escapeHtml(profile.targetGoal)}" placeholder="Ex: Enem / OAB / Concurso" style="width: 100%; margin-top: 4px;">
          </div>
          <div style="flex: 1;">
            <label style="font-size: 12px;">Meta Diária (Horas):</label>
            <input type="number" step="0.5" min="0.5" name="dailyGoalHours" value="${profile.dailyGoalHours}" style="width: 100%; margin-top: 4px;">
          </div>
        </div>

        <div>
          <label style="font-size: 12px;">URL da Foto / Avatar:</label>
          <input type="url" name="avatarUrl" value="${escapeHtml(profile.avatarUrl)}" placeholder="https://..." style="width: 100%; margin-top: 4px;">
        </div>

        <button type="submit" class="btn" style="align-self: flex-start; margin-top: 6px;">💾 Salvar Perfil</button>
      </form>
    </div>

    <!-- Exportar Dados -->
    <div class="card">
      <h3>📦 Backup e Exportação</h3>
      <p class="sub" style="margin-bottom:14px;">Baixe uma cópia do seu perfil e histórico de estudos para salvar na sua máquina.</p>
      <div class="row">
        <button class="btn" onclick="window.studai.exportData('json')">⬇ Backup Completo (JSON)</button>
        <button class="btn o" onclick="window.studai.exportData('csv')">⬇ Histórico (CSV)</button>
        <button class="btn o" onclick="window.studai.exportData('md')">⬇ Relatório (Markdown)</button>
      </div>
    </div>

    ${lastExportedContent ? `
      <div class="card">
        <h3>📋 Conteúdo Exportado</h3>
        <p class="sub" style="margin-bottom:8px">Você pode copiar o conteúdo gerado diretamente abaixo:</p>
        <textarea rows="8" readonly onclick="this.select()" style="font-family:monospace; font-size:12px; width:100%;">${escapeHtml(lastExportedContent)}</textarea>
      </div>
    ` : ""}

    <!-- Importar Backup -->
    <div class="card">
      <h3>📥 Restaurar Perfil (Importar)</h3>
      <p class="sub" style="margin-bottom:12px;">Selecione um arquivo .json para restaurar seu perfil e dados de estudo:</p>
      <input type="file" accept=".json,application/json" onchange="window.studai.importBackup(this.files[0])">
      <div class="sub" id="impMsg" style="margin-top:8px">Nota: A importação substitui o perfil atual.</div>
    </div>

    <!-- Zona de Perigo -->
    <div class="card">
      <h3>🚨 Zona de Perigo</h3>
      <p class="sub" style="margin-bottom:14px;">Esta ação remove permanentemente seu perfil e todo o histórico deste navegador.</p>
      <button class="btn x" onclick="window.studai.wipeAllData()">
        ${isWipePendingConfirmation ? "⚠️ Clique novamente para CONFIRMAR a exclusão" : "🗑️ Apagar Perfil e Dados"}
      </button>
    </div>
  `;
}