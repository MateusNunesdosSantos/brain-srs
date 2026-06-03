import { AppState, Question } from "@/lib/types";

const today = new Date();
const isoDay = (offset: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
};

const answer = (
  id: string,
  label: string,
  text: string,
  rationale: string,
  isCorrect = false,
) => ({ id, label, text, rationale, isCorrect });

const question = (
  id: string,
  subjectId: string,
  prompt: string,
  hint: string,
  alternatives: ReturnType<typeof answer>[],
): Question => ({ id, subjectId, prompt, hint, alternatives });

export const seedState: AppState = {
  settings: {
    cooldownMinMinutes: 10,
    cooldownMaxMinutes: 15,
    firstReviewDays: 1.4,
    reviewMultiplier: 2.05,
  },
  notebooks: [
    {
      id: "nb-humanas",
      name: "Ciências Humanas",
      description: "Filosofia, história e pensamento crítico.",
      color: "#1cb0f6",
    },
    {
      id: "nb-negocios",
      name: "Negócios & Marketing",
      description: "Estratégia, aquisição e posicionamento.",
      color: "#ffc800",
    },
    {
      id: "nb-tecnologia",
      name: "Tecnologia",
      description: "Fundamentos técnicos e desenvolvimento.",
      color: "#58cc02",
    },
  ],
  subjects: [
    {
      id: "sub-filosofia",
      notebookId: "nb-humanas",
      name: "Filosofia da Natureza",
      description: "Pré-socráticos, causalidade e cosmologia.",
      color: "#1cb0f6",
    },
    {
      id: "sub-historia",
      notebookId: "nb-humanas",
      name: "História Moderna",
      description: "Revoluções e formação do mundo moderno.",
      color: "#84d8ff",
    },
    {
      id: "sub-trafego",
      notebookId: "nb-negocios",
      name: "Tráfego Pago",
      description: "Métricas, campanhas e otimização.",
      color: "#ffc800",
    },
    {
      id: "sub-branding",
      notebookId: "nb-negocios",
      name: "Branding",
      description: "Marca, percepção e diferenciação.",
      color: "#ff9600",
    },
    {
      id: "sub-js",
      notebookId: "nb-tecnologia",
      name: "JavaScript",
      description: "Linguagem, runtime e assincronismo.",
      color: "#58cc02",
    },
  ],
  questions: [
    question(
      "q-arché",
      "sub-filosofia",
      "Para Tales de Mileto, qual elemento constituía a arché de todas as coisas?",
      "Pense no elemento que Tales observava como indispensável à vida e capaz de assumir diferentes formas.",
      [
        answer("q1-a", "A", "Fogo", "O fogo é a arché proposta por Heráclito."),
        answer("q1-b", "B", "Água", "Tales defendia a água como princípio originário de tudo.", true),
        answer("q1-c", "C", "Ápeiron", "O ápeiron é a proposta de Anaximandro."),
        answer("q1-d", "D", "Ar", "O ar é a arché defendida por Anaxímenes."),
      ],
    ),
    question(
      "q-heraclito",
      "sub-filosofia",
      "Qual ideia é central no pensamento de Heráclito?",
      "A imagem do rio costuma ser usada para explicar sua tese.",
      [
        answer("q2-a", "A", "A imobilidade do ser", "Essa tese está associada a Parmênides."),
        answer("q2-b", "B", "A harmonia como ausência de conflito", "Para Heráclito, a tensão dos opostos é produtiva."),
        answer("q2-c", "C", "O devir e a mudança constante", "Heráclito compreende a realidade como fluxo e transformação.", true),
        answer("q2-d", "D", "A negação dos sentidos", "Essa formulação não resume o núcleo de seu pensamento."),
      ],
    ),
    question(
      "q-quatro-causas",
      "sub-filosofia",
      "Em Aristóteles, qual causa responde à pergunta 'para quê algo existe'?",
      "Ela trata da finalidade.",
      [
        answer("q3-a", "A", "Causa material", "A causa material indica do que algo é feito."),
        answer("q3-b", "B", "Causa eficiente", "A causa eficiente indica o agente da mudança."),
        answer("q3-c", "C", "Causa formal", "A causa formal trata da forma ou essência."),
        answer("q3-d", "D", "Causa final", "A causa final descreve o propósito ou fim.", true),
      ],
    ),
    question(
      "q-revolucao",
      "sub-historia",
      "Qual evento simboliza o início da Revolução Francesa em 1789?",
      "Considere um episódio ocorrido em Paris em 14 de julho.",
      [
        answer("q4-a", "A", "A queda da Bastilha", "A tomada da Bastilha tornou-se o marco simbólico da revolução.", true),
        answer("q4-b", "B", "O Congresso de Viena", "O Congresso de Viena aconteceu após a queda de Napoleão."),
        answer("q4-c", "C", "A Batalha de Waterloo", "Waterloo ocorreu em 1815."),
        answer("q4-d", "D", "O Golpe do 18 Brumário", "O golpe ocorreu em 1799."),
      ],
    ),
    question(
      "q-ctr",
      "sub-trafego",
      "Qual fórmula representa corretamente o CTR de um anúncio?",
      "Relacione cliques à quantidade de vezes que o anúncio apareceu.",
      [
        answer("q5-a", "A", "Cliques ÷ impressões × 100", "CTR mede a proporção de impressões que geraram cliques.", true),
        answer("q5-b", "B", "Conversões ÷ cliques × 100", "Essa relação representa a taxa de conversão pós-clique."),
        answer("q5-c", "C", "Investimento ÷ cliques", "Essa relação representa o custo por clique."),
        answer("q5-d", "D", "Receita ÷ investimento", "Essa relação representa ROAS."),
      ],
    ),
    question(
      "q-roas",
      "sub-trafego",
      "Uma campanha investiu R$ 1.000 e gerou R$ 4.500 em receita. Qual foi o ROAS?",
      "Divida receita pelo investimento.",
      [
        answer("q6-a", "A", "0,22", "Esse valor inverte a relação entre investimento e receita."),
        answer("q6-b", "B", "3,5", "Esse resultado descontaria o investimento antes do cálculo."),
        answer("q6-c", "C", "4,5", "ROAS é receita dividida pelo investimento: 4.500 ÷ 1.000.", true),
        answer("q6-d", "D", "45", "O ROAS não deve ser multiplicado por dez."),
      ],
    ),
    question(
      "q-cac",
      "sub-trafego",
      "Qual indicador revela o custo médio para adquirir um novo cliente?",
      "A sigla termina com a palavra aquisição.",
      [
        answer("q7-a", "A", "CAC", "CAC significa Custo de Aquisição de Cliente.", true),
        answer("q7-b", "B", "LTV", "LTV estima o valor gerado pelo cliente ao longo do relacionamento."),
        answer("q7-c", "C", "CPM", "CPM mede o custo por mil impressões."),
        answer("q7-d", "D", "CTR", "CTR mede a taxa de cliques."),
      ],
    ),
    question(
      "q-brand",
      "sub-branding",
      "O que diferencia identidade de marca de imagem de marca?",
      "Uma é construída pela empresa; a outra é formada na mente do público.",
      [
        answer("q8-a", "A", "Não existe diferença prática", "Os conceitos se relacionam, mas não são equivalentes."),
        answer("q8-b", "B", "Identidade é a intenção; imagem é a percepção", "A identidade é projetada pela marca e a imagem resulta da percepção pública.", true),
        answer("q8-c", "C", "Imagem é apenas o logotipo", "A imagem envolve o conjunto de associações percebidas."),
        answer("q8-d", "D", "Identidade é definida apenas pela audiência", "A audiência participa da imagem, não da intenção identitária."),
      ],
    ),
    question(
      "q-event-loop",
      "sub-js",
      "Qual é o papel do event loop no JavaScript?",
      "Pense em como tarefas assíncronas entram na pilha de execução.",
      [
        answer("q9-a", "A", "Compilar CSS em tempo real", "O event loop não processa folhas de estilo."),
        answer("q9-b", "B", "Gerenciar a execução de callbacks quando a call stack está livre", "Ele coordena a entrada de tarefas assíncronas na pilha.", true),
        answer("q9-c", "C", "Executar sempre múltiplas threads JavaScript", "O modelo comum de execução é single-threaded."),
        answer("q9-d", "D", "Substituir a memória heap", "Heap e event loop cumprem funções distintas."),
      ],
    ),
    question(
      "q-promise",
      "sub-js",
      "Qual estado não pertence ao ciclo de vida padrão de uma Promise?",
      "Promises aguardam e depois são resolvidas ou rejeitadas.",
      [
        answer("q10-a", "A", "Pending", "Pending é o estado inicial de uma Promise."),
        answer("q10-b", "B", "Fulfilled", "Fulfilled indica resolução com sucesso."),
        answer("q10-c", "C", "Rejected", "Rejected indica falha."),
        answer("q10-d", "D", "Paused", "Paused não é um estado padrão de Promise.", true),
      ],
    ),
    question(
      "q-closure",
      "sub-js",
      "O que é uma closure em JavaScript?",
      "Considere o acesso a variáveis mesmo após a execução da função externa.",
      [
        answer("q11-a", "A", "Uma função com acesso ao escopo léxico onde foi criada", "A função preserva acesso ao ambiente léxico de origem.", true),
        answer("q11-b", "B", "Um objeto que impede qualquer mutação", "Imutabilidade não define closure."),
        answer("q11-c", "C", "Um método exclusivo de classes", "Closures não dependem de classes."),
        answer("q11-d", "D", "Um erro gerado por loop infinito", "Loops infinitos não definem closure."),
      ],
    ),
    question(
      "q-positioning",
      "sub-branding",
      "Qual é o objetivo central do posicionamento de marca?",
      "Pense no espaço competitivo ocupado na mente das pessoas.",
      [
        answer("q12-a", "A", "Ocupar um lugar distintivo na mente do público", "Posicionamento busca uma percepção relevante e diferenciada.", true),
        answer("q12-b", "B", "Publicar diariamente em todas as redes", "Frequência de publicação é uma tática, não o objetivo central."),
        answer("q12-c", "C", "Reduzir sempre o preço", "Preço pode participar da estratégia, mas não resume posicionamento."),
        answer("q12-d", "D", "Usar apenas mídia offline", "Canais são decisões de execução."),
      ],
    ),
  ],
  progress: {},
  logs: [],
  cooldown: [],
  completedDates: [isoDay(-1).slice(0, 10), isoDay(-2).slice(0, 10), isoDay(-3).slice(0, 10)],
  activeReviewSession: null,
};

