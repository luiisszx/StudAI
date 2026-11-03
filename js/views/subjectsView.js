/**
 * StudAI — Subjects View (Matérias & Gestão de Disciplinas)
 */
import { store } from "../store.js";
import { escapeHtml, formatDuration } from "../utils.js";

export function renderSubjects() {
  const subjects = store.getSubjects();
  const nextColor = store.getNextSubjectColor();

  const subjectsListHtml = subjects.length
    ? subjects.map(s => {
      const totalMinutes = store.getTotalSubjectTime(s.name);
      const countSessions = (store.state.sessions || []).filter(sess => (sess.cat || "Geral").toLowerCase() === s.name.toLowerCase()).length;
      return `
          <div class="subj-item" id="subj-${s.id}">
            <span class="color-dot" style="background:${s.color};"></span>
            <div class="info">
              <div class="view-row">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div>
                    <b style="font-size:15px; color:#fff;">${escapeHtml(s.name)}</b>
                    <span class="sub" style="margin-left:8px; font-size:11.5px;">(${countSessions} ${countSessions === 1 ? 'sessão' : 'sessões'})</span>
                  </div>
                  <span class="tag" style="border-color:${s.color}; color:${s.color}; font-weight:700;">${formatDuration(totalMinutes)}</span>
                </div>
              </div>
              <div class="edit-row">
                <input type="text" id="en-${s.id}" value="${escapeHtml(s.name)}" placeholder="Nome da matéria" style="flex:2;">
                <input type="color" id="ec-${s.id}" value="${s.color}" style="width:40px; height:40px; padding:2px; cursor:pointer; border-radius:8px; border:1px solid var(--line);">
                <input type="number" id="et-${s.id}" step="1" placeholder="Ajuste min (+/-)" title="Adicionar ou subtrair minutos manualmente" style="width:130px;">
                <button class="btn" style="padding:6px 14px; font-size:12px;" onclick="window.studai.saveSubject('${s.id}')">Salvar</button>
                <button class="btn o" style="padding:6px 14px; font-size:12px;" onclick="window.studai.cancelEditSubject('${s.id}')">Cancelar</button>
              </div>
            </div>
            <button class="gbtn" title="Editar matéria" onclick="window.studai.startEditSubject('${s.id}')">✎</button>
            <button class="gbtn x" title="Apagar matéria" onclick="window.studai.deleteSubject('${s.id}')">✕</button>
          </div>
        `;
    }).join("")
    : `<div class="empty">Nenhuma matéria criada ainda. Adicione sua primeira matéria acima para organizar seus estudos!</div>`;

  return `
    <div class="card">
      <h3>Nova Matéria</h3>
      <div class="row" style="align-items:center;">
        <input id="mn" placeholder="Nome da matéria (ex: Estruturas de Dados, Inglês Instrumental, Direito)">
        <div style="flex:0 0 auto;">
          <input type="color" id="mc" value="${nextColor}" title="Escolher cor da disciplina" style="width:42px; height:42px; padding:2px; cursor:pointer; border-radius:10px; border:1px solid var(--line);">
        </div>
        <button class="btn" onclick="window.studai.addSubject()">Adicionar Matéria</button>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0;">Minhas Matérias (${subjects.length})</h3>
        <span class="sub">Total acumulado em cada disciplina</span>
      </div>
      ${subjectsListHtml}
    </div>
  `;
}
