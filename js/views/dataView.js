/**
 * StudAI — Data Management View (Dados: Backup, Exportação e Importação)
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration, getTodayIso, downloadFile, showToast, showConfirm } from "../utils.js";

export let isWipePendingConfirmation = false;
export let lastExportedContent = "";

export function setWipePending(pending) {
  isWipePendingConfirmation = pending;
}

export function setLastExported(content) {
  lastExportedContent = content;
}

export function exportData(type) {
  const today = getTodayIso();
  const state = store.state;

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
    const subjects = store.getSubjects();

    const mdContent = [
      `# StudAI - Resumo de Estudos (${today})\n`,
      `- **Tempo total acumulado**: ${formatDuration(totalMinutes)}`,
      `- **Tópicos registrados**: ${(state.logs || []).length}`,
      `- **Testes realizados**: ${(state.results || []).length}`,
      `- **Tarefas no Kanban**: ${(state.tasks || []).length}\n`,
      `## Matérias`,
      subjects.map(s => `- **${s.name}**: ${formatDuration(store.getTotalSubjectTime(s.name))}`).join("\n"),
      `\n## Metas`,
      (state.goals || []).map(g => `- [${g.done ? "x" : " "}] ${g.text} (${g.cat || "Geral"}${g.due ? `, até ${g.due}` : ""})`).join("\n")
    ].join("\n");

    downloadFile(filename, mdContent, "text/markdown;charset=utf-8");
    setLastExported(mdContent);
    showToast("Resumo Markdown gerado com sucesso!");
  }

  // Trigger UI re-render to display textarea if user wants to copy
  window.studai.render();
}

export function importBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") {
        throw new Error("Arquivo não contém um objeto JSON válido.");
      }
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
  return `
    <div class="card">
      <h3>Exportar Meus Dados</h3>
      <p class="sub" style="margin-bottom:14px;">Baixe uma cópia completa dos seus dados para salvar na sua máquina ou migrar de dispositivo.</p>
      <div class="row">
        <button class="btn" onclick="window.studai.exportData('json')">⬇ Backup Completo (JSON)</button>
        <button class="btn o" onclick="window.studai.exportData('csv')">⬇ Sessões (CSV / Excel)</button>
        <button class="btn o" onclick="window.studai.exportData('md')">⬇ Resumo (Markdown)</button>
      </div>
    </div>

    ${lastExportedContent ? `
      <div class="card">
        <h3>Conteúdo Exportado</h3>
        <p class="sub" style="margin-bottom:8px">Você também pode copiar os dados diretamente abaixo:</p>
        <textarea rows="8" readonly onclick="this.select()" style="font-family:monospace; font-size:12px;">${escapeHtml(lastExportedContent)}</textarea>
      </div>
    ` : ""}

    <div class="card">
      <h3>Importar Backup</h3>
      <p class="sub" style="margin-bottom:12px;">Selecione um arquivo .json exportado anteriormente pelo StudAI:</p>
      <input type="file" accept=".json,application/json" onchange="window.studai.importBackup(this.files[0])">
      <div class="sub" id="impMsg" style="margin-top:8px">Nota: Importar um backup substitui os dados atuais do navegador.</div>
    </div>

    <div class="card">
      <h3>Zona de Perigo</h3>
      <p class="sub" style="margin-bottom:14px;">Esta ação remove permanentemente todas as matérias, sessões, metas e histórico deste navegador.</p>
      <button class="btn x" onclick="window.studai.wipeAllData()">
        ${isWipePendingConfirmation ? "⚠️ Clique novamente para CONFIRMAR a exclusão" : "🗑️ Apagar todos os dados"}
      </button>
    </div>
  `;
}