seedState.questions.forEach((item, index) => {
  const offsets = [-1, -2, 0, 2, -1, 0, 4, -3, 0, 1, -1, 3];
  seedState.progress[item.id] = {
    questionId: item.id,
    difficulty: 4 + (index % 4) * 0.6,
    stability: index < 3 ? 2.5 : 7 + index,
    state: index < 2 ? "learning" : "review",
    nextReview: isoDay(offsets[index]),
    reviews: 2 + (index % 6),
    mistakes: ["q-roas", "q-event-loop", "q-heraclito"].includes(item.id)
      ? 3 + (index % 2)
      : index % 3,
  };
});

const seededMistakes = [
  ["q-roas", "q6-a"],
  ["q-roas", "q6-b"],
  ["q-roas", "q6-a"],
  ["q-event-loop", "q9-c"],
  ["q-event-loop", "q9-d"],
  ["q-event-loop", "q9-c"],
  ["q-heraclito", "q2-a"],
  ["q-heraclito", "q2-b"],
  ["q-heraclito", "q2-a"],
];

seededMistakes.forEach(([questionId, alternativeId], index) => {
  const questionItem = seedState.questions.find((item) => item.id === questionId);
  if (!questionItem) return;
  seedState.logs.push({
    id: `seed-log-${index}`,
    questionId,
    subjectId: questionItem.subjectId,
    answeredAt: isoDay(-(index + 1)),
    correct: false,
    selectedAlternativeId: alternativeId,
    responseTimeSeconds: 18 + index * 3,
  });
});

seedState.questions.slice(0, 8).forEach((item, index) => {
  const correct = item.alternatives.find((alternative) => alternative.isCorrect);
  if (!correct) return;
  seedState.logs.push({
    id: `seed-correct-${index}`,
    questionId: item.id,
    subjectId: item.subjectId,
    answeredAt: isoDay(-(index + 2)),
    correct: true,
    selectedAlternativeId: correct.id,
    responseTimeSeconds: 12 + index * 2,
  });
});

