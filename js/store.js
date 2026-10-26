/**
 * StudAI — Data Store & Persistence Layer (Firebase Integration)
 */
import { generateId, sortAlpha, getTodayIso } from "./utils.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
    const today = getTodayIso();
    return {
      profile: {
        name: "Estudante",
        email: "",
        targetGoal: "Programação / Tech",
        dailyGoalHours: 2,
        avatarUrl: ""
      },
      subjects: [
        { id: "sub_1", name: "Programação", color: "#2dff7a" },
        { id: "sub_2", name: "Matemática", color: "#3b82f6" },
        { id: "sub_3", name: "Inglês", color: "#a855f7" }
      ],
      topics: [],
      goals: [
        { id: "goal_1", text: "Estudar 2h diariamente com foco total", cat: "Programação", hours: 2, due: "", done: false, created: today }
      ],
      sessions: [
        { id: "sess_1", date: today, min: 45, cat: "Programação" },
        { id: "sess_2", date: today, min: 30, cat: "Matemática" },
        { id: "sess_3", date: today, min: 25, cat: "Inglês" }
      ],
      quiz: [
        {
          id: "q_demo_1",
          cat: "Programação",
          q: "Qual estrutura de dados opera sob o princípio LIFO (Last-In, First-Out)?",
          opts: ["Fila (Queue)", "Pilha (Stack)", "Lista Duplamente Encadeada", "Tabela Hash"],
          ans: 1,
          box: 1,
          due: today,
          createdAt: new Date().toISOString()
        },
        {
          id: "q_demo_2",
          cat: "Inglês",
          q: "Qual 'phrasal verb' significa desistir de um objetivo ou tarefa?",
          opts: ["Look into", "Give up", "Carry on", "Turn out"],
          ans: 1,
          box: 0,
          due: today,
          createdAt: new Date().toISOString()
        }
      ],
      results: [
        { date: today, score: 5, total: 5, cat: "Programação" },
        { date: today, score: 4, total: 5, cat: "Inglês" }
      ],
      logs: [
        {
          id: "log_demo_1",
          sid: "sess_1",
          cat: "Programação",
          topic: "Estruturas de Dados e Algoritmos",
          what: "Implementação de pilhas e filas com complexidade O(1) para operações básicas de inserção e remoção.",
          date: today
        },
        {
          id: "log_demo_2",
          sid: "sess_2",
          cat: "Matemática",
          topic: "Cálculo e Taxas de Variação",
          what: "Conceito de derivada como o limite da razão incremental e inclinação da reta tangente em um ponto da curva.",
          date: today
        },
        {
          id: "log_demo_3",
          sid: "sess_3",
          cat: "Inglês",
          topic: "Vocabulário de Transição Argumentativa",
          what: "Uso prático de conectivos avançados: Furthermore, Nevertheless, On the contrary e In spite of.",
          date: today
        }
      ],
      tasks: [
        { id: "task_demo_1", text: "Resolver 5 exercícios práticos de recursão", cat: "Programação", status: "todo", date: today },
        { id: "task_demo_2", text: "Treinar listening com podcast 20min", cat: "Inglês", status: "doing", date: today }
      ],
      claimed_missions: []
    };
  }

  // --- Autenticação ---
  setupAuth() {
    // 1. Magic Link (se aberto via link de email)
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Por favor, confirme o seu e-mail para motivos de segurança:');
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
            window.history.replaceState(null, '', window.location.pathname);
          })
          .catch((error) => console.error("Erro no login por email:", error));
      }
    }

    // 2. Monitoriza o estado de login
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        if (!this.state.profile) this.state.profile = {};
        if (user.displayName && (!this.state.profile.name || this.state.profile.name === "Estudante")) {
          this.state.profile.name = user.displayName;
        }
        if (user.email) {
          this.state.profile.email = user.email;
        }
        await this.loadFromCloud(user.uid);
      } else {
        this.loadLocal();
      }
      this.updateAuthUI(user);
    });

    // 3. Ligar os botões e abas do modal de Login / Cadastro
    setTimeout(() => {
      const tabLogin = document.getElementById("tab-auth-login");
      const tabRegister = document.getElementById("tab-auth-register");
      const paneLogin = document.getElementById("pane-login");
      const paneRegister = document.getElementById("pane-register");

      // Alternar abas: Entrar vs Criar Conta
      if (tabLogin && tabRegister && paneLogin && paneRegister) {
        tabLogin.onclick = () => {
          tabLogin.classList.add("active");
          tabRegister.classList.remove("active");
          paneLogin.classList.add("active");
          paneRegister.classList.remove("active");
        };

        tabRegister.onclick = () => {
          tabRegister.classList.add("active");
          tabLogin.classList.remove("active");
          paneRegister.classList.add("active");
          paneLogin.classList.remove("active");
        };
      }

      // Seletor de Horas da Meta Diária
      const hourBtns = document.querySelectorAll(".hour-btn");
      const hoursBadge = document.getElementById("reg-hours-badge");
      const dailyHoursInput = document.getElementById("reg-daily-hours");

      hourBtns.forEach(btn => {
        btn.onclick = () => {
          hourBtns.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const hours = Number(btn.dataset.hours) || 2;
          if (dailyHoursInput) dailyHoursInput.value = hours;
          if (hoursBadge) {
            hoursBadge.textContent = `${hours} ${hours === 1 ? 'hora' : 'horas'} / dia (~${hours * 7}h/semana)`;
          }
        };
      });

      // Seletor de Chips de Objetivo
      const goalChips = document.querySelectorAll("#reg-goal-chips .chip-item");
      const goalInput = document.getElementById("reg-goal");
      goalChips.forEach(chip => {
        chip.onclick = () => {
          if (goalInput) {
            goalInput.value = chip.dataset.goal || chip.textContent.trim();
          }
        };
      });

      // Seletor de Matérias Iniciais
      const subjectsChipsContainer = document.getElementById("reg-subjects-chips");
      if (subjectsChipsContainer) {
        subjectsChipsContainer.addEventListener("click", (e) => {
          const chip = e.target.closest(".chip-item");
          if (!chip) return;
          const isAct = chip.classList.toggle("active");
          const rawName = chip.dataset.subject || chip.textContent.replace("✓", "").trim();
          chip.textContent = isAct ? `✓ ${rawName}` : rawName;
        });
      }

      // Adicionar Matéria Customizada
      const btnAddRegSubj = document.getElementById("btn-add-reg-subject");
      const inputCustomSubj = document.getElementById("reg-custom-subject");
      if (btnAddRegSubj && inputCustomSubj && subjectsChipsContainer) {
        const handleAddCustom = () => {
          const name = inputCustomSubj.value.trim();
          if (!name) return;
          const existing = Array.from(subjectsChipsContainer.querySelectorAll(".chip-item"))
            .find(c => (c.dataset.subject || "").toLowerCase() === name.toLowerCase());
          if (existing) {
            existing.classList.add("active");
            existing.textContent = `✓ ${name}`;
          } else {
            const span = document.createElement("span");
            span.className = "chip-item active";
            span.dataset.subject = name;
            span.textContent = `✓ ${name}`;
            subjectsChipsContainer.appendChild(span);
          }
          inputCustomSubj.value = "";
        };

        btnAddRegSubj.onclick = handleAddCustom;
        inputCustomSubj.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAddCustom();
          }
        };
      }

      // Submissão de Cadastro (Criar Conta)
      const btnRegisterSubmit = document.getElementById("btn-register-submit");
      if (btnRegisterSubmit) {
        btnRegisterSubmit.onclick = async () => {
          const nameInput = document.getElementById("reg-name");
          const emailInput = document.getElementById("reg-email");
          const passInput = document.getElementById("reg-password");
          const goalInput = document.getElementById("reg-goal");
          const hoursInput = document.getElementById("reg-daily-hours");

          const name = nameInput ? nameInput.value.trim() : "";
          const email = emailInput ? emailInput.value.trim() : "";
          const password = passInput ? passInput.value : "";
          const targetGoal = goalInput ? goalInput.value.trim() : "";
          const dailyHours = hoursInput ? Number(hoursInput.value) || 2 : 2;

          // Validações
          if (!name) {
            alert("Por favor, preencha o seu nome ou apelido.");
            nameInput?.focus();
            return;
          }

          if (!email) {
            alert("O e-mail é obrigatório para criar a sua conta e salvar seu perfil.");
            emailInput?.focus();
            return;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            alert("Por favor, informe um endereço de e-mail válido (ex: seu@email.com).");
            emailInput?.focus();
            return;
          }

          if (!password || password.length < 6) {
            alert("A senha é obrigatória e deve ter pelo menos 6 caracteres.");
            passInput?.focus();
            return;
          }

          const selectedChips = document.querySelectorAll("#reg-subjects-chips .chip-item.active");
          const chosenSubjects = Array.from(selectedChips)
            .map(c => c.dataset.subject || c.textContent.replace("✓", "").trim())
            .filter(Boolean);

          btnRegisterSubmit.disabled = true;
          btnRegisterSubmit.textContent = "⏳ Configurando seu perfil...";

          // Salvar perfil no Store
          if (!this.state.profile) this.state.profile = {};
          this.state.profile.name = name;
          this.state.profile.email = email;
          this.state.profile.targetGoal = targetGoal || "Geral";
          this.state.profile.dailyGoalHours = dailyHours;
          this.state.profile.registeredAt = new Date().toISOString();

          // Adicionar matérias escolhidas
          if (chosenSubjects.length > 0) {
            chosenSubjects.forEach(sName => {
              this.ensureSubject(sName);
            });
          }

          // Criar meta diária inicial
          if (!this.state.goals || this.state.goals.length === 0) {
            this.state.goals = [
              {
                id: generateId(),
                text: `Estudar ${dailyHours}h diárias com foco total`,
                cat: chosenSubjects[0] || "Geral",
                hours: dailyHours,
                due: "",
                done: false,
                created: getTodayIso()
              }
            ];
          }

          try {
            // Tenta criar usuário no Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (userCredential.user) {
              await updateProfile(userCredential.user, { displayName: name });
              this.currentUser = userCredential.user;
              await this.saveToCloud(userCredential.user.uid);
            }
            this.save();
            localStorage.setItem("studai_guest_mode", "false");
            this.updateAuthUI(userCredential.user);
            alert(`🎉 Bem-vindo(a) ao StudAI, ${name}! Sua conta foi criada com sucesso!`);
          } catch (err) {
            console.warn("Firebase Auth ou modo local:", err);
            // Salva os dados localmente no perfil caso esteja offline ou sem auth server
            this.save();
            localStorage.setItem("studai_guest_mode", "true");
            this.updateAuthUI(null);
            alert(`✅ Perfil de ${name} configurado com sucesso! Seus dados e meta diária de ${dailyHours}h já estão ativos.`);
          } finally {
            btnRegisterSubmit.disabled = false;
            btnRegisterSubmit.textContent = "🚀 Criar Conta & Começar";
            const loginOverlay = document.getElementById("login-overlay");
            if (loginOverlay) loginOverlay.style.display = "none";
            if (window.studai && window.studai.render) window.studai.render();
          }
        };
      }

      // Submissão de Login
      const btnLoginSubmit = document.getElementById("btn-login-submit");
      if (btnLoginSubmit) {
        btnLoginSubmit.onclick = async () => {
          const emailInput = document.getElementById("login-email");
          const passInput = document.getElementById("login-password");
          const email = emailInput ? emailInput.value.trim() : "";
          const password = passInput ? passInput.value : "";

          if (!email) {
            alert("Por favor, digite seu e-mail.");
            emailInput?.focus();
            return;
          }
          if (!password) {
            alert("Por favor, digite sua senha.");
            passInput?.focus();
            return;
          }

          btnLoginSubmit.disabled = true;
          btnLoginSubmit.textContent = "⏳ Entrando...";

          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            localStorage.setItem("studai_guest_mode", "false");
            this.currentUser = userCredential.user;
            this.updateAuthUI(userCredential.user);
            const loginOverlay = document.getElementById("login-overlay");
            if (loginOverlay) loginOverlay.style.display = "none";
            alert("👋 Login realizado com sucesso! Bem-vindo de volta.");
          } catch (err) {
            console.error("Erro no login:", err);
            let msg = "Erro ao fazer login. Verifique seu e-mail e senha.";
            if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
              msg = "Usuário não encontrado ou senha incorreta. Se você ainda não tem conta, cadastre-se na aba 'Criar Conta'!";
            } else if (err.code === "auth/wrong-password") {
              msg = "Senha incorreta. Verifique e tente novamente.";
            } else if (err.code === "auth/invalid-email") {
              msg = "Formato de e-mail inválido.";
            }
            alert(msg);
          } finally {
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.textContent = "Entrar no StudAI";
            if (window.studai && window.studai.render) window.studai.render();
          }
        };
      }

      // Botão Google
      const btnLoginOverlay = document.getElementById("btn-login-overlay");
      if (btnLoginOverlay) {
        btnLoginOverlay.onclick = () => {
          signInWithPopup(auth, provider).catch(err => {
            console.warn("Falha no popup Google, tentando continuar:", err);
            alert("Aviso: Login Google indisponível neste ambiente (" + err.message + "). Você pode cadastrar sua conta com e-mail e senha ou continuar como Convidado.");
          });
        };
      }

      // Continuar como Convidado
      const continueGuest = () => {
        try { localStorage.setItem("studai_guest_mode", "true"); } catch {}
        this.updateAuthUI(this.currentUser);
        const loginOverlay = document.getElementById("login-overlay");
        if (loginOverlay) loginOverlay.style.display = "none";
        if (window.studai && window.studai.render) window.studai.render();
      };

      const btnLoginGuest = document.getElementById("btn-login-guest");
      const btnCloseLogin = document.getElementById("btn-close-login");
      const btnLoginHeader = document.getElementById("btn-login-header");

      if (btnLoginGuest) btnLoginGuest.onclick = continueGuest;
      if (btnCloseLogin) btnCloseLogin.onclick = continueGuest;

      // Abrir tela de login a partir do cabeçalho
      if (btnLoginHeader) {
        btnLoginHeader.onclick = () => {
          const loginOverlay = document.getElementById("login-overlay");
          if (loginOverlay) loginOverlay.style.display = "flex";
        };
      }

      // Logout
      const btnLogout = document.getElementById("btn-logout");
      if (btnLogout) {
        btnLogout.onclick = () => {
          signOut(auth).then(() => {
            try { localStorage.removeItem("studai_guest_mode"); } catch {}
            this.updateAuthUI(null);
            if (window.studai && window.studai.render) window.studai.render();
          });
        };
      }

      // Clique no nome do usuário para ir até o perfil
      const userName = document.getElementById("user-name");
      if (userName) {
        userName.style.cursor = "pointer";
        userName.onclick = () => {
          if (window.studai && window.studai.switchTab) {
            window.studai.switchTab("perfil");
          }
        };
      }
    }, 100);
  }

  updateAuthUI(user) {
    const loginOverlay = document.getElementById("login-overlay");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");
    const btnLogout = document.getElementById("btn-logout");
    const btnLoginHeader = document.getElementById("btn-login-header");

    const isGuest = localStorage.getItem("studai_guest_mode") === "true";
    const profile = this.state.profile || {};
    const displayName = user?.displayName || profile.name || user?.email || (isGuest ? "Convidado" : "Estudante");

    if (user) {
      if (loginOverlay) loginOverlay.style.display = "none";
      if (userInfo) userInfo.style.display = "flex";
      if (userName) userName.textContent = `👤 ${displayName}`;
      if (btnLogout) btnLogout.style.display = "inline-block";
      if (btnLoginHeader) btnLoginHeader.style.display = "none";
    } else if (isGuest || profile.name) {
      if (loginOverlay) loginOverlay.style.display = "none";
      if (userInfo) userInfo.style.display = "flex";
      if (userName) userName.textContent = `👤 ${displayName}${!user ? " (Local)" : ""}`;
      if (btnLogout) btnLogout.style.display = "none";
      if (btnLoginHeader) btnLoginHeader.style.display = "inline-block";
    } else {
      if (loginOverlay) loginOverlay.style.display = "flex";
      if (userInfo) userInfo.style.display = "flex";
      if (userName) userName.textContent = "👤 Convidado";
      if (btnLogout) btnLogout.style.display = "none";
      if (btnLoginHeader) btnLoginHeader.style.display = "inline-block";
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