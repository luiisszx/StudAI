/**
 * StudAI — Utilities & Helpers (Clean Code)
 */

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {string|number|null|undefined} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

/**
 * Generates a short unique identifier.
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

/**
 * Formats a Date object to 'YYYY-MM-DD'.
 * @param {Date} date 
 * @returns {string}
 */
export function formatDateIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's ISO date string 'YYYY-MM-DD'.
 * @returns {string}
 */
export function getTodayIso() {
  return formatDateIso(new Date());
}

/**
 * Formats minutes into human-readable duration (e.g. '1h30' or '45min').
 * @param {number} minutes 
 * @returns {string}
 */
export function formatDuration(minutes = 0) {
  const num = Number(minutes) || 0;
  if (num >= 60) {
    const hours = Math.floor(num / 60);
    const mins = Math.round(num % 60);
    return `${hours}h${mins > 0 ? String(mins).padStart(2, "0") : ""}`;
  }
  return `${Math.round(num)}min`;
}

/**
 * Formats an ISO date 'YYYY-MM-DD' into Brazilian format 'DD/MM/YYYY'.
 * @param {string} isoString 
 * @returns {string}
 */
export function formatDateBr(isoString) {
  if (!isoString) return "";
  return isoString.split("-").reverse().join("/");
}

/**
 * Case-insensitive alphabetical sort comparator in pt-BR.
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export function sortAlpha(a, b) {
  return String(a || "").localeCompare(String(b || ""), "pt-BR", { sensitivity: "base" });
}

/**
 * Computes the starting date (Monday) of the week for a given date.
 * @param {Date|string} date 
 * @returns {string} ISO Date string
 */
export function getWeekStartIso(date = new Date()) {
  const target = new Date(date);
  const day = target.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  target.setDate(target.getDate() + diff);
  return formatDateIso(target);
}

/**
 * Triggers a browser native file download using Blob URL.
 * @param {string} filename 
 * @param {string} content 
 * @param {string} mimeType 
 */
export function downloadFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Displays a non-blocking toast notification on screen.
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 * @param {number} duration 
 */
export function showToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  const icon = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✨";
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Custom modern confirmation dialog (non-blocking fallback for confirm).
 * @param {string} message 
 * @param {() => void} onConfirm 
 */
export function showConfirm(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <h3 style="margin-bottom:12px; font-size:16px;">Confirmação</h3>
      <p style="margin-bottom:20px; color:var(--tx);">${escapeHtml(message)}</p>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn o" id="modal-cancel">Cancelar</button>
        <button class="btn" id="modal-confirm">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#modal-cancel").onclick = close;
  overlay.querySelector("#modal-confirm").onclick = () => {
    close();
    onConfirm();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}
/**
 * Renderiza o dropdown customizado de matérias
 */
export function renderSubjectDropdown(id, placeholder, currentValue, subjects, extraOnInput = "") {
  const optionsHtml = subjects.map(s => 
    `<div class="option" data-value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>`
  ).join("");

  const displayValue = currentValue ? currentValue : placeholder;
  const opacity = currentValue ? '1' : '0.9';

  return `
    <div class="custom-dropdown" id="${id}-dropdown" style="flex: 1; min-width: 140px;">
      <div class="dropdown-selected">
        <span class="selected-text" style="opacity: ${opacity};">${escapeHtml(displayValue)}</span>
        <span class="arrow" style="font-size: 10px; color: var(--mu);">▼</span>
      </div>
      <div class="dropdown-options">
        <div class="option" data-value="">Geral (Nenhuma)</div>
        ${optionsHtml}
      </div>
      <!-- O Input invisível que comunica com o StudAI -->
      <input type="hidden" id="${id}" value="${escapeHtml(currentValue || "")}" oninput="${extraOnInput}">
    </div>
  `;
}