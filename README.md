<div align="center">

# 🧠 StudAI — Cybernetic Study OS

**Um ecossistema web minimalista e de alta performance para gestão de estudos, foco profundo e retenção ativa, desenhado sob a estética Sci-Fi / Cyberpunk.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Dark_Minimalist-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Licença](https://img.shields.io/badge/License-MIT-2dff7a?style=for-the-badge)

[Funcionalidades](#-módulos-e-funcionalidades) • [Arquitetura](#-estrutura-do-repositório) • [Como Rodar](#-como-executar-o-projeto) • [Licença](#-licença)

</div>

---

## ⚡ Visão Geral

O **StudAI** foi desenvolvido para resolver o problema da dispersão mental e do ruído visual durante os estudos. Operando em tema escuro de alto contraste com paleta neon (`var(--g)` verde cibernético, bordas translúcidas e iluminação de fundo reativa), o sistema unifica rastreamento de tempo, gestão de tarefas e memorização em uma única interface ultrarrápida que dispensa dependências externas pesadas.

---

## 🚀 Módulos e Funcionalidades

### 📊 1. Painel Analítico & Dashboard (`dashboardView.js`)
* **Radar de Domínio (Gráfico de Teia):** Representação poligonal em SVG matemático que mapeia a distribuição de tempo entre as matérias no mês corrente, facilitando a identificação de lacunas no cronograma.
* **Evolução nos Testes:** Gráfico de área suavizado em degradê neon acompanhando o índice percentual de acertos nos quizzes com suporte a dados de simulação.
* **StudAI Insights:** Motor de neurociência comportamental que analisa o volume semanal em horas e entrega orientações personalizadas sobre plasticidade cerebral, recuperação e intervalos.
* **Métricas Diárias & Streak:** Contador de sessões, minutos acumulados no dia e chamas de sequência (*streak*) para constância diária.
* **Últimos 7 Dias:** Barras empilhadas com códigos de cor por disciplina.

### 🎯 2. Metas & Kanban Unificado (`goalsView.js`)
* **Formulário de Entrada em Linha:** Inputs de título e seletor estilizado de matéria alinhados diretamente ao botão de ação em grid responsivo.
* **Colunas de Fluxo:** Organização clássica (*A Fazer*, *Fazendo*, *Concluído*) com agrupamento expansível (*accordion/sanfona*) separado por matéria.
* **Auto-limpeza Inteligente:** Tarefas finalizadas há mais de 3 dias são automaticamente filtradas para manter o quadro limpo.
* **Metas Semanais:** Acompanhamento de horas estipuladas vs. horas estudadas com recálculo automático toda segunda-feira.

### ⏱️ 3. Timer & Sessões de Foco (`timer.js` / `timerView.js`)
* Cronômetro de estudo e suporte a blocos de foco contínuo.
* Registro automático de minutos dedicados atribuídos a disciplinas específicas.

### 📝 4. Testes, Quizzes & Calendário (`quizView.js` / `calendarView.js`)
* Banco de perguntas e resolução de simulados para fixação ativa de conteúdo.
* Visão de calendário com histórico visual das sessões distribuídas ao longo dos dias.

### 🎨 5. Lousa Interativa em Segundo Plano
* Camada de `<canvas>` transparente integrada ao fundo (`z-index: -1`).
* Permite rabiscos rápidos de fórmulas, contas e anotações diretamente na tela com traço suave sem obstruir cartões e botões.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5:** Semântica estrita e manipulação de `<canvas>` 2D.
* **CSS3 Moderno:** Flexbox, CSS Grid, filtros de desfoque (*backdrop-filter*) e variáveis nativas para temas e coordenadas do cursor.
* **JavaScript Puro (ES6 Modules):** Arquitetura desacoplada em módulos (`import` / `export`), sem frameworks pesados, garantindo carregamento instantâneo.
* **LocalStorage API:** Persistência de sessões, quizzes, metas e inventário de XP diretamente no navegador.

---

## 📂 Estrutura do Repositório

```text
StudAI/
├── .vscode/
│   └── settings.json          # Configuração de porta do Live Server
├── css/
│   └── style.css              # Variáveis globais (--g, --mu, --tx), componentes e temas
├── js/
│   ├── app.js                 # Ponto de entrada e orquestração de rotas
│   ├── store.js               # Gerenciador de estado centralizado (LocalStorage)
│   ├── timer.js               # Mecânica interna do temporizador
│   ├── gamification.js        # Regras de XP, cálculo de streak e missões diárias
│   ├── audio.js               # Efeitos sonoros de recompensas e cliques
│   ├── ai.js                  # Integrações e lógica do assistente
│   ├── utils.js               # Utilitários de data, duração e sanitização
│   └── views/
│       ├── calendarView.js    # Interface do calendário mensal
│       ├── dashboardView.js   # Painel com Radar de Domínio e Insights
│       ├── goalsView.js       # Kanban unificado e metas da semana
│       ├── profileData.js     # Estrutura de dados de perfil e estatísticas
│       ├── quizView.js        # Execução de quizzes e simulados
│       ├── subjectsView.js    # Gerenciamento de disciplinas e cores
│       └── timerView.js       # Interface do temporizador de estudos
├── index.html                 # Ponto de montagem da aplicação
└── README.md                  # Documentação do projeto
