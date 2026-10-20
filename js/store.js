/**
 * StudAI — Data Store & Persistence Layer (Firebase Integration)
 */
import { generateId, sortAlpha, getTodayIso } from "./utils.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Suas chaves do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBB0FVrFk7KYq8CAIsLulO8L9x7ljGbevs",
  authDomain: "studai-luis.firebaseapp.com",
  projectId: "studai-luis",
  storageBucket: "studai-luis.firebasestorage.app",
  messagingSenderId: "1066431366775",
  appId: "1:1066431366775:web:6d4881d3d82dc1c0776872"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export const STORAGE_KEY = "studai_v2";

export const SUBJECT_PALETTE = [
  "#2dff7a", "#3b82f6", "#a855f7", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#8b5cf6", "#14b8a6", "#eab308"
];

class AppStore {
  constructor() {
    this.state = this.getDefaultState();
    this.listeners = new Set();
    this.currentUser = null;
    this.setupAuth();
    this.loadLocal(); // Carrega localmente primeiro para ser rápido
  }

  getDefaultState() {
    return {
      subjects: [], topics: [], goals: [], sessions: [],
      quiz: [], results: [], logs: [], tasks: [], claimed_missions: []
    };
  }

  // --- Autenticação ---
  // --- Autenticação ---
  setupAuth() {
    // 1. Verifica se o utilizador está a entrar através de um link de e-mail (Magic Link)
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Por favor, confirme o seu e-mail para motivos de segurança:');
      }
      signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState(null, '', window.location.pathname); // Limpa o link feio da barra de endereços
        })
        .catch((error) => console.error("Erro no login por email:", error));
    }

    // 2. Monitoriza o estado normal de login
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      this.updateAuthUI(user);

      if (user) {
        await this.loadFromCloud(user.uid);
      } else {
        this.state = this.getDefaultState();
        this.notify();
      }
    });

    // 3. Ligar os botões do HTML
    setTimeout(() => {
      const btnLoginOverlay = document.getElementById("btn-login-overlay");
      const btnLoginEmail = document.getElementById("btn-login-email");
      const btnLogout = document.getElementById("btn-logout");

      // Botão Google
      if (btnLoginOverlay) {
        btnLoginOverlay.onclick = () => signInWithRedirect(auth, provider);
      }

      // Botão E-mail (Magic Link)
      if (btnLoginEmail) {
        btnLoginEmail.onclick = () => {
          const emailInput = document.getElementById("email-input");
          const email = emailInput ? emailInput.value.trim() : "";

          if (!email) {
            alert("Por favor, digite um e-mail válido.");
            return;
          }

          const actionCodeSettings = {
            url: window.location.href, // Retorna para a página atual após o login
            handleCodeInApp: true
          };

          btnLoginEmail.textContent = "A enviar...";

          sendSignInLinkToEmail(auth, email, actionCodeSettings)
            .then(() => {
              window.localStorage.setItem('emailForSignIn', email);
              btnLoginEmail.textContent = "Link Enviado! ✔️";
              btnLoginEmail.style.background = "#10b981"; // Muda para verde
              alert("Link de acesso enviado! Verifique a sua caixa de entrada (e a pasta de Spam).");
            })
            .catch((error) => {
              console.error("Erro ao enviar email:", error);
              btnLoginEmail.textContent = "Receber Link de Acesso";
              alert("Erro ao enviar o link. Verifique se o e-mail está correto.");
            });
        };
      }
      if (btnLogout) btnLogout.onclick = () => signOut(auth);
    }, 100);
  }

  updateAuthUI(user) {
    const loginOverlay = document.getElementById("login-overlay");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");

    if (user) {
      // Se estiver logado: esconde a tela de login e mostra as informações do utilizador
      if (loginOverlay) loginOverlay.style.display = "none";
      if (userInfo) userInfo.style.display = "flex";
      if (userName) userName.textContent = user.displayName || user.email;
    } else {
      // Se estiver deslogado: mostra a tela de login cobrindo o site inteiro
      if (loginOverlay) loginOverlay.style.display = "flex";
      if (userInfo) userInfo.style.display = "none";
    }
  }
  // --- Banco de Dados Nuvem vs Local ---
  async loadFromCloud(uid) {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        this.state = { ...this.getDefaultState(), ...docSnap.data() };
      } else {
        // Primeiro login, salva os dados locais (se existirem) na nuvem
        await this.saveToCloud(uid);
      }
      this.enforceArrays();
      this.migrateSubjects();
      this.notify();
    } catch (err) {
      console.error("Erro ao carregar do Firebase:", err);
    }
  }

  async saveToCloud(uid) {
    try {
      await setDoc(doc(db, "users", uid), this.state);
    } catch (err) {
      console.error("Erro ao salvar no Firebase:", err);
    }
  }

  loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = { ...this.getDefaultState(), ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error("Erro no local storage:", err);
    }
    this.enforceArrays();
    this.migrateSubjects();
    this.notify();
  }

  enforceArrays() {
    if (!Array.isArray(this.state.tasks)) this.state.tasks = [];
    if (!Array.isArray(this.state.claimed_missions)) this.state.claimed_missions = [];
    if (!Array.isArray(this.state.logs)) this.state.logs = [];
  }

  save() {
    this.state._t = Date.now();

    // Salva localmente sempre (Backup/Offline)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) { }

    // Salva na nuvem se estiver logado
    if (this.currentUser) {
      this.saveToCloud(this.currentUser.uid);
    }

    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // --- Demais Helpers (Mantidos intactos) ---
  migrateSubjects() {
    if (this.state.subjects.length > 0) return;
    const discoveredNames = new Set();
    [...this.state.topics, ...this.state.sessions, ...this.state.quiz].forEach(item => {
      if (item && item.cat) discoveredNames.add(item.cat);
    });
    if (discoveredNames.size === 0 && this.state.topics.length === 0 && this.state.sessions.length === 0) return;

    let index = 0;
    discoveredNames.forEach(name => {
      this.state.subjects.push({ id: generateId(), name, color: SUBJECT_PALETTE[index % SUBJECT_PALETTE.length] });
      index++;
    });
    if (this.state.subjects.length === 0) {
      this.state.subjects.push({ id: generateId(), name: "Geral", color: SUBJECT_PALETTE[0] });
    }
    this.save();
  }

  getSubjects() { return this.state.subjects.slice().sort((a, b) => sortAlpha(a.name, b.name)); }
  getSubjectByName(name) { return !name ? null : this.state.subjects.find(s => s.name.toLowerCase() === name.trim().toLowerCase()); }
  getSubjectColor(name) { const s = this.getSubjectByName(name); return s ? s.color : SUBJECT_PALETTE[0]; }
  getNextSubjectColor() { const used = new Set(this.state.subjects.map(s => s.color)); return SUBJECT_PALETTE.find(c => !used.has(c)) || SUBJECT_PALETTE[this.state.subjects.length % SUBJECT_PALETTE.length]; }

  ensureSubject(name) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    let existing = this.getSubjectByName(trimmed);
    if (!existing) {
      existing = { id: generateId(), name: trimmed, color: this.getNextSubjectColor() };
      this.state.subjects.push(existing);
      this.save();
    }
    return existing;
  }

  addSubject(name, color) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("O nome da matéria não pode ser vazio.");
    if (this.getSubjectByName(trimmed)) throw new Error("Já existe uma matéria com esse nome.");
    const subject = { id: generateId(), name: trimmed, color: color || this.getNextSubjectColor() };
    this.state.subjects.push(subject);
    this.save();
    return subject;
  }

  updateSubject(id, newName, newColor, timeAdjustment = 0) {
    const subject = this.state.subjects.find(s => s.id === id);
    if (!subject) return;
    const trimmedName = newName.trim();
    if (!trimmedName) throw new Error("O nome não pode ficar vazio.");

    if (trimmedName !== subject.name) {
      const oldName = subject.name;
      this.state.topics.forEach(t => { if (t.cat === oldName) t.cat = trimmedName; });
      this.state.sessions.forEach(s => { if (s.cat === oldName) s.cat = trimmedName; });
      this.state.quiz.forEach(q => { if (q.cat === oldName) q.cat = trimmedName; });
      this.state.goals.forEach(g => { if (g.cat === oldName) g.cat = trimmedName; });
      this.state.logs.forEach(l => { if (l.cat === oldName) l.cat = trimmedName; });
      this.state.tasks.forEach(k => { if (k.cat === oldName) k.cat = trimmedName; });
      subject.name = trimmedName;
    }
    if (newColor) subject.color = newColor;
    if (timeAdjustment !== 0) {
      this.state.sessions.push({ id: generateId(), date: getTodayIso(), min: Number(timeAdjustment), cat: subject.name, note: "Ajuste manual" });
    }
    this.save();
  }

  deleteSubject(id) {
    this.state.subjects = this.state.subjects.filter(s => s.id !== id);
    this.save();
  }

  getTotalSubjectTime(name) {
    const target = (name || "Geral").toLowerCase();
    return this.state.sessions.filter(s => (s.cat || "Geral").toLowerCase() === target).reduce((sum, s) => sum + (Number(s.min) || 0), 0);
  }

  addStudySession({ minutes, category, topic, what, date = getTodayIso() }) {
    const cat = (category || "Geral").trim();
    this.ensureSubject(cat);
    const sid = generateId();
    this.state.sessions.push({ id: sid, date, min: Number(Number(minutes).toFixed(1)), cat });
    if (topic && what) {
      this.state.logs.push({ id: generateId(), sid, topic: topic.trim(), what: what.trim(), cat, date });
    }
    this.save();
  }

  resetAll() {
    this.state = this.getDefaultState();
    this.save();
  }

  replaceData(newData) {
    this.state = { ...this.getDefaultState(), ...newData };
    this.migrateSubjects();
    this.save();
  }
}

export const store = new AppStore();