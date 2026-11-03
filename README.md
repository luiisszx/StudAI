<div align="center">

# 🧠 StudAI OS v2.5 — Plataforma de Alta Performance para Estudos

**Um ecossistema web moderno, minimalista e de alta performance para gestão de estudos, foco profundo e retenção ativa, desenhado sob a estética Cyber-Study Glassmorphism.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES6_Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-Modern_Bento_Grid-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Web Audio](https://img.shields.io/badge/Web_Audio_API-Synthesized-00c853?style=for-the-badge)
![Offline First](https://img.shields.io/badge/Storage-Offline_First-2dff7a?style=for-the-badge)
![Licença](https://img.shields.io/badge/License-MIT-2dff7a?style=for-the-badge)

[Funcionalidades](#-módulos-e-funcionalidades) • [Atalhos de Produtividade](#-atalhos-de-teclado) • [Arquitetura](#-estrutura-do-repositório) • [Como Rodar](#-como-executar-o-projeto) • [Licença](#-licença)

</div>

---

## ⚡ Visão Geral

O **StudAI OS** foi reconstruído para eliminar distrações e ruídos visuais durante as sessões de estudo. Operando em tema escuro com design tokens modernos, tipografia ergonômica (Inter / JetBrains Mono), cartões no formato Bento Grid com efeito de vidro fosco (*backdrop-filter*) e iluminação sutil reativa, o sistema unifica rastreamento de tempo, gestão de tarefas e memorização em uma única interface ultrarrápida que dispensa frameworks pesados.

---

## 🚀 Módulos e Funcionalidades

### 🧘 1. Modo Foco Total (Zen Mode) & Sons Sintetizados
* **Modo Zen (`Z` ou botão na barra):** Oculta toda a navegação, cabeçalho e métricas periféricas com um toque, mantendo apenas o cronômetro central e o bloco de anotações em tela cheia com fundo ultra-escuro para concentração máxima.
* **Soundscapes com Síntese Web Audio (100% Offline):** Gerador procedural de som ambiente sem dependência de streaming ou arquivos pesados de MP3:
  * 🌧️ **Chuva Suave:** Ruído rosa filtrado passa-baixa em tempo real.
  * 🌊 **Ruído Branco:** Filtragem espectral contínua para isolamento acústico.
  * 🧠 **Ondas Gama 40Hz (Batimentos Binaurais):** Estimulação de foco cognitivo através de osciladores estéreo independentes.
  * Controle de volume e ativação rápida tanto pelo Timer quanto pelo cabeçalho superior.

### ⏱️ 2. Timer de Alta Performance & Rascunho Rápido (`timerView.js`)
* **Cronômetro e Modos Pomodoro/Foco:** Suporte a contagem progressiva e regressiva com registro automático de horas por disciplina.
* **Bloco de Rascunho Rápido (*Focus Scratchpad*):** Área de notas acoplada ao cronômetro com salvamento automático a cada digitação (`auto-save`).
* **Criação Instantânea de Flashcards:** Registre dúvidas e conceitos-chave no calor do estudo com um clique sem precisar trocar de aba.
* **Mini Dock Flutuante:** Quando você navega para o Kanban ou Dashboard enquanto o timer está rodando, uma barra minimalista inferior permite pausar ou acompanhar o tempo sem interrupções.

### 📊 3. Painel Analítico & Dashboard Inteligente (`dashboardView.js`)
* **Gráficos Adaptativos em SVG:**
  * **Gráfico Donut / Radial Dinâmico:** Exibição elegante e precisa para 1 ou 2 matérias cadastradas.
  * **Radar de Domínio (Gráfico de Teia Poligonal):** Distribuição equilibrada para 3 ou mais matérias.
* **Evolução em Testes Sem Falsos Dados:** Análise clara da sua retenção baseada exclusivamente nos simulados reais realizados pelo usuário, sem overlays borrados ou placeholders enganosos.
* **StudAI Insights Cognitivos:** Diagnósticos automatizados sobre ritmo de recuperação, distribuição semanal de carga horária e consistência.
* **Streak & Missões Diárias:** Recompensas de XP dinâmicas com feedback visual de conquista.

### 🎯 4. Kanban de Tarefas & Metas Semanais (`goalsView.js`)
* **Kanban com Categorização por Disciplina:** Colunas (*A Fazer*, *Fazendo*, *Concluído*) com agrupamento sanfona e badges temáticos coloridos.
* **Auto-limpeza Inteligente:** Tarefas finalizadas há mais de 3 dias são automaticamente arquivadas para evitar poluição visual.
* **Progresso Semanal:** Horas estudadas versus meta estabelecida com redefinição programada a cada semana.

### 📝 5. Quizzes & Flashcards com Geração Híbrida (`quizView.js`)
* **Geração Offline Instantânea:** Motor de perguntas integrado com banco rico em Biologia, Exatas, História, Idiomas e Programação, gerando simulados na hora sem necessidade de configuração de chaves.
* **Integração Opcional com Google Gemini:** Suporte a chave de API para geração de testes hiper-personalizados sob demanda.
* **Flashcards com Rotação 3D:** Modo de estudo com baralho interativo, resposta oculta e auto-avaliação de memorização.

### 📅 6. Calendário & Histórico de Sessões (`calendarView.js`)
* Mapa de calor e distribuição cronológica das sessões de estudo ao longo do mês.
* Indicadores de tempo total por dia e histórico detalhado.

### 🛡️ 7. Experiência Frictionless & Privacidade
* **Zero Bloqueios de Entrada:** Acesso direto às ferramentas imediatamente ao abrir a página, sem formulários obrigatórios na tela inicial.
* **Autenticação Opcional & Backup JSON:** Possibilidade de sincronização em nuvem via Firebase ou exportação e restauração manual de dados via arquivo JSON a qualquer instante.
* **Toasts Não-bloqueantes:** Substituição de diálogos nativos `alert()` por notificações toast fluidas e não-intrusivas.

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
| :--- | :--- |
| `Espaço` | Iniciar / Pausar o Cronômetro de Estudo (fora de campos de texto) |
| `Z` | Alternar Modo Foco Total (*Zen Mode*) |
| `Esc` | Sair do Modo Foco Total / Fechar modais |
| `Alt + 1` | Abrir Dashboard |
| `Alt + 2` | Abrir Timer de Estudos |
| `Alt + 3` | Abrir Kanban & Metas |
| `Alt + 4` | Abrir Matérias |
| `Alt + 5` | Abrir Quizzes & Flashcards |
| `Alt + 6` | Abrir Calendário |
| `Alt + 7` | Abrir Perfil & Backup |

---

## 🛠️ Tecnologias Utilizadas

* **HTML5 Semântico:** Estrutura limpa, acessível e otimizada.
* **CSS3 Moderno:** Flexbox, CSS Bento Grid, custom properties (`--bg`, `--g`, `--border`, etc.), efeitos de vidro fosco (`backdrop-filter`) e animações em GPU.
* **JavaScript ES6+ Vanilla (Módulos Nativos):** Arquitetura 100% desacoplada via `import` / `export`, garantindo inicialização abaixo de 50ms sem dependência de bundlers pesados.
* **Web Audio API:** Síntese procedural em tempo real de ruído rosa, ruído branco e frequências binaurais gama de 40Hz.
* **SVG Matemático:** Gráficos de radar poligonal e donut renderizados puramente via código vetorial.
* **LocalStorage API:** Persistência transparente e imediata de todo o estado do usuário.

---

## 📂 Estrutura do Repositório

```text
studai/
├── css/
│   └── style.css              # Design system moderno, layout bento grid e variáveis
├── js/
│   ├── app.js                 # Ponto de entrada, roteamento de abas e atalhos
│   ├── store.js               # Gestão reativa de estado, persistência e toasts
│   ├── timer.js               # Motor cronômetro / Pomodoro e controle de sessões
│   ├── gamification.js        # Cálculo de XP, rankings e missões diárias
│   ├── audio.js               # Sintetizador procedural de áudio para foco e SFX
│   ├── ai.js                  # Motor de testes (offline e integração Gemini)
│   ├── utils.js               # Formatadores de data, duração e segurança
│   └── views/
│       ├── dashboardView.js   # Gráficos SVG (Donut/Radar), métricas e insights
│       ├── timerView.js       # Timer, Soundscapes, Scratchpad e Quick Flashcard
│       ├── goalsView.js       # Kanban categorizado e metas semanais
│       ├── subjectsView.js    # Gestão de disciplinas, cores e horas
│       ├── quizView.js        # Simulados offline/IA e Flashcards 3D
│       ├── calendarView.js    # Visualização mensal de consistência
│       └── profileData.js     # Estatísticas de perfil, ranking e backup JSON
├── index.html                 # Ponto de montagem da interface (sem inline styles)
└── README.md                  # Documentação do projeto
```

---

## 💻 Como Executar o Projeto

Como o projeto utiliza **módulos ES6 nativos** (`type="module"`), basta abri-lo através de qualquer servidor local simples:

### Opção 1: Extensão Live Server (VS Code)
1. Abra a pasta do projeto no VS Code.
2. Clique com o botão direito em `index.html` e selecione **"Open with Live Server"**.

### Opção 2: Python (Nenhum pacote extra necessário)
```bash
python -m http.server 3000
```
Abra o navegador em `http://localhost:3000`.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
