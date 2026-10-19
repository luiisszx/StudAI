/**
 * StudAI — Subjects View (Matérias)
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration } from "../utils.js";

export function renderSubjects() {
  const subjects = store.getSubjects();
  const nextColor = store.getNextSubjectColor();

  const subjectsListHtml = subjects.length
    ? subjects.map(s => {
        const totalMinutes = store.getTotalSubjectTime(s.name);
        return `
          <div class="subj-item" id="subj-${s.id}">
            <span class="color-dot" style="background:${s.color};color:${s.color}"></span>
            <div class="info">
              <div class="view-row">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <b>${escapeHtml(s.name)}</b>
                  <span class="tag" style="border-color:${s.color};color:${s.color};">${formatDuration(totalMinutes)}</span>
                </div>
              </div>
              <div class="edit-row">
                <input type="text" id="en-${s.id}" value="${escapeHtml(s.name)}" placeholder="Nome">
                <input type="color" id="ec-${s.id}" value="${s.color}" style="width:40px;height:40px;padding:2px;cursor:pointer">
                <input type="number" id="et-${s.id}" step="1" placeholder="Ajustar min (+/-)" title="Adiciona ou remove minutos" style="width:120px">
                <button class="btn" onclick="window.studai.saveSubject('${s.id}')">Salvar</button>
                <button class="btn o" onclick="window.studai.cancelEditSubject('${s.id}')">Cancelar</button>
              </div>
            </div>
            <button class="btn o" title="Editar" onclick="window.studai.startEditSubject('${s.id}')">✎</button>
            <button class="btn x" title="Apagar" onclick="window.studai.deleteSubject('${s.id}')">✕</button>
          </div>
        `;
      }).join("")
    : `<div class="empty">Nenhuma matéria criada ainda. Adicione sua primeira matéria acima!</div>`;

  return `
    <div class="card">
      <h3>Nova matéria</h3>
      <div class="row">
        <input id="mn" placeholder="Nome da matéria (ex: Estrutura de Dados, Inglês)">
        <div style="flex:0 0 auto">
          <input type="color" id="mc" value="${nextColor}" title="Escolher cor" style="width:44px;height:44px;padding:2px;cursor:pointer;border-radius:10px;border:1px solid var(--line)">
        </div>
      </div>
      <button class="btn" onclick="window.studai.addSubject()">Adicionar matéria</button>
    </div>

    <div class="card">
      <h3>Minhas matérias (${subjects.length})</h3>
      ${subjectsListHtml}
    </div>
  `;
}
