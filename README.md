<div align="center">

# 🧠 StudAI — Cyber Study OS

**Um dashboard de estudos minimalista, elegante e de alta performance impulsionado por gamificação e insights científicos.**

![Licença](https://img.shields.io/badge/license-MIT-2dff7a?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript)
![HTML5](https://img.shields.io/badge/HTML5-Canvas-orange?style=for-the-badge&logo=html5)
![CSS3](https://img.shields.io/badge/CSS3-Minimalist_Dark-blue?style=for-the-badge&logo=css3)

[Demonstração](#-funcionalidades) • [Instalação](#-como-executar) • [Estrutura](#-estrutura-do-projeto) • [Contribuição](#-licença)

</div>

---

## ⚡ Sobre o Projeto

O **StudAI** é uma plataforma web para gestão de estudos projetada com uma interface *Dark/Sci-Fi* de alta densidade e foco absoluto no minimalismo. Ele foi concebido para eliminação do ruído visual e maximização do estado de **Deep Work** (hiperfoco), combinando controle de tempo, organização de tarefas, acompanhamento de métricas analíticas e retenção ativa.

---

## 🚀 Funcionalidades Principais

### 📊 Dashboard & Análise Ativa
* **StudAI Insights:** Motor dinâmico que gera orientações neurocientíficas e comportamentais diárias com base no volume de estudo da semana.
* **Radar de Domínio (Web Chart):** Gráfico poligonal cibernético em SVG que exibe visualmente o equilíbrio de dedicação entre as matérias no mês.
* **Evolução nos Testes:** Gráfico de área suavizado com degradê neon para acompanhamento percentual de retenção nos simulados/quizzes.
* **Métricas Diárias e Sequência (Streak):** Monitoramento de horas diárias, tópicos concluídos e dias seguidos de estudo com bônus de consistência.

### 🎯 Metas & Kanban Unificado
* **Kanban de Tarefas:** Organização em colunas (*A Fazer*, *Fazendo*, *Concluído*) com agrupamento inteligente por matéria (sanfonas) e limpeza automática de tarefas antigas.
* **Criação Rápida de Tarefas:** Formulário integrado em linha (grid) com seleção rápida de disciplina e ganho de **+5 XP** por tarefa concluída.
* **Metas Semanais:** Acompanhamento dinâmico de horas alvo por disciplina com recalculo automático toda segunda-feira.

### 🎨 Lousa Interativa no Fundo (Background Canvas)
* **Desenho Interativo (Modo Lousa):** Camada de `<canvas>` transparente integrada ao fundo que permite rabiscar esquemas, contas ou ideias rapidamente durante os estudos.
* **Visual Neon Minimalista:** Traço suave e ajustado por trás dos elementos da interface, sem interferir no uso normal dos cartões ou timers.

### 🎮 Gamificação & Retenção
* **Missões Diárias:** Objetivos diários dinâmicos com resgate de XP e animações interativas na tela.
* **Gamificação Geral:** Sistema de níveis, streaks e efeitos sonoros focados na construção do hábito de estudo.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5:** Estruturação semântica e suporte a `<canvas>` interativo.
* **CSS3:** Estilização responsiva em Dark Theme, variáveis CSS de alto contraste e componentes fluidos.
* **JavaScript (ES6+ Modules):** Arquitetura modular focada em velocidade, reatividade simples e manipulação de SVG em tempo real.
* **LocalStorage:** Persistência local instantânea de sessões, tarefas e configurações, sem necessidade de dependências pesadas de backend.

---

## 📂 Estrutura do Projeto

```bash
studai/
├── css/
│   └── style.css          # Estilos globais, temas e animações
├── js/
│   ├── app.js             # Ponto de entrada do sistema
│   ├── store.js           # Gerenciador de estado local
│   ├── utils.js           # Funções auxiliares (formatação de tempo, datas)
│   ├── gamification.js    # Lógica de XP, Streaks e Missões
│   ├── audio.js           # Efeitos sonoros do sistema
│   ├── drawBg.js          # Lógica da Lousa/Canvas interativa do fundo
│   └── views/
│       ├── dashboardView.js # Painel principal (Radar, Evolução, Insights)
│       └── goalsView.js     # Kanban de Tarefas e Metas Semanais
└── index.html             # Estrutura principal da aplicação
