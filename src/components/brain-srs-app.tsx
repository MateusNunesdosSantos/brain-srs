"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  FileText,
  Flame,
  FolderOpen,
  GraduationCap,
  Home,
  Import as ImportIcon,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { seedState } from "@/lib/seed";
import {
  Alternative,
  AppState,
  AuthUser,
  Notebook,
  PageId,
  Progress,
  Question,
  ReviewLog,
  SrsSettings,
  Subject,
} from "@/lib/types";
import { AppAction, ContentImport } from "@/lib/actions";
import {
  AuthPayload,
  completeOnboardingRequest,
  fetchState,
  logoutRequest,
  mergeAppState,
  postAction,
  postAuth,
} from "@/lib/client-api";
import { contentImportSchema } from "@/lib/validation";

const cloneSeed = (): AppState => JSON.parse(JSON.stringify(seedState)) as AppState;
const answerLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
type DeleteTarget =
  | { type: "notebook"; id: string; name: string; subjectCount: number; questionCount: number }
  | { type: "subject"; id: string; name: string; questionCount: number }
  | { type: "question"; id: string; name: string };
const pagePaths: Record<PageId, string> = {
  dashboard: "/",
  review: "/revisar",
  library: "/biblioteca",
  stats: "/estatisticas",
  vulnerabilities: "/vulnerabilidades",
  simulation: "/simulado",
  settings: "/configuracoes",
};
const pathPages = Object.entries(pagePaths).reduce<Record<string, PageId>>(
  (pages, [page, path]) => {
    pages[path] = page as PageId;
    return pages;
  },
  {},
);
const getPageFromPathname = (pathname: string) => pathPages[pathname] ?? "dashboard";
const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
const seededRandom = (seed: number) => {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffleAlternatives = (alternatives: Alternative[], seedKey: string) => {
  const random = seededRandom(hashSeed(seedKey));
  const shuffled = alternatives.map((alternative) => ({ ...alternative }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};
const localDay = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(value);

const relativeReview = (value: string) => {
  const delta = Math.ceil(
    (new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (delta <= 0) return "Revisar hoje";
  if (delta === 1) return "Amanhã";
  return `Em ${delta} dias`;
};

const formatCountdown = (availableAt: string | null, now: number) => {
  if (!availableAt) return null;
  const totalSeconds = Math.max(
    0,
    Math.ceil((new Date(availableAt).getTime() - now) / 1000),
  );
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return days
    ? `${days}d ${paddedHours}:${paddedMinutes}:${paddedSeconds}`
    : hours
      ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
};

const calculateStreak = (dates: string[]) => {
  const completed = new Set(dates);
  const cursor = new Date();
  if (!completed.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let total = 0;
  while (completed.has(localDay(cursor))) {
    total += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return total;
};

const calculateLongestStreak = (dates: string[]) => {
  const completed = new Set(dates);
  if (!completed.size) return 0;
  const orderedDates = [...completed].sort();
  let longest = 0;
  let current = 0;
  let previous: Date | null = null;
  orderedDates.forEach((date) => {
    const cursor = new Date(`${date}T12:00:00`);
    const consecutive =
      previous &&
      Math.round((cursor.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000)) === 1;
    current = consecutive ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = cursor;
  });
  return longest;
};

const formatDays = (days: number) => `${days} ${days === 1 ? "dia" : "dias"}`;

const getActivityDates = (logs: ReviewLog[]) => [
  ...new Set(logs.map((log) => localDay(new Date(log.answeredAt)))),
];

const getRecentDailyActivity = (logs: ReviewLog[], numberOfDays: number) => {
  const activityByDay = logs.reduce<Record<string, number>>((activity, log) => {
    const day = localDay(new Date(log.answeredAt));
    activity[day] = (activity[day] ?? 0) + 1;
    return activity;
  }, {});
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (numberOfDays - index - 1));
    const dateKey = localDay(date);
    return { date, dateKey, count: activityByDay[dateKey] ?? 0 };
  });
};

const getRetentionTrend = (logs: ReviewLog[]) => {
  const recent = logs.slice(-5);
  const previous = logs.slice(-10, -5);
  if (!recent.length) return "Nenhuma resposta registrada";
  if (!previous.length) {
    return `Baseado em ${recent.length} ${recent.length === 1 ? "resposta" : "respostas"} recentes`;
  }
  const rate = (items: ReviewLog[]) =>
    Math.round((items.filter((log) => log.correct).length / items.length) * 100);
  const difference = rate(recent) - rate(previous);
  if (!difference) return "Estável nas últimas respostas";
  return `${difference > 0 ? "+" : ""}${difference}% nas últimas respostas`;
};

const getRetentionInsight = (logs: ReviewLog[]) => {
  if (!logs.length) {
    return {
      title: "Responda questões para descobrir seu melhor horário.",
      detail: "O painel usará seu histórico de revisões para calcular este insight.",
    };
  }
  const hourly = logs.reduce<Record<number, { total: number; correct: number }>>(
    (groups, log) => {
      const hour = new Date(log.answeredAt).getHours();
      groups[hour] ??= { total: 0, correct: 0 };
      groups[hour].total += 1;
      if (log.correct) groups[hour].correct += 1;
      return groups;
    },
    {},
  );
  const [hour, result] = Object.entries(hourly).sort(([, left], [, right]) => {
    const retentionDifference = right.correct / right.total - left.correct / left.total;
    return retentionDifference || right.total - left.total;
  })[0];
  const startHour = Number(hour);
  const retention = Math.round((result.correct / result.total) * 100);
  return {
    title: `Seu melhor horário registrado é entre ${startHour}h e ${(startHour + 1) % 24}h.`,
    detail: `${retention}% de acerto em ${result.total} ${
      result.total === 1 ? "resposta" : "respostas"
    } nesse período.`,
  };
};

const isActiveCooldown = (state: AppState, questionId: string, now: number) =>
  state.cooldown.some(
    (item) =>
      item.questionId === questionId &&
      new Date(item.availableAt).getTime() > now,
  );

const getDueQuestions = (state: AppState, now: number) =>
  state.questions.filter((question) => {
    const progress = state.progress[question.id];
    return (
      progress &&
      new Date(progress.nextReview).getTime() <= now &&
      !isActiveCooldown(state, question.id, now)
    );
  });

const getSubjectRetention = (state: AppState, subjectId: string) => {
  const logs = state.logs.filter((log) => log.subjectId === subjectId);
  if (!logs.length) return 0;
  return Math.round((logs.filter((log) => log.correct).length / logs.length) * 100);
};

type Toast = { id: number; message: string };
export function BrainSrsApp() {
  const router = useRouter();
  const pathname = usePathname();
  const page = getPageFromPathname(pathname);
  const [state, setState] = useState<AppState>(cloneSeed);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [simulationSource, setSimulationSource] = useState("sub-trafego");
  const [simulationFocusMode, setSimulationFocusMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchState(controller.signal)
      .then((payload) => {
        if (!payload) return;
        setState(payload.state);
        setUser(payload.user);
        if (payload.state.activeReviewSession) {
          const answered = new Set(payload.state.activeReviewSession.answeredQuestionIds);
          setReviewQueue(
            payload.state.activeReviewSession.questionIds.filter(
              (questionId) => !answered.has(questionId),
            ),
          );
          setReviewSessionId(payload.state.activeReviewSession.id);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error(error);
        }
      })
      .finally(() => setHydrated(true));
    return () => controller.abort();
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem("brainsrs-sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    const updateTime = () => setNow(new Date().getTime());
    const timer = window.setTimeout(updateTime, 0);
    const interval = window.setInterval(updateTime, 1_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setSidebarCollapsed(
          window.localStorage.getItem("brainsrs-sidebar-collapsed") === "true",
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const dueQuestions = useMemo(() => getDueQuestions(state, now), [state, now]);
  const activeCooldown = useMemo(
    () =>
      state.cooldown.filter(
        (item) => new Date(item.availableAt).getTime() > now,
      ),
    [state.cooldown, now],
  );
  const nextCooldownAt = useMemo(
    () =>
      activeCooldown.reduce<string | null>(
        (next, item) =>
          !next || new Date(item.availableAt).getTime() < new Date(next).getTime()
            ? item.availableAt
            : next,
        null,
      ),
    [activeCooldown],
  );
  const scheduledReviews = useMemo(
    () =>
      state.questions.filter((question) => {
        const nextReview = state.progress[question.id]?.nextReview;
        return (
          nextReview &&
          new Date(nextReview).getTime() > now &&
          !isActiveCooldown(state, question.id, now)
        );
      }),
    [state, now],
  );
  const nextScheduledReviewAt = useMemo(
    () =>
      scheduledReviews.reduce<string | null>((next, question) => {
        const availableAt = state.progress[question.id]?.nextReview;
        return availableAt &&
          (!next || new Date(availableAt).getTime() < new Date(next).getTime())
          ? availableAt
          : next;
      }, null),
    [scheduledReviews, state.progress],
  );

  const showToast = (message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      3200,
    );
  };

  const commitAction = async (action: AppAction) => {
    try {
      const payload = await postAction(action);
      setState((current) => mergeAppState(current, payload.state));
      return payload.result;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 401) setUser(null);
      throw error;
    }
  };

  const navigate = (target: PageId) => {
    if (user?.plan === "free" && (target === "stats" || target === "vulnerabilities")) {
      showToast("Este recurso está disponível no plano Pro.");
      return;
    }
    if (target !== "simulation") setSimulationFocusMode(false);
    setMobileMenu(false);
    router.push(pagePaths[target]);
  };

  const openReviewSetup = () => {
    const activeSession = state.activeReviewSession;
    const answered = new Set(activeSession?.answeredQuestionIds ?? []);
    setReviewQueue(
      activeSession?.questionIds.filter((questionId) => !answered.has(questionId)) ?? [],
    );
    setReviewIndex(0);
    setReviewSessionId(activeSession?.id ?? null);
    navigate("review");
  };

  const startDailyReview = (questions = dueQuestions) => {
    const questionIds = questions.map((question) => question.id);
    if (!questionIds.length) return;
    void commitAction({ type: "startReview", questionIds })
      .then((result) => {
        if (!result.reviewSessionId) throw new Error("Falha ao iniciar sessão de revisão.");
        setReviewQueue(questionIds);
        setReviewIndex(0);
        setReviewSessionId(result.reviewSessionId);
        navigate("review");
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao iniciar revisão.");
      });
  };

  const currentReviewQuestion =
    state.questions.find((question) => question.id === reviewQueue[reviewIndex]) ??
    null;

  const registerAnswer = (
    question: Question,
    selected: Alternative,
    responseTimeSeconds: number,
  ) => {
    if (!reviewSessionId) {
      const error = new Error("Inicie uma sessão de revisão antes de responder.");
      showToast(error.message);
      return Promise.reject(error);
    }
    return commitAction({
      type: "answer",
      reviewSessionId,
      requestId: crypto.randomUUID(),
      questionId: question.id,
      selectedAlternativeId: selected.id,
      responseTimeSeconds,
    })
      .then(({ cooldownMinutes }) => {
        if (cooldownMinutes) {
          showToast(`Questão enviada para cooldown por ${cooldownMinutes} minutos.`);
        }
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao salvar resposta.");
        throw error;
      });
  };

  const nextReview = () => {
    if (reviewIndex < reviewQueue.length - 1) {
      setReviewIndex((index) => index + 1);
      return;
    }
    setReviewSessionId(null);
    setReviewIndex((index) => index + 1);
  };

  const importContent = (incoming: ContentImport) => {
    void commitAction({ type: "import", content: incoming, confirmReplace: true })
      .then(() => showToast("Conteúdo importado e adicionado à biblioteca."))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao importar conteúdo.");
      });
  };

  const addQuestion = (question: Question) => {
    void commitAction({ type: "addQuestion", question })
      .then(() => showToast("Questão adicionada à fila de aprendizado."))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao adicionar questão.");
      });
  };

  const addNotebook = (notebook: Notebook) => {
    void commitAction({ type: "addNotebook", notebook })
      .then(() => showToast("Caderno criado. Agora adicione uma matéria."))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao criar caderno.");
      });
  };

  const addSubject = (subject: Subject) => {
    void commitAction({ type: "addSubject", subject })
      .then(() => showToast("Matéria criada. Ela já pode receber questões."))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao criar matéria.");
      });
  };

  const deleteLibraryItem = (target: DeleteTarget) => {
    const action: AppAction =
      target.type === "notebook"
        ? { type: "deleteNotebook", notebookId: target.id }
        : target.type === "subject"
          ? { type: "deleteSubject", subjectId: target.id }
          : { type: "deleteQuestion", questionId: target.id };
    void commitAction(action)
      .then(() => showToast(`${target.type === "notebook" ? "Caderno" : target.type === "subject" ? "Matéria" : "Questão"} excluído com sucesso.`))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao excluir item.");
      });
  };

  const saveSrsSettings = (settings: SrsSettings) => {
    void commitAction({ type: "saveSettings", settings })
      .then(() => showToast("Configurações de revisão salvas."))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao salvar configurações.");
      });
  };

  const authenticate = (payload: AuthPayload) => {
    setState(payload.state);
    setUser(payload.user);
    const activeSession = payload.state.activeReviewSession;
    const answered = new Set(activeSession?.answeredQuestionIds ?? []);
    setReviewQueue(
      activeSession?.questionIds.filter((questionId) => !answered.has(questionId)) ?? [],
    );
    setReviewIndex(0);
    setReviewSessionId(activeSession?.id ?? null);
  };

  const exitReview = () => {
    const currentSessionId = reviewSessionId;
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewSessionId(null);
    navigate("dashboard");
    if (currentSessionId) {
      void commitAction({ type: "abandonReview", reviewSessionId: currentSessionId }).catch(
        (error: unknown) => {
          showToast(error instanceof Error ? error.message : "Falha ao encerrar revisão.");
        },
      );
    }
  };

  const finishOnboarding = () => {
    void completeOnboardingRequest()
      .then(setUser)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Falha ao concluir apresentação.");
      });
  };

  const logout = () => {
    void logoutRequest().finally(() => {
      setUser(null);
      setReviewQueue([]);
      setReviewIndex(0);
      setReviewSessionId(null);
      router.push("/");
    });
  };

  useEffect(() => {
    if (!user) return;
    if (!user.onboardingCompleted && pathname !== "/biblioteca") {
      router.replace("/biblioteca");
      return;
    }
    if (user.plan === "free" && (page === "stats" || page === "vulnerabilities")) {
      router.replace("/biblioteca");
    }
  }, [page, pathname, router, user]);

  if (!hydrated) {
    return <AppLoading />;
  }
  if (!user) return <AuthPage onAuthenticated={authenticate} />;

  const reviewFocusMode =
    (page === "review" && Boolean(currentReviewQuestion)) ||
    (page === "simulation" && simulationFocusMode);

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {!reviewFocusMode && (
        <Sidebar
          user={user}
          page={page}
          open={mobileMenu}
          collapsed={sidebarCollapsed}
          dueCount={dueQuestions.length}
          onClose={() => setMobileMenu(false)}
          onNavigate={navigate}
          onToggleCollapsed={toggleSidebar}
        />
      )}
      <div className={reviewFocusMode ? "" : sidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-[248px]"}>
        {!reviewFocusMode && (
          <Topbar
            user={user}
            onMenu={() => setMobileMenu(true)}
            onLogout={logout}
            dueCount={dueQuestions.length}
          />
        )}
        <main
          className={
            reviewFocusMode
              ? "min-h-screen"
              : "mx-auto min-h-[calc(100vh-64px)] max-w-[1500px] px-3 py-4 sm:min-h-[calc(100vh-72px)] sm:px-6 sm:py-5 lg:px-8 lg:py-7"
          }
        >
          <div key={pathname} className="animate-page-in">
          {page === "dashboard" && (
            <Dashboard
              state={state}
              userName={user.name}
              dueQuestions={dueQuestions}
              cooldownCount={activeCooldown.length}
              nextScheduledReviewAt={nextScheduledReviewAt}
              now={now}
              onNavigate={navigate}
              onStartReview={openReviewSetup}
            />
          )}
          {page === "review" && (
            <ReviewPage
              key={`${currentReviewQuestion?.id ?? "empty"}-${reviewIndex}`}
              answerOrderSeed={reviewSessionId ?? "review"}
              cooldownCount={activeCooldown.length}
              nextCooldownAt={nextCooldownAt}
              scheduledReviewCount={scheduledReviews.length}
              nextScheduledReviewAt={nextScheduledReviewAt}
              now={now}
              currentIndex={reviewIndex}
              question={currentReviewQuestion}
              queueLength={reviewQueue.length}
              state={state}
              dueQuestions={dueQuestions}
              onAnswer={registerAnswer}
              onConfigure={openReviewSetup}
              onExit={exitReview}
              onNext={nextReview}
              onSimulation={() => navigate("simulation")}
              onStart={startDailyReview}
              onStudyNew={() => navigate("library")}
            />
          )}
          {page === "library" && (
            <LibraryPage
              state={state}
              onAddNotebook={addNotebook}
              onAddQuestion={addQuestion}
              onAddSubject={addSubject}
              onDelete={deleteLibraryItem}
              onImport={importContent}
              showOnboarding={!user.onboardingCompleted}
              onFinishOnboarding={finishOnboarding}
            />
          )}
          {page === "stats" && user.plan === "pro" && <StatsPage state={state} />}
          {page === "vulnerabilities" && user.plan === "pro" && (
            <VulnerabilitiesPage
              state={state}
              onStudy={() => {
                setSimulationSource("vulnerabilities");
                navigate("simulation");
              }}
            />
          )}
          {page === "simulation" && (
            <SimulationPage
              initialSource={simulationSource}
              state={state}
              onExit={() => navigate("dashboard")}
              onFocusChange={setSimulationFocusMode}
            />
          )}
          {page === "settings" && (
            <SettingsPage settings={state.settings} user={user} onSave={saveSrsSettings} />
          )}
          </div>
        </main>
      </div>
      {!reviewFocusMode && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="animate-slide-up rounded-2xl border border-[#a5ed6e] bg-white px-4 py-3 text-sm font-bold text-[#58a700] shadow-[0_14px_30px_rgba(48,40,100,0.14)]"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppLoading() {
  return (
    <div className="flex min-h-screen bg-[#f7f7f7]">
      <div className="hidden w-[248px] bg-[#58a700] lg:block" />
      <div className="flex-1 p-8">
        <div className="skeleton h-12 w-72 rounded-2xl" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="skeleton h-36 rounded-[22px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (payload: AuthPayload) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    void postAuth(mode, { name, email, password })
      .then(onAuthenticated)
      .catch((submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Falha ao acessar sua conta.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="grid min-h-screen bg-[#f7f7f7] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#58a700] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#7bd500]/55" />
        <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-[#46a302]/70" />
        <Logo />
        <div className="relative max-w-xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#d7ffb8]">
            Aprendizado inteligente
          </p>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.08] tracking-[-2px]">
            Estude melhor.
            <br />
            Lembre por mais tempo.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] font-semibold leading-7 text-[#e9ffd8]">
            Organize seus cadernos, revise no momento certo e acompanhe sua evolução em uma conta pessoal.
          </p>
        </div>
        <p className="relative text-[11px] font-bold text-[#d7ffb8]">
          BrainSRS · Repetição espaçada para uma rotina consistente
        </p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="animate-card-in w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#58a700] text-white">
                <Brain size={23} />
              </div>
              <p className="text-xl font-extrabold text-[#354055]">Brain<span className="text-[#58a700]">SRS</span></p>
            </div>
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#58a700]">
            Sua conta de estudos
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-1px] text-[#263147]">
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </h2>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-[#8c96a6]">
            {mode === "login"
              ? "Entre para continuar sua rotina de revisões."
              : "Seus cadernos e seu progresso ficam separados dos demais usuários."}
          </p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <label className="block text-[11px] font-extrabold text-[#697487]">
                Nome
                <span className="mt-2 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 py-3 focus-within:border-[#84d8ff]">
                  <UserRound size={16} className="text-[#a5adba]" />
                  <input
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none"
                    placeholder="Como devemos chamar você?"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </span>
              </label>
            )}
            <label className="block text-[11px] font-extrabold text-[#697487]">
              E-mail
              <span className="mt-2 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 py-3 focus-within:border-[#84d8ff]">
                <Mail size={16} className="text-[#a5adba]" />
                <input
                  autoFocus={mode === "login"}
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none"
                  placeholder="voce@exemplo.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>
            <label className="block text-[11px] font-extrabold text-[#697487]">
              Senha
              <span className="mt-2 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 py-3 focus-within:border-[#84d8ff]">
                <LockKeyhole size={16} className="text-[#a5adba]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none"
                  placeholder={mode === "register" ? "Mínimo de 6 caracteres" : "Sua senha"}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </span>
            </label>
            {error && (
              <p className="rounded-xl border border-[#ffd1d1] bg-[#fff8f8] px-3 py-2.5 text-[11px] font-bold leading-5 text-[#cc4b4b]">
                {error}
              </p>
            )}
            <button
              className="w-full rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#61d808] disabled:cursor-wait disabled:opacity-70"
              disabled={loading}
              type="submit"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <button
            className="mt-5 w-full text-center text-[12px] font-extrabold text-[#58a700] hover:text-[#46a302]"
            type="button"
            onClick={() => {
              setMode((current) => (current === "login" ? "register" : "login"));
              setError("");
            }}
          >
            {mode === "login" ? "Ainda não possui conta? Cadastre-se" : "Já possui conta? Entre agora"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/20 text-white shadow-[0_8px_18px_rgba(47,95,0,0.24)]">
        <Brain size={22} strokeWidth={2.4} />
      </div>
      <div className={compact ? "lg:hidden" : ""}>
          <p className="text-[17px] font-extrabold tracking-[-0.5px] text-white">
            Brain<span className="text-[#d7ffb8]">SRS</span>
          </p>
          <p className="text-[9px] font-extrabold uppercase tracking-[2.4px] text-[#d7ffb8]">
            Smart learning
          </p>
        </div>
    </div>
  );
}

const navigation: { id: PageId; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "review", label: "Revisar agora", icon: Zap },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "stats", label: "Estatísticas", icon: BarChart3 },
  { id: "vulnerabilities", label: "Vulnerabilidades", icon: ShieldAlert },
  { id: "simulation", label: "Simulado rápido", icon: GraduationCap },
];

function Sidebar({
  user,
  page,
  open,
  collapsed,
  dueCount,
  onClose,
  onNavigate,
  onToggleCollapsed,
}: {
  user: AuthUser;
  page: PageId;
  open: boolean;
  collapsed: boolean;
  dueCount: number;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-[#2f5f00]/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(284px,calc(100vw-24px))] flex-col overflow-y-auto bg-[#58a700] px-4 py-5 text-white shadow-xl transition-[width,transform] duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[80px] lg:px-3" : "lg:w-[248px]"}`}
      >
        <div className={`flex items-center justify-between ${collapsed ? "lg:justify-center lg:px-0" : "px-2"}`}>
          <Logo compact={collapsed} />
          <button
            aria-label="Fechar menu"
            className="rounded-lg p-1 text-[#9a94c2] hover:bg-white/10 lg:hidden"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className={`mt-9 px-2 text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#d7ffb8] ${collapsed ? "lg:hidden" : ""}`}>
          Menu principal
        </div>
        <nav className={collapsed ? "mt-9 space-y-1" : "mt-3 space-y-1"}>
          {navigation
            .filter(
              (item) =>
                user.plan === "pro" ||
                (item.id !== "stats" && item.id !== "vulnerabilities"),
            )
            .map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                title={collapsed ? item.label : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
                  active
                    ? "bg-white text-[#58a700] shadow-[0_4px_0_rgba(47,95,0,0.22)]"
                    : "text-white hover:bg-white/[0.12] hover:text-white"
                } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                {item.id === "review" && dueCount > 0 && (
                  <span className={`rounded-full bg-[#ffb454] px-2 py-0.5 text-[10px] font-extrabold text-[#513714] ${collapsed ? "lg:absolute lg:-right-1 lg:-top-1 lg:px-1.5" : "ml-auto"}`}>
                    {dueCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className={`mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.06] p-3 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#ffffff]">
              <Sparkles size={15} className="text-[#ffc800]" />
              Plano {user.plan === "pro" ? "Pro" : "Free"}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#e9f8dd]">
              {user.plan === "pro"
                ? "Relatórios avançados e estudo focado disponíveis."
                : "Biblioteca, revisões e simulados disponíveis."}
            </p>
          </div>
          <button
            title={collapsed ? "Configurações" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
              page === "settings"
                ? "bg-white text-[#58a700] shadow-[0_4px_0_rgba(47,95,0,0.22)]"
                : "text-[#ffffff] hover:bg-white/[0.07] hover:text-white"
            } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
            onClick={() => onNavigate("settings")}
          >
            <Settings2 size={18} />
            <span className={collapsed ? "lg:hidden" : ""}>Configurações</span>
          </button>
          <button
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            className="mt-2 hidden w-full items-center justify-center rounded-xl px-3 py-2.5 text-white transition hover:bg-white/[0.12] lg:flex"
            onClick={onToggleCollapsed}
          >
            <ChevronRight
              size={18}
              className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  dueCount,
  onMenu,
  onLogout,
  user,
}: {
  dueCount: number;
  onMenu: () => void;
  onLogout: () => void;
  user: AuthUser;
}) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#e5e5e5] bg-white/90 px-3 backdrop-blur sm:h-[72px] sm:px-6 lg:px-8">
      <button
        aria-label="Abrir menu"
        className="mr-3 rounded-xl p-2 text-[#5f6b7d] hover:bg-[#f7f7f7] lg:hidden"
        onClick={onMenu}
      >
        <Menu size={21} />
      </button>
      <div className="hidden items-center gap-2 text-xs font-bold text-[#8a94a6] sm:flex">
        <CalendarDays size={16} />
        <span className="capitalize">{formatDate(new Date())}</span>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-4">
        <button className="relative rounded-xl p-2.5 text-[#6e7789] transition hover:bg-[#f7f7f7]">
          <Bell size={19} />
          {dueCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#f18a52]" />
          )}
        </button>
        <div className="hidden h-8 w-px bg-[#e5e5e5] sm:block" />
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d7ffb8] text-xs font-extrabold text-[#58a700]">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-40 truncate text-xs font-extrabold text-[#263147]">{user.name}</span>
            <span className="block text-[10px] font-bold text-[#9aa3b1]">
              Estudante {user.plan === "pro" ? "Pro" : "Free"}
            </span>
          </span>
        </div>
        <button
          aria-label="Sair da conta"
          className="rounded-xl p-2 text-[#9aa3b1] transition hover:bg-[#fff0f0] hover:text-[#ff4b4b]"
          title="Sair da conta"
          onClick={onLogout}
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[1.7px] text-[#58a700]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[24px] font-extrabold tracking-[-0.8px] text-[#202a41] sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-[#8690a1]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">{actions}</div>}
    </div>
  );
}

function Dashboard({
  state,
  userName,
  dueQuestions,
  cooldownCount,
  nextScheduledReviewAt,
  now,
  onNavigate,
  onStartReview,
}: {
  state: AppState;
  userName: string;
  dueQuestions: Question[];
  cooldownCount: number;
  nextScheduledReviewAt: string | null;
  now: number;
  onNavigate: (page: PageId) => void;
  onStartReview: () => void;
}) {
  const activityDates = getActivityDates(state.logs);
  const streak = calculateStreak(activityDates);
  const studiedToday = state.logs.filter(
    (log) => localDay(new Date(log.answeredAt)) === localDay(),
  ).length;
  const retention = state.logs.length
    ? Math.round(
        (state.logs.filter((log) => log.correct).length / state.logs.length) * 100,
      )
    : 0;
  const weakQuestions = state.questions
    .filter((question) => (state.progress[question.id]?.mistakes ?? 0) >= 3)
    .slice(0, 3);
  const weekActivity = getRecentDailyActivity(state.logs, 7);
  const maxDailyActivity = Math.max(1, ...weekActivity.map((item) => item.count));
  const retentionTrend = getRetentionTrend(state.logs);
  const retentionInsight = getRetentionInsight(state.logs);
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#8a94a5]">Bom dia, {userName.split(/\s+/)[0]}</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-1px] text-[#202a41] sm:text-[32px]">
            Pronto para fortalecer sua memória?
          </h1>
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#61d808] active:translate-y-0.5 active:border-b-2 md:w-auto"
          onClick={onStartReview}
        >
          <Zap size={17} fill="currentColor" />
          Iniciar revisão
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<BookMarked size={20} />}
          iconClass="bg-[#d7ffb8] text-[#58cc02]"
          title="Para revisar"
          value={String(dueQuestions.length)}
          delay={0}
          detail={
            cooldownCount
              ? `+ ${cooldownCount} em cooldown`
              : dueQuestions.length
                ? "Fila disponível agora"
                : nextScheduledReviewAt
                  ? `Próxima revisão em ${formatCountdown(nextScheduledReviewAt, now)}`
                  : "Nenhuma revisão agendada"
          }
        />
        <MetricCard
          icon={<Flame size={20} />}
          iconClass="bg-[#fff2de] text-[#ff9600]"
          title="Ofensiva atual"
          value={formatDays(streak)}
          detail="Continue construindo consistência"
          delay={55}
        />
        <MetricCard
          icon={<Target size={20} />}
          iconClass="bg-[#e9f9f1] text-[#58a700]"
          title="Retenção média"
          value={`${retention}%`}
          detail={retentionTrend}
          delay={110}
        />
        <MetricCard
          icon={<Clock3 size={20} />}
          iconClass="bg-[#eaf4ff] text-[#1cb0f6]"
          title="Estudadas hoje"
          value={String(studiedToday)}
          detail="Respostas registradas"
          delay={165}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <AnimatedCard delay={220} className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 shadow-[0_7px_18px_rgba(41,50,81,0.035)] sm:p-5">
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#2a354b]">Ritmo de estudo</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#9aa3b1]">
                Questões respondidas nos últimos 7 dias
              </p>
            </div>
            <span className="rounded-lg bg-[#eef9ff] px-2.5 py-1 text-[10px] font-extrabold text-[#58a700]">
              Esta semana
            </span>
          </div>
          <div className="mt-7 flex h-[150px] items-end justify-between gap-1.5 border-b border-[#edf0f5] px-1 sm:h-[178px] sm:gap-3">
            {weekActivity.map((item) => (
              <div key={item.dateKey} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className={`w-full max-w-[34px] rounded-t-[8px] ${
                    item.count
                      ? item.dateKey === localDay()
                        ? "bg-[#58cc02]"
                        : "bg-[#bfeea0]"
                      : "bg-[#edf0f5]"
                  }`}
                  style={{ height: item.count ? `${Math.max(8, (item.count / maxDailyActivity) * 100)}%` : "4px" }}
                  title={`${item.date.toLocaleDateString("pt-BR")}: ${item.count} ${
                    item.count === 1 ? "resposta" : "respostas"
                  }`}
                />
                <span className="pb-2 text-[10px] font-extrabold uppercase text-[#a5adba]">
                  {new Intl.DateTimeFormat("pt-BR", { weekday: "narrow" }).format(item.date)}
                </span>
              </div>
            ))}
          </div>
        </AnimatedCard>
        <AnimatedCard delay={275} className="relative overflow-hidden rounded-[20px] bg-[#1cb0f6] p-4 text-white shadow-[0_10px_24px_rgba(39,33,100,0.16)] sm:p-5">
          <div className="absolute -right-9 -top-9 h-40 w-40 rounded-full bg-[#84d8ff]/20" />
          <div className="absolute -bottom-10 right-7 h-24 w-24 rounded-full border border-[#84d8ff]/20" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#ffffff]">
              <Sparkles size={20} />
            </div>
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#d6f1ff]">
              Insight da semana
            </p>
            <h2 className="mt-2 text-lg font-extrabold leading-7">
              {retentionInsight.title}
            </h2>
            <p className="mt-2 text-xs font-medium leading-5 text-[#e8f7ff]">
              {retentionInsight.detail}
            </p>
          </div>
        </AnimatedCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <AnimatedCard delay={330} className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#2a354b]">Matérias em andamento</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#9aa3b1]">
                Retenção e carga pendente por matéria
              </p>
            </div>
            <button
              className="text-[11px] font-extrabold text-[#58a700] hover:text-[#46a302]"
              onClick={() => onNavigate("library")}
            >
              Ver biblioteca
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {state.subjects.slice(0, 4).map((subject) => {
              const count = dueQuestions.filter(
                (question) => question.subjectId === subject.id,
              ).length;
              const retentionValue = getSubjectRetention(state, subject.id);
              return (
                <div
                  key={subject.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#eef0f4] px-3 py-3 min-[420px]:flex-row min-[420px]:items-center"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: subject.color }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[12px] font-extrabold text-[#354056]">
                        {subject.name}
                      </p>
                      <span className="text-[11px] font-extrabold text-[#768195]">
                        {retentionValue}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0f5]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${retentionValue}%`,
                          backgroundColor: subject.color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#99a2b1] min-[420px]:min-w-16 min-[420px]:text-right">
                    {count} pendentes
                  </span>
                </div>
              );
            })}
          </div>
        </AnimatedCard>
        <AnimatedCard delay={385} className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#2a354b]">Pontos de atenção</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#9aa3b1]">
                Gargalos identificados recentemente
              </p>
            </div>
            <AlertTriangle size={18} className="text-[#ffc800]" />
          </div>
          <div className="mt-4 space-y-3">
            {weakQuestions.map((question) => (
              <div key={question.id} className="rounded-xl bg-[#fff9ed] px-3 py-3">
                <p className="line-clamp-2 text-[11px] font-extrabold leading-5 text-[#675138]">
                  {question.prompt}
                </p>
                <p className="mt-1 text-[10px] font-bold text-[#d28c27]">
                  {state.progress[question.id].mistakes} erros registrados
                </p>
              </div>
            ))}
            {!weakQuestions.length && (
              <p className="rounded-xl bg-[#f7f7f7] px-3 py-3 text-[11px] font-bold leading-5 text-[#8c96a5]">
                Nenhuma questão atingiu o limite de erros até o momento.
              </p>
            )}
          </div>
          <button
            className="mt-4 flex items-center gap-1 text-[11px] font-extrabold text-[#58a700]"
            onClick={() => onNavigate("vulnerabilities")}
          >
            Abrir caderno de erros <ArrowRight size={13} />
          </button>
        </AnimatedCard>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  iconClass,
  title,
  value,
  detail,
  delay = 0,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  value: string;
  detail: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-card-in rounded-[20px] border-2 border-b-4 border-[#e5e5e5] bg-white p-4"
      style={{ "--card-delay": `${delay}ms` } as CSSProperties}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      <p className="mt-4 text-[11px] font-bold text-[#97a0af]">{title}</p>
      <p className="mt-1 text-[24px] font-extrabold tracking-[-0.7px] text-[#2b354a]">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-[#a1a9b6]">{detail}</p>
    </div>
  );
}

function AnimatedCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <div
      className={`animate-card-in ${className}`}
      style={{ "--card-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function StyledSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative mt-2 ${open ? "z-[70]" : "z-0"}`}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 border-b-4 bg-white px-3 py-3 text-left text-[12px] font-bold text-[#4b4b4b] outline-none transition ${
          open ? "border-[#84d8ff]" : "border-[#e5e5e5] hover:border-[#cfd4dc]"
        }`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected?.label ?? "Selecione uma opção"}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-[#777] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="animate-dropdown-in absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-56 overflow-auto rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-[0_14px_28px_rgba(41,50,81,0.16)]"
          role="listbox"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                aria-selected={active}
                className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[12px] font-bold transition ${
                  active
                    ? "bg-[#e9f8dd] text-[#58a700]"
                    : "text-[#596477] hover:bg-[#f7f7f7] hover:text-[#354055]"
                }`}
                role="option"
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewPage({
  answerOrderSeed,
  question,
  state,
  dueQuestions,
  currentIndex,
  queueLength,
  cooldownCount,
  nextCooldownAt,
  scheduledReviewCount,
  nextScheduledReviewAt,
  now,
  onAnswer,
  onConfigure,
  onNext,
  onExit,
  onSimulation,
  onStart,
  onStudyNew,
}: {
  answerOrderSeed: string;
  question: Question | null;
  state: AppState;
  dueQuestions: Question[];
  currentIndex: number;
  queueLength: number;
  cooldownCount: number;
  nextCooldownAt: string | null;
  scheduledReviewCount: number;
  nextScheduledReviewAt: string | null;
  now: number;
  onAnswer: (question: Question, selected: Alternative, seconds: number) => Promise<unknown>;
  onConfigure: () => void;
  onNext: () => void;
  onExit: () => void;
  onSimulation: () => void;
  onStart: (questions: Question[]) => void;
  onStudyNew: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const displayedAlternatives = useMemo(
    () =>
      question
        ? shuffleAlternatives(
            question.alternatives,
            `${answerOrderSeed}:${question.id}:${currentIndex}`,
          )
        : [],
    [answerOrderSeed, currentIndex, question],
  );

  if (!queueLength) {
    return (
      <ReviewSetup
        dueQuestions={dueQuestions}
        state={state}
        cooldownCount={cooldownCount}
        nextCooldownAt={nextCooldownAt}
        scheduledReviewCount={scheduledReviewCount}
        nextScheduledReviewAt={nextScheduledReviewAt}
        now={now}
        onExit={onExit}
        onSimulation={onSimulation}
        onStart={onStart}
        onStudyNew={onStudyNew}
      />
    );
  }
  if (!question) {
    return (
      <EmptyReview
        cooldownCount={cooldownCount}
        nextCooldownAt={nextCooldownAt}
        scheduledReviewCount={scheduledReviewCount}
        nextScheduledReviewAt={nextScheduledReviewAt}
        now={now}
        onExit={onExit}
        onStart={onConfigure}
        title={cooldownCount ? "Fila principal concluída" : "Revisão concluída"}
        description={
          cooldownCount
            ? "As questões que você errou voltarão automaticamente após o período de cooldown."
            : "Você zerou sua fila de revisão diária. Bom trabalho."
        }
      />
    );
  }

  const subject = state.subjects.find((item) => item.id === question.subjectId);
  const progress = state.progress[question.id];
  const selected = question.alternatives.find((item) => item.id === selectedId);
  const alternativesToDisplay = displayedAlternatives.length ? displayedAlternatives : question.alternatives;

  const selectAnswer = (alternative: Alternative) => {
    setInspectedId(alternative.id);
    if (selectedId) return;
    setSelectedId(alternative.id);
    const seconds = 12 + (question.prompt.length % 17);
    setSavingAnswer(true);
    void onAnswer(question, alternative, seconds)
      .catch(() => {
        setSelectedId(null);
        setInspectedId(null);
      })
      .finally(() => setSavingAnswer(false));
  };

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[980px]">
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            aria-label="Sair da revisão"
            className="rounded-xl p-1 text-[#afafaf] transition hover:bg-[#f3f3f3] hover:text-[#777]"
            onClick={onExit}
          >
            <X size={24} strokeWidth={3} />
          </button>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e5e5e5] sm:h-4">
            <div
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500"
              style={{ width: `${((currentIndex + (selectedId ? 1 : 0)) / queueLength) * 100}%` }}
            />
          </div>
          <div className="flex min-w-fit items-center gap-1 text-[12px] font-extrabold text-[#ff9600] sm:gap-1.5 sm:text-[14px]">
            <Flame size={18} fill="currentColor" />
            {Math.min(currentIndex + 1, queueLength)}/{queueLength}
          </div>
        </div>

        <div className="mx-auto max-w-[760px] pb-40 pt-8 sm:pb-36 sm:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e9f8dd] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#58a700]">
              {subject?.name}
            </span>
            <span className="rounded-full bg-[#f3f3f3] px-3 py-1.5 text-[11px] font-extrabold text-[#8c8c8c]">
              {progress.state === "learning" ? "Em aprendizado" : "Revisão espaçada"}
            </span>
            {cooldownCount > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-[#fff5d9] px-3 py-1.5 text-[11px] font-extrabold text-[#c77d00]">
                <TimerReset size={13} /> {cooldownCount} em cooldown
                {formatCountdown(nextCooldownAt, now) && (
                  <span className="font-black tabular-nums">
                    · {formatCountdown(nextCooldownAt, now)}
                  </span>
                )}
              </span>
            )}
          </div>

          <p className="mt-8 text-[14px] font-extrabold uppercase tracking-[0.8px] text-[#777]">
            Selecione a resposta correta
          </p>
          <h1 className="mt-3 text-[20px] font-extrabold leading-8 tracking-[-0.4px] text-[#3c3c3c] sm:text-[28px] sm:leading-10">
            {question.prompt}
          </h1>
          <button
            className="mt-5 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 py-2 text-[12px] font-extrabold text-[#777] transition hover:bg-[#f7f7f7]"
            onClick={() => setHintOpen((open) => !open)}
          >
            <Lightbulb size={16} className="text-[#ffc800]" />
            {hintOpen ? "Ocultar dica" : "Mostrar dica"}
            <ChevronDown size={14} className={`transition ${hintOpen ? "rotate-180" : ""}`} />
          </button>
          {hintOpen && (
            <p className="mt-3 rounded-2xl border-2 border-[#ffe58a] bg-[#fffbea] px-4 py-3 text-[13px] font-semibold leading-6 text-[#806d28]">
              {question.hint}
            </p>
          )}

          <div className="mt-8 grid gap-3">
            {alternativesToDisplay.map((alternative, alternativeIndex) => {
              const answered = Boolean(selectedId);
              const chosen = selectedId === alternative.id;
              const inspected = inspectedId === alternative.id;
              const tone = answered
                ? alternative.isCorrect
                  ? "border-[#58cc02] bg-[#f1ffe7] text-[#46a302]"
                  : chosen
                    ? "border-[#ff4b4b] bg-[#fff0f0] text-[#ea2b2b]"
                    : inspected
                      ? "border-[#84d8ff] bg-[#f2fbff] text-[#168dca]"
                      : "border-[#e5e5e5] bg-white text-[#4b4b4b]"
                : "border-[#e5e5e5] bg-white text-[#4b4b4b] hover:border-[#1cb0f6] hover:bg-[#f2fbff]";
              return (
                <div key={alternative.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 px-3 py-3.5 text-left transition active:translate-y-0.5 active:border-b-2 sm:gap-4 sm:px-4 sm:py-4 ${tone}`}
                    onClick={() => selectAnswer(alternative)}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-[12px] font-extrabold opacity-75 sm:h-8 sm:w-8 sm:text-[13px]">
                      {answerLabels[alternativeIndex] ?? alternative.label}
                    </span>
                    <span className="flex-1 text-[14px] font-extrabold leading-6 sm:text-[15px]">
                      {alternative.text}
                    </span>
                    {answered && alternative.isCorrect && <CheckCircle2 size={22} className="shrink-0" />}
                    {answered && chosen && !alternative.isCorrect && <XCircle size={22} className="shrink-0" />}
                  </button>
                  {answered && inspected && (
                    <div className="animate-slide-up px-2 pt-3">
                      <p className="text-[12px] font-semibold leading-5 text-[#777]">
                        {alternative.rationale}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className={`animate-feedback-in fixed bottom-0 left-0 right-0 z-40 border-t-2 ${
            selected.isCorrect
              ? "border-[#a5ed6e] bg-[#d7ffb8]"
              : "border-[#ffc1c1] bg-[#ffdfe0]"
          }`}
        >
          <div className="mx-auto flex max-w-[980px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70 ${
                  selected.isCorrect ? "text-[#58a700]" : "text-[#ea2b2b]"
                }`}
              >
                {selected.isCorrect ? <CheckCircle2 size={27} /> : <XCircle size={27} />}
              </div>
              <div>
                <p className={`text-[18px] font-extrabold ${selected.isCorrect ? "text-[#58a700]" : "text-[#ea2b2b]"}`}>
                  {selected.isCorrect ? "Muito bem!" : "Quase lá!"}
                </p>
                <p className={`mt-0.5 text-[12px] font-bold ${selected.isCorrect ? "text-[#6da83e]" : "text-[#cf5d5d]"}`}>
                  {selected.isCorrect
                    ? "Você fortaleceu esta memória."
                    : "Esta questão voltará após o cooldown para reforço."}
                </p>
              </div>
            </div>
            <button
              className={`flex w-full items-center justify-center gap-2 rounded-xl border-b-4 px-7 py-3 text-[13px] font-extrabold uppercase tracking-[0.6px] text-white transition active:translate-y-0.5 active:border-b-2 sm:w-auto ${
                selected.isCorrect
                  ? "border-[#46a302] bg-[#58cc02] hover:bg-[#61d808]"
                  : "border-[#d83333] bg-[#ff4b4b] hover:bg-[#ff5b5b]"
              }`}
              disabled={savingAnswer}
              onClick={onNext}
            >
              {savingAnswer ? "Salvando..." : "Continuar"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CooldownNotice({
  count,
  nextCooldownAt,
  now,
}: {
  count: number;
  nextCooldownAt: string | null;
  now: number;
}) {
  const countdown = formatCountdown(nextCooldownAt, now);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#fff7e7] px-3 py-2 text-[11px] font-extrabold text-[#c27b17]">
      <TimerReset size={14} />
      <span>
        {count} {count === 1 ? "questão aguarda" : "questões aguardam"} cooldown
      </span>
      {countdown && (
        <span className="ml-auto text-[#9a630f]">
          Próxima liberação em{" "}
          <span className="font-black tabular-nums">{countdown}</span>
        </span>
      )}
    </div>
  );
}

function ScheduledReviewNotice({
  count,
  nextReviewAt,
  now,
}: {
  count: number;
  nextReviewAt: string | null;
  now: number;
}) {
  const countdown = formatCountdown(nextReviewAt, now);
  if (!count || !countdown) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#eef9ff] px-3 py-2 text-[11px] font-extrabold text-[#168dca]">
      <Clock3 size={14} />
      <span>
        {count} {count === 1 ? "questão agendada" : "questões agendadas"}
      </span>
      <span className="ml-auto text-[#1177a8]">
        Próxima revisão em{" "}
        <span className="font-black tabular-nums">{countdown}</span>
      </span>
    </div>
  );
}

function EmptyReview({
  title,
  description,
  cooldownCount,
  nextCooldownAt,
  scheduledReviewCount,
  nextScheduledReviewAt,
  now,
  onExit,
  onStart,
}: {
  title: string;
  description: string;
  cooldownCount: number;
  nextCooldownAt: string | null;
  scheduledReviewCount: number;
  nextScheduledReviewAt: string | null;
  now: number;
  onExit: () => void;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[68vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-[24px] border-2 border-b-4 border-[#e5e5e5] bg-white p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d7ffb8] text-[#58a700]">
          {cooldownCount ? <TimerReset size={30} /> : <Trophy size={30} />}
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-[#3c3c3c]">{title}</h1>
        <p className="mt-2 text-[13px] font-semibold leading-6 text-[#777]">
          {description}
        </p>
        {cooldownCount > 0 && (
          <CooldownNotice
            count={cooldownCount}
            nextCooldownAt={nextCooldownAt}
            now={now}
          />
        )}
        <ScheduledReviewNotice
          count={scheduledReviewCount}
          nextReviewAt={nextScheduledReviewAt}
          now={now}
        />
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            className="rounded-xl border-2 border-b-4 border-[#e5e5e5] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#777]"
            onClick={onExit}
          >
            Voltar ao painel
          </button>
          <button
            className="rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white"
            onClick={onStart}
          >
            Atualizar fila
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewSetup({
  state,
  dueQuestions,
  cooldownCount,
  nextCooldownAt,
  scheduledReviewCount,
  nextScheduledReviewAt,
  now,
  onExit,
  onSimulation,
  onStart,
  onStudyNew,
}: {
  state: AppState;
  dueQuestions: Question[];
  cooldownCount: number;
  nextCooldownAt: string | null;
  scheduledReviewCount: number;
  nextScheduledReviewAt: string | null;
  now: number;
  onExit: () => void;
  onSimulation: () => void;
  onStart: (questions: Question[]) => void;
  onStudyNew: () => void;
}) {
  const [notebookId, setNotebookId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const subjects =
    notebookId === "all"
      ? state.subjects
      : state.subjects.filter((subject) => subject.notebookId === notebookId);
  const filteredQuestions = dueQuestions.filter((question) => {
    const subject = state.subjects.find((item) => item.id === question.subjectId);
    if (!subject) return false;
    if (notebookId !== "all" && subject.notebookId !== notebookId) return false;
    return subjectId === "all" || question.subjectId === subjectId;
  });
  const nextAvailableAt = nextCooldownAt
    ? !nextScheduledReviewAt ||
      new Date(nextCooldownAt).getTime() < new Date(nextScheduledReviewAt).getTime()
      ? nextCooldownAt
      : nextScheduledReviewAt
    : nextScheduledReviewAt;
  const nextCountdown = formatCountdown(nextAvailableAt, now);
  const isUpToDate = dueQuestions.length === 0;

  return (
    <div className={`mx-auto flex min-h-[68vh] items-center justify-center ${isUpToDate ? "max-w-4xl" : "max-w-2xl"}`}>
      <div className="animate-card-in w-full rounded-[24px] border-2 border-b-4 border-[#e5e5e5] bg-white p-6 shadow-[0_12px_30px_rgba(41,50,81,0.06)] sm:p-8">
        <div className={isUpToDate ? "text-center" : ""}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#d7ffb8] text-[#58a700] ${isUpToDate ? "mx-auto" : ""}`}>
            <CalendarDays size={27} />
          </div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[1.7px] text-[#58a700]">
            {isUpToDate ? "Revisão do dia" : "Fila de revisão"}
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-[#3c3c3c] sm:text-2xl">
            {isUpToDate ? "Você está em dia 🎉" : "O que você quer revisar agora?"}
          </h1>
          <p className="mt-2 text-[12px] font-semibold leading-6 text-[#777]">
            {isUpToDate
              ? "Nenhuma questão venceu no momento. Suas próximas revisões estarão disponíveis em breve."
              : "Escolha um caderno e uma matéria. Apenas questões vencidas entram na sessão."}
          </p>
        </div>
        {isUpToDate && nextCountdown && (
          <div className="animate-soft-pulse mx-auto mt-5 max-w-sm rounded-xl border border-[#d5ebcc] bg-[#f4fbef] px-4 py-3 text-center">
            <p className="text-[10px] font-extrabold text-[#71ae4b]">Próxima revisão em</p>
            <p className="mt-0.5 text-[31px] font-black leading-none tabular-nums tracking-[0.5px] text-[#58a700]">
              {nextCountdown}
            </p>
          </div>
        )}
        {isUpToDate && scheduledReviewCount > 0 && (
          <div className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 rounded-xl border border-[#cbe9fb] bg-[#eef9ff] px-3 py-2 text-[11px] font-extrabold text-[#168dca]">
            <CalendarDays size={14} />
            {scheduledReviewCount} {scheduledReviewCount === 1 ? "questão agendada" : "questões agendadas"}
          </div>
        )}
        <div className={`grid gap-3 sm:grid-cols-2 ${isUpToDate ? "mt-6 border-t border-[#edf0f4] pt-5" : "mt-6"}`}>
          <div className="text-[11px] font-extrabold text-[#697487]">
            Caderno
            <StyledSelect
              value={notebookId}
              options={[
                { value: "all", label: "Todos os cadernos" },
                ...state.notebooks.map((notebook) => ({
                  value: notebook.id,
                  label: notebook.name,
                })),
              ]}
              onChange={(value) => {
                setNotebookId(value);
                setSubjectId("all");
              }}
            />
          </div>
          <div className="text-[11px] font-extrabold text-[#697487]">
            Matéria
            <StyledSelect
              value={subjectId}
              options={[
                { value: "all", label: "Todas as matérias" },
                ...subjects.map((subject) => ({
                  value: subject.id,
                  label: subject.name,
                })),
              ]}
              onChange={setSubjectId}
            />
          </div>
        </div>
        {isUpToDate && (
          <p className="mt-3 flex items-center gap-2 text-[10px] font-bold leading-5 text-[#8c96a5]">
            <CircleHelp size={14} />
            Escolha um caderno e uma matéria para personalizar sua revisão quando houver questões disponíveis.
          </p>
        )}
        <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
          <div>
            <p className="text-[11px] font-extrabold text-[#667184]">Questões disponíveis</p>
            <p className="mt-1 text-[10px] font-bold text-[#a0a8b5]">
              Fila vencida no momento
            </p>
          </div>
          <span className="text-xl font-extrabold text-[#58a700]">
            {filteredQuestions.length}
          </span>
        </div>
        {cooldownCount > 0 && (
          <CooldownNotice
            count={cooldownCount}
            nextCooldownAt={nextCooldownAt}
            now={now}
          />
        )}
        {!isUpToDate && (
          <ScheduledReviewNotice
            count={scheduledReviewCount}
            nextReviewAt={nextScheduledReviewAt}
            now={now}
          />
        )}
        {isUpToDate && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#d8edce] bg-[#f4fbef] px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#58a700] text-white">
              <CheckCircle2 size={18} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold text-[#477c2a]">Nenhuma revisão pendente agora</p>
              <p className="mt-0.5 text-[10px] font-bold text-[#78946b]">Você está em dia! Continue assim.</p>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="rounded-xl border-2 border-b-4 border-[#e5e5e5] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#777] transition hover:bg-[#f7f7f7] active:translate-y-0.5 active:border-b-2"
            onClick={onExit}
          >
            Voltar ao painel
          </button>
          {isUpToDate ? (
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white transition hover:bg-[#61d808] active:translate-y-0.5 active:border-b-2"
              onClick={onStudyNew}
            >
              <BookOpen size={15} /> Estudar novas questões
            </button>
          ) : (
            <button
              className="flex items-center justify-center gap-2 rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white transition hover:bg-[#61d808] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!filteredQuestions.length}
              onClick={() => onStart(filteredQuestions)}
            >
              <Zap size={15} /> Começar revisão
            </button>
          )}
        </div>
        {isUpToDate && (
          <div className="mt-4 border-t border-[#edf0f4] pt-4 text-center">
            <button
              className="inline-flex items-center gap-2 text-[11px] font-extrabold text-[#58a700] transition hover:text-[#46a302]"
              onClick={onSimulation}
            >
              <GraduationCap size={15} /> Fazer simulado rápido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryPage({
  state,
  showOnboarding,
  onFinishOnboarding,
  onImport,
  onAddNotebook,
  onAddSubject,
  onAddQuestion,
  onDelete,
}: {
  state: AppState;
  showOnboarding: boolean;
  onFinishOnboarding: () => void;
  onImport: (content: Pick<AppState, "notebooks" | "subjects" | "questions">) => void;
  onAddNotebook: (notebook: Notebook) => void;
  onAddSubject: (subject: Subject) => void;
  onAddQuestion: (question: Question) => void;
  onDelete: (target: DeleteTarget) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedNotebooks, setExpandedNotebooks] = useState<string[]>([
    "nb-humanas",
    "nb-negocios",
    "nb-tecnologia",
  ]);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>(["sub-filosofia"]);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ContentImport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchingQuestions = state.questions.filter((question) =>
    question.prompt.toLowerCase().includes(search.toLowerCase()),
  );
  const toggle = (items: string[], id: string, update: (value: string[]) => void) =>
    update(items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const parseImportContent = (rawJson: string) => {
    try {
      const parsed = contentImportSchema.safeParse(JSON.parse(rawJson));
      if (!parsed.success) throw new Error("invalid");
      setPendingImport(parsed.data);
      setImportHelpOpen(false);
      return true;
    } catch {
      window.alert("JSON inválido. Use uma exportação BrainSRS no formato correto.");
      return false;
    }
  };

  const readImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      parseImportContent(await file.text());
    } catch {
      window.alert("Arquivo inválido. Use uma exportação BrainSRS em JSON.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Organização do conhecimento"
        title="Biblioteca"
        description="Gerencie seus cadernos, matérias e questões em uma estrutura simples de navegar."
        actions={
          <>
            <input
              ref={inputRef}
              accept=".json,.qzs"
              className="hidden"
              type="file"
              onChange={readImport}
            />
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-[11px] font-extrabold text-[#6d7789] sm:w-auto"
              onClick={() => setImportHelpOpen(true)}
            >
              <ImportIcon size={15} /> Importar
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-[11px] font-extrabold text-[#6d7789] sm:w-auto"
              onClick={() => setExportOpen(true)}
            >
              <Download size={15} /> Exportar
            </button>
            <button
              data-tour-target="notebook"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#a5ed6e] bg-[#f7fff2] px-3 py-2.5 text-[11px] font-extrabold text-[#58a700] sm:w-auto"
              onClick={() => setNotebookOpen(true)}
            >
              <Plus size={15} /> Novo caderno
            </button>
            <button
              data-tour-target="subject"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#a5ed6e] bg-[#f7fff2] px-3 py-2.5 text-[11px] font-extrabold text-[#58a700] sm:w-auto"
              onClick={() => setSubjectOpen(true)}
            >
              <Plus size={15} /> Nova matéria
            </button>
            <button
              data-tour-target="question"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#58cc02] px-3 py-2.5 text-[11px] font-extrabold text-white sm:w-auto"
              onClick={() => setQuestionOpen(true)}
            >
              <Plus size={15} /> Nova questão
            </button>
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="min-w-0 rounded-[20px] border border-[#e5e5e5] bg-white p-3 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8b0bd]" size={17} />
            <input
              className="w-full rounded-xl border border-[#e9ebf1] bg-[#fafafa] py-2.5 pl-10 pr-3 text-[12px] font-semibold text-[#546074] outline-none transition focus:border-[#84d8ff]"
              placeholder="Buscar questão por palavra-chave..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {search ? (
            <div className="mt-4 space-y-2">
              {matchingQuestions.map((question) => (
                <QuestionListItem
                  key={question.id}
                  progress={state.progress[question.id]}
                  question={question}
                  onDelete={() =>
                    setDeleteTarget({ type: "question", id: question.id, name: question.prompt })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {state.notebooks.map((notebook) => (
                <NotebookTree
                  key={notebook.id}
                  expanded={expandedNotebooks.includes(notebook.id)}
                  expandedSubjects={expandedSubjects}
                  notebook={notebook}
                  progress={state.progress}
                  questions={state.questions}
                  subjects={state.subjects}
                  onSubjectToggle={(id) =>
                    toggle(expandedSubjects, id, setExpandedSubjects)
                  }
                  onDelete={setDeleteTarget}
                  onToggle={() =>
                    toggle(expandedNotebooks, notebook.id, setExpandedNotebooks)
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-5">
            <h2 className="text-[14px] font-extrabold text-[#344055]">Resumo da biblioteca</h2>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
              <LibraryMetric label="Cadernos" value={state.notebooks.length} />
              <LibraryMetric label="Matérias" value={state.subjects.length} />
              <LibraryMetric label="Questões" value={state.questions.length} />
            </div>
          </div>
          <div className="rounded-[20px] border border-[#e5e5e5] bg-[#1cb0f6] p-4 text-white sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#ffffff]">
              <Upload size={19} />
            </div>
            <h2 className="mt-4 text-[14px] font-extrabold">Compartilhe seus cadernos</h2>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#e8f7ff]">
              Exporte conteúdo sem dados pessoais de progresso. Quem importar começa com a revisão zerada.
            </p>
          </div>
        </div>
      </section>
      {questionOpen && (
        <AddQuestionModal
          subjects={state.subjects}
          onClose={() => setQuestionOpen(false)}
          onSubmit={(question) => {
            onAddQuestion(question);
            setQuestionOpen(false);
          }}
        />
      )}
      {exportOpen && (
        <ExportContentModal
          state={state}
          onClose={() => setExportOpen(false)}
        />
      )}
      {importHelpOpen && (
        <ImportFormatModal
          onClose={() => setImportHelpOpen(false)}
          onChooseFile={() => {
            setImportHelpOpen(false);
            window.setTimeout(() => inputRef.current?.click(), 0);
          }}
          onPasteJson={parseImportContent}
        />
      )}
      {pendingImport && (
        <ImportConfirmationModal
          current={state}
          incoming={pendingImport}
          onClose={() => setPendingImport(null)}
          onConfirm={() => {
            onImport(pendingImport);
            setPendingImport(null);
          }}
        />
      )}
      {notebookOpen && (
        <AddCollectionModal
          description="Crie uma área macro de conhecimento. Depois você poderá adicionar matérias dentro dela."
          nameLabel="Nome do caderno"
          namePlaceholder="Ex: Direito, Medicina, Idiomas..."
          title="Novo caderno"
          onClose={() => setNotebookOpen(false)}
          onSubmit={({ name, description, color }) => {
            const notebook: Notebook = {
              id: `nb-${Date.now()}`,
              name,
              description,
              color,
            };
            onAddNotebook(notebook);
            setExpandedNotebooks((current) => [...current, notebook.id]);
            setNotebookOpen(false);
          }}
        />
      )}
      {subjectOpen && (
        <AddCollectionModal
          description="Vincule uma matéria a um caderno para organizar as questões relacionadas."
          nameLabel="Nome da matéria"
          namePlaceholder="Ex: Anatomia, Direito Civil, Inglês..."
          notebooks={state.notebooks}
          title="Nova matéria"
          onClose={() => setSubjectOpen(false)}
          onSubmit={({ name, description, color, notebookId }) => {
            if (!notebookId) return;
            const subject: Subject = {
              id: `sub-${Date.now()}`,
              notebookId,
              name,
              description,
              color,
            };
            onAddSubject(subject);
            setExpandedNotebooks((current) =>
              current.includes(notebookId) ? current : [...current, notebookId],
            );
            setExpandedSubjects((current) => [...current, subject.id]);
            setSubjectOpen(false);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmationModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDelete(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
      {showOnboarding && <LibraryOnboardingModal onFinish={onFinishOnboarding} />}
    </div>
  );
}

function NotebookTree({
  notebook,
  subjects,
  questions,
  progress,
  expanded,
  expandedSubjects,
  onToggle,
  onSubjectToggle,
  onDelete,
}: {
  notebook: Notebook;
  subjects: Subject[];
  questions: Question[];
  progress: AppState["progress"];
  expanded: boolean;
  expandedSubjects: string[];
  onToggle: () => void;
  onSubjectToggle: (id: string) => void;
  onDelete: (target: DeleteTarget) => void;
}) {
  const notebookSubjects = subjects.filter((subject) => subject.notebookId === notebook.id);
  const count = questions.filter((question) =>
    notebookSubjects.some((subject) => subject.id === question.subjectId),
  ).length;
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#edf0f4]">
      <button
        className="flex w-full items-center gap-2 bg-[#fafafa] py-3 pl-2 pr-10 text-left sm:gap-3 sm:pl-3 sm:pr-12"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white"
          style={{ backgroundColor: notebook.color }}
        >
          <FolderOpen size={16} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-[#3d485d]">{notebook.name}</span>
        <span className="shrink-0 text-[10px] font-bold text-[#a1a9b7]">{count} questões</span>
      </button>
      <div className="absolute right-1 top-2">
        <DeleteButton
          label={`Excluir caderno ${notebook.name}`}
          onClick={() =>
            onDelete({
              type: "notebook",
              id: notebook.id,
              name: notebook.name,
              subjectCount: notebookSubjects.length,
              questionCount: count,
            })
          }
        />
      </div>
      {expanded && (
        <div className="border-t border-[#edf0f4] bg-white px-2 py-2 sm:px-3">
          {!notebookSubjects.length && (
            <p className="px-3 py-3 text-[11px] font-semibold text-[#9aa3b1]">
              Este caderno ainda não possui matérias. Use “Nova matéria” para continuar.
            </p>
          )}
          {notebookSubjects.map((subject) => {
            const subjectQuestions = questions.filter((question) => question.subjectId === subject.id);
            const subjectExpanded = expandedSubjects.includes(subject.id);
            return (
              <div key={subject.id} className="relative ml-1 border-l border-[#eceef3] pl-2 sm:ml-3 sm:pl-3">
                <button
                  className="flex w-full items-center gap-2 py-2 pr-8 text-left"
                  onClick={() => onSubjectToggle(subject.id)}
                >
                  {subjectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <BookOpen size={15} style={{ color: subject.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#596477]">{subject.name}</span>
                  <span className="shrink-0 text-[10px] font-bold text-[#a8afbb]">{subjectQuestions.length}</span>
                </button>
                <div className="absolute right-0 top-1">
                  <DeleteButton
                    label={`Excluir matéria ${subject.name}`}
                    onClick={() =>
                      onDelete({
                        type: "subject",
                        id: subject.id,
                        name: subject.name,
                        questionCount: subjectQuestions.length,
                      })
                    }
                  />
                </div>
                {subjectExpanded && (
                  <div className="mb-2 ml-1 space-y-2 sm:ml-5">
                    {subjectQuestions.map((question) => (
                      <QuestionListItem
                        key={question.id}
                        progress={progress[question.id]}
                        question={question}
                        onDelete={() =>
                          onDelete({ type: "question", id: question.id, name: question.prompt })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuestionListItem({
  question,
  progress,
  onDelete,
}: {
  question: Question;
  progress: Progress;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#eef0f4] bg-white px-3 py-2.5">
      <CircleHelp size={15} className="mt-0.5 shrink-0 text-[#1cb0f6]" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] font-bold leading-5 text-[#657084]">{question.prompt}</p>
        <p className="mt-1 text-[9px] font-extrabold text-[#a2aab7]">{relativeReview(progress.nextReview)}</p>
      </div>
      <DeleteButton label="Excluir questão" onClick={onDelete} />
    </div>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#b4bbc5] transition hover:bg-[#fff0f0] hover:text-[#ff4b4b]"
      title={label}
      type="button"
      onClick={onClick}
    >
      <Trash2 size={14} />
    </button>
  );
}

const onboardingSteps = [
  {
    target: "notebook",
    icon: <FolderOpen size={22} />,
    title: "Comece criando um caderno",
    description:
      "Clique no botão destacado para criar sua primeira área de organização. Use um caderno para separar grandes temas, como História, Direito ou Idiomas. Depois informe um nome e escolha uma cor para identificá-lo rapidamente.",
    hint: "Clique em “Novo caderno” no topo da Biblioteca.",
  },
  {
    target: "subject",
    icon: <BookOpen size={22} />,
    title: "Adicione uma matéria",
    description:
      "Depois de criar o caderno, clique no botão destacado para adicionar uma matéria. Escolha em qual caderno ela ficará e use matérias para agrupar assuntos relacionados, como Brasil Colônia ou Gramática.",
    hint: "Clique em “Nova matéria” e selecione o caderno desejado.",
  },
  {
    target: "question",
    icon: <CircleHelp size={22} />,
    title: "Cadastre suas questões",
    description:
      "Por fim, clique no botão destacado para cadastrar uma questão. Selecione a matéria, escreva o enunciado, preencha as alternativas e marque qual resposta é a correta. A questão entrará na sua fila de estudos.",
    hint: "Clique em “Nova questão” para alimentar sua revisão.",
  },
];

function LibraryOnboardingModal({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const current = onboardingSteps[step];
  const lastStep = step === onboardingSteps.length - 1;
  useEffect(() => {
    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour-target="${current.target}"]`,
      );
      target?.scrollIntoView({ block: "center", inline: "center" });
      setTargetRect(target?.getBoundingClientRect() ?? null);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    const timer = window.setTimeout(updateTarget, 0);
    window.addEventListener("resize", updateTarget);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
    };
  }, [current.target]);
  const padding = 8;
  const x = Math.max(0, (targetRect?.x ?? 0) - padding);
  const y = Math.max(0, (targetRect?.y ?? 0) - padding);
  const width = (targetRect?.width ?? 0) + padding * 2;
  const height = (targetRect?.height ?? 0) + padding * 2;
  const cardBelow = !targetRect || targetRect.bottom + 360 < viewport.height;
  const cardStyle: CSSProperties = targetRect
    ? {
        left: Math.min(Math.max(16, targetRect.left), Math.max(16, viewport.width - 432)),
        top: cardBelow ? targetRect.bottom + 20 : Math.max(16, targetRect.top - 330),
      }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={width} height={height} rx="14" fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#163000"
          fillOpacity="0.62"
          mask="url(#tour-spotlight-mask)"
        />
        {targetRect && (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx="14"
            fill="none"
            stroke="#d7ffb8"
            strokeWidth="4"
          />
        )}
      </svg>
      <div
        aria-labelledby="library-onboarding-title"
        aria-modal="true"
        className="pointer-events-auto absolute w-[min(400px,calc(100vw-32px))] rounded-[22px] bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#58a700]">
            Primeiros passos
          </p>
          <button
            className="text-[11px] font-extrabold text-[#929baa] transition hover:text-[#697487]"
            type="button"
            onClick={onFinish}
          >
            Pular tour
          </button>
        </div>
        <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ffb8] text-[#58a700]">
          {current.icon}
        </div>
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[1.4px] text-[#a0a8b5]">
          Etapa {step + 1} de {onboardingSteps.length}
        </p>
        <h2 id="library-onboarding-title" className="mt-2 text-xl font-extrabold text-[#303a4f]">
          {current.title}
        </h2>
        <p className="mt-3 text-[12px] font-semibold leading-6 text-[#7c8695]">
          {current.description}
        </p>
        <p className="mt-4 rounded-xl border border-[#d8edce] bg-[#f4fbef] px-3 py-3 text-[11px] font-extrabold leading-5 text-[#477c2a]">
          {current.hint}
        </p>
        <div className="mt-5 flex gap-1.5">
          {onboardingSteps.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[#58cc02]" : "bg-[#e5e8ef]"}`}
            />
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {step > 0 && (
            <button
              className="rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294]"
              type="button"
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              Voltar
            </button>
          )}
          <button
            className="rounded-xl bg-[#58cc02] px-4 py-2.5 text-[11px] font-extrabold text-white"
            type="button"
            onClick={() => {
              if (lastStep) onFinish();
              else setStep((currentStep) => currentStep + 1);
            }}
          >
            {lastStep ? "Começar a usar" : "Próximo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const importExampleJson = `{
  "format": "brainsrs-content-v1",
  "notebooks": [
    {
      "id": "nb-historia",
      "name": "História",
      "description": "Caderno de História",
      "color": "#ffc800"
    }
  ],
  "subjects": [
    {
      "id": "sub-brasil",
      "notebookId": "nb-historia",
      "name": "História do Brasil",
      "description": "Brasil colonial e republicano",
      "color": "#ff9600"
    }
  ],
  "questions": [
    {
      "id": "q-capitanias",
      "subjectId": "sub-brasil",
      "prompt": "Qual era o objetivo das Capitanias Hereditárias?",
      "hint": "Pense em ocupação e defesa do território.",
      "alternatives": [
        {
          "id": "q-capitanias-a",
          "label": "A",
          "text": "Distribuir terras a donatários para ocupar e defender o território",
          "rationale": "Essa era a função central do sistema de capitanias.",
          "isCorrect": true
        },
        {
          "id": "q-capitanias-b",
          "label": "B",
          "text": "Abolir o trabalho escravizado",
          "rationale": "A abolição ocorreu apenas no século XIX.",
          "isCorrect": false
        },
        {
          "id": "q-capitanias-c",
          "label": "C",
          "text": "Criar uma república independente",
          "rationale": "O Brasil ainda era colônia portuguesa.",
          "isCorrect": false
        },
        {
          "id": "q-capitanias-d",
          "label": "D",
          "text": "Transferir a capital para o Rio de Janeiro",
          "rationale": "Isso ocorreu em outro contexto histórico.",
          "isCorrect": false
        }
      ]
    }
  ]
}`;

function ImportFormatModal({
  onClose,
  onChooseFile,
  onPasteJson,
}: {
  onClose: () => void;
  onChooseFile: () => void;
  onPasteJson: (rawJson: string) => boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pastedJson, setPastedJson] = useState("");

  const copyExampleJson = async () => {
    try {
      await navigator.clipboard.writeText(importExampleJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const importPastedJson = () => {
    if (!pastedJson.trim()) {
      window.alert("Cole um JSON antes de importar.");
      return;
    }
    onPasteJson(pastedJson);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2f5f00]/45 p-3 sm:p-4">
      <div
        aria-labelledby="import-format-title"
        aria-modal="true"
        className="animate-feedback-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-y-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#58a700]">
              Formato de importação
            </p>
            <h2 id="import-format-title" className="mt-1 text-lg font-extrabold text-[#303a4f]">
              Como montar o arquivo JSON
            </h2>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#929baa]">
              O arquivo precisa ter cadernos, matérias e questões. Cada questão deve apontar para
              uma matéria e possuir exatamente uma alternativa correta.
            </p>
          </div>
          <button
            aria-label="Fechar formato de importação"
            className="rounded-lg p-1.5 text-[#929baa] hover:bg-[#f2f3f7]"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <FormatRule title="1. Caderno" text="Crie um item em notebooks com id, nome, descrição e cor." />
          <FormatRule title="2. Matéria" text="Crie um item em subjects usando notebookId para ligar ao caderno." />
          <FormatRule title="3. Questão" text="Crie questions usando subjectId e marque apenas uma alternativa como correta." />
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e5e8ef] bg-[#202938]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[1.2px] text-[#a8f08a]">
              exemplo.json
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#9aa7bd]">JSON válido</span>
              <button
                aria-label="Copiar JSON de exemplo"
                className="inline-flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#c7d2e4] transition hover:border-[#a8f08a]/45 hover:bg-[#a8f08a]/10 hover:text-[#a8f08a]"
                title="Copiar exemplo"
                type="button"
                onClick={() => void copyExampleJson()}
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <pre className="max-h-[42vh] overflow-auto p-4 text-[11px] leading-5 text-[#eef4ff]">
            <code>{importExampleJson}</code>
          </pre>
        </div>
        <div className="mt-5 rounded-2xl border border-[#e5e8ef] bg-[#fafafa] p-3">
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-[#344055]">Colar JSON</p>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[#8b94a3]">
                Cole aqui o conteúdo completo do arquivo para importar sem fazer upload.
              </p>
            </div>
            <button
              className="w-full shrink-0 rounded-xl bg-[#58cc02] px-3 py-2 text-[10px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#c7d2e4] min-[420px]:w-auto"
              disabled={!pastedJson.trim()}
              type="button"
              onClick={importPastedJson}
            >
              Importar JSON
            </button>
          </div>
          <textarea
            className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[#e1e6ef] bg-white p-3 font-mono text-[11px] leading-5 text-[#303a4f] outline-none transition placeholder:text-[#a8b0bd] focus:border-[#84d8ff]"
            placeholder='Cole aqui o JSON, começando por { "format": "brainsrs-content-v1", ... }'
            value={pastedJson}
            onChange={(event) => setPastedJson(event.target.value)}
          />
        </div>
        <div className="mt-5 rounded-xl bg-[#fff7e7] px-3 py-3 text-[11px] font-bold leading-5 text-[#9a630f]">
          Importar adiciona novos cadernos, matérias e questões à biblioteca atual. Depois de
          escolher o arquivo, você verá uma confirmação final antes de aplicar a mudança.
        </div>
        <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#58cc02] px-4 py-2.5 text-[11px] font-extrabold text-white sm:w-auto"
            type="button"
            onClick={onChooseFile}
          >
            <ImportIcon size={15} /> Escolher arquivo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FormatRule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[#e5e8ef] bg-[#fafafa] p-3">
      <p className="text-[11px] font-extrabold text-[#344055]">{title}</p>
      <p className="mt-1 text-[10px] font-semibold leading-5 text-[#8b94a3]">{text}</p>
    </div>
  );
}

function ImportConfirmationModal({
  current,
  incoming,
  onClose,
  onConfirm,
}: {
  current: AppState;
  incoming: ContentImport;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#301616]/55 p-3 sm:p-4">
      <div
        aria-labelledby="import-confirmation-title"
        aria-modal="true"
        className="animate-feedback-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f0] text-[#ff4b4b]">
          <AlertTriangle size={23} />
        </div>
        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#ff4b4b]">
          Atenção: nova importação
        </p>
        <h2 id="import-confirmation-title" className="mt-1 text-lg font-extrabold text-[#303a4f]">
          Adicionar conteúdo importado?
        </h2>
        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#7c8695]">
          A importação manterá sua biblioteca atual e adicionará novos cadernos, matérias e questões. O progresso e o histórico existentes serão preservados.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 text-center min-[420px]:grid-cols-2">
          <div className="rounded-xl bg-[#fff8f8] px-3 py-3">
            <p className="text-[10px] font-extrabold uppercase text-[#a34b4b]">Biblioteca atual</p>
            <p className="mt-1 text-[12px] font-bold text-[#7c4b4b]">
              {current.notebooks.length} caderno(s) · {current.questions.length} questão(ões)
            </p>
          </div>
          <div className="rounded-xl bg-[#f4fbef] px-3 py-3">
            <p className="text-[10px] font-extrabold uppercase text-[#58a700]">Novo arquivo</p>
            <p className="mt-1 text-[12px] font-bold text-[#477c2a]">
              {incoming.notebooks.length} caderno(s) · {incoming.questions.length} questão(ões)
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] font-bold text-[#687386]">
          As questões importadas começarão com progresso zerado. Deseja continuar?
        </p>
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff4b4b] px-4 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#e73f3f] sm:w-auto"
            type="button"
            onClick={onConfirm}
          >
            <Upload size={14} /> Sim, importar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExportContentModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [selectedNotebookIds, setSelectedNotebookIds] = useState(
    () => new Set(state.notebooks.map((notebook) => notebook.id)),
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(
    () => new Set(state.subjects.map((subject) => subject.id)),
  );
  const selectedSubjects = state.subjects.filter(
    (subject) =>
      selectedNotebookIds.has(subject.notebookId) || selectedSubjectIds.has(subject.id),
  );
  const includedNotebookIds = new Set([
    ...selectedNotebookIds,
    ...selectedSubjects.map((subject) => subject.notebookId),
  ]);
  const selectedNotebooks = state.notebooks.filter((notebook) =>
    includedNotebookIds.has(notebook.id),
  );
  const selectedSubjectIdSet = new Set(selectedSubjects.map((subject) => subject.id));
  const selectedQuestions = state.questions.filter((question) =>
    selectedSubjectIdSet.has(question.subjectId),
  );

  const toggleNotebook = (notebookId: string) => {
    const subjectIds = state.subjects
      .filter((subject) => subject.notebookId === notebookId)
      .map((subject) => subject.id);
    const notebookSelected =
      selectedNotebookIds.has(notebookId) ||
      (subjectIds.length > 0 && subjectIds.every((subjectId) => selectedSubjectIds.has(subjectId)));
    setSelectedNotebookIds((current) => {
      const next = new Set(current);
      if (notebookSelected) next.delete(notebookId);
      else next.add(notebookId);
      return next;
    });
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      subjectIds.forEach((subjectId) => {
        if (notebookSelected) next.delete(subjectId);
        else next.add(subjectId);
      });
      return next;
    });
  };

  const toggleSubject = (subject: Subject) => {
    setSelectedNotebookIds((current) => {
      const next = new Set(current);
      next.delete(subject.notebookId);
      return next;
    });
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subject.id)) next.delete(subject.id);
      else next.add(subject.id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedNotebookIds(new Set(state.notebooks.map((notebook) => notebook.id)));
    setSelectedSubjectIds(new Set(state.subjects.map((subject) => subject.id)));
  };

  const clearSelection = () => {
    setSelectedNotebookIds(new Set());
    setSelectedSubjectIds(new Set());
  };

  const exportContent = () => {
    if (!selectedNotebooks.length) return;
    const raw = JSON.stringify(
      {
        format: "brainsrs-content-v1",
        exportedAt: new Date().toISOString(),
        notebooks: selectedNotebooks,
        subjects: selectedSubjects,
        questions: selectedQuestions,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brainsrs-conteudo-selecionado.json";
    anchor.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2f5f00]/45 p-3 sm:p-4">
      <div
        aria-labelledby="export-content-title"
        aria-modal="true"
        className="animate-feedback-in flex max-h-[92vh] w-full max-w-xl flex-col rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#58a700]">
              Compartilhar conteúdo
            </p>
            <h2 id="export-content-title" className="mt-1 text-lg font-extrabold text-[#303a4f]">
              Exportar cadernos e matérias
            </h2>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#929baa]">
              Escolha o conteúdo que deseja compartilhar. O progresso e o histórico de revisões não serão exportados.
            </p>
          </div>
          <button
            aria-label="Fechar exportação"
            className="rounded-lg p-1.5 text-[#929baa] hover:bg-[#f2f3f7]"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <p className="text-[11px] font-extrabold text-[#697487]">Conteúdo disponível</p>
          <div className="flex gap-3">
            <button className="text-[10px] font-extrabold text-[#58a700]" type="button" onClick={selectAll}>
              Selecionar tudo
            </button>
            <button className="text-[10px] font-extrabold text-[#ff4b4b]" type="button" onClick={clearSelection}>
              Limpar
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2 overflow-auto pr-1">
          {state.notebooks.map((notebook) => {
            const notebookSubjects = state.subjects.filter(
              (subject) => subject.notebookId === notebook.id,
            );
            const notebookChecked =
              selectedNotebookIds.has(notebook.id) ||
              (notebookSubjects.length > 0 &&
                notebookSubjects.every((subject) => selectedSubjectIds.has(subject.id)));
            return (
              <div key={notebook.id} className="rounded-xl border border-[#edf0f4] bg-[#fafafa] p-3">
                <label className="flex cursor-pointer items-center gap-2 sm:gap-3">
                  <input
                    checked={notebookChecked}
                    className="h-4 w-4 accent-[#58cc02]"
                    type="checkbox"
                    onChange={() => toggleNotebook(notebook.id)}
                  />
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white"
                    style={{ backgroundColor: notebook.color }}
                  >
                    <FolderOpen size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-[#3d485d]">{notebook.name}</span>
                  <span className="shrink-0 text-[10px] font-bold text-[#a1a9b7]">
                    {notebookSubjects.length} matéria(s)
                  </span>
                </label>
                {notebookSubjects.length > 0 && (
                  <div className="mt-3 space-y-1 border-l border-[#dfe3e9] pl-2 sm:pl-4">
                    {notebookSubjects.map((subject) => (
                      <label key={subject.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white">
                        <input
                          checked={
                            selectedNotebookIds.has(notebook.id) || selectedSubjectIds.has(subject.id)
                          }
                          className="h-3.5 w-3.5 accent-[#58cc02]"
                          type="checkbox"
                          onChange={() => toggleSubject(subject)}
                        />
                        <BookOpen size={15} style={{ color: subject.color }} />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#596477]">{subject.name}</span>
                        <span className="shrink-0 text-[10px] font-bold text-[#a8afbb]">
                          {state.questions.filter((question) => question.subjectId === subject.id).length} questão(ões)
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-xl bg-[#eef9ff] px-3 py-3 text-[10px] font-bold leading-5 text-[#357897]">
          Selecionado: {selectedNotebooks.length} caderno(s), {selectedSubjects.length} matéria(s) e {selectedQuestions.length} questão(ões).
        </div>
        <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#58cc02] px-4 py-2.5 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={!selectedNotebooks.length}
            type="button"
            onClick={exportContent}
          >
            <Download size={15} /> Exportar selecionados
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DeleteConfirmationModal({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const details =
    target.type === "notebook"
      ? `Este caderno contém ${target.subjectCount} matéria(s) e ${target.questionCount} questão(ões). Todas elas, junto com o progresso, cooldowns e histórico de revisões relacionados, serão excluídas permanentemente.`
      : target.type === "subject"
        ? `Esta matéria contém ${target.questionCount} questão(ões). As questões, o progresso, cooldowns e histórico de revisões relacionados serão excluídos permanentemente.`
        : "O progresso, cooldowns e histórico de revisões desta questão serão excluídos permanentemente.";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#301616]/55 p-3 sm:p-4">
      <div
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="animate-feedback-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f0] text-[#ff4b4b]">
          <AlertTriangle size={23} />
        </div>
        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#ff4b4b]">
          Atenção: ação irreversível
        </p>
        <h2 id="delete-confirmation-title" className="mt-1 text-lg font-extrabold text-[#303a4f]">
          Excluir {target.type === "notebook" ? "caderno" : target.type === "subject" ? "matéria" : "questão"}?
        </h2>
        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#7c8695]">
          Você está prestes a excluir <strong className="text-[#4b5565]">{target.name}</strong>.
        </p>
        <div className="mt-4 rounded-xl border border-[#ffd1d1] bg-[#fff8f8] p-3 text-[11px] font-semibold leading-5 text-[#a34b4b]">
          {details}
        </div>
        <p className="mt-4 text-[11px] font-bold text-[#687386]">
          Tem certeza de que deseja continuar?
        </p>
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff4b4b] px-4 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#e73f3f] sm:w-auto"
            type="button"
            onClick={onConfirm}
          >
            <Trash2 size={14} /> Sim, excluir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LibraryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#fafafa] px-2 py-3 text-center">
      <p className="text-lg font-extrabold text-[#58a700]">{value}</p>
      <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.7px] text-[#9ca5b2]">{label}</p>
    </div>
  );
}

const collectionColors = ["#1cb0f6", "#58cc02", "#ffc800", "#ff9600", "#1cb0f6", "#ff4b4b"];

function AddCollectionModal({
  title,
  description,
  nameLabel,
  namePlaceholder,
  notebooks,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  notebooks?: Notebook[];
  onClose: () => void;
  onSubmit: (collection: {
    name: string;
    description: string;
    color: string;
    notebookId?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [color, setColor] = useState(collectionColors[0]);
  const [notebookId, setNotebookId] = useState(notebooks?.[0]?.id ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (notebooks && !notebookId)) return;
    onSubmit({
      name: name.trim(),
      description: details.trim(),
      color,
      notebookId,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2f5f00]/45 p-3 sm:p-4">
      <form
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#58a700]">
              Biblioteca
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-[#303a4f]">{title}</h2>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#929baa]">
              {description}
            </p>
          </div>
          <button
            aria-label="Fechar formulário"
            className="rounded-lg p-1.5 text-[#929baa] hover:bg-[#f2f3f7]"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {notebooks && (
          <div className="mt-5 text-[11px] font-extrabold text-[#697487]">
            Caderno
            <StyledSelect
              value={notebookId}
              options={notebooks.map((notebook) => ({
                value: notebook.id,
                label: notebook.name,
              }))}
              onChange={setNotebookId}
            />
          </div>
        )}
        <label className="mt-5 block text-[11px] font-extrabold text-[#697487]">
          {nameLabel}
          <input
            autoFocus
            className="mt-2 w-full rounded-xl border border-[#e5e8ef] px-3 py-2.5 text-[12px] outline-none focus:border-[#84d8ff]"
            placeholder={namePlaceholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-[11px] font-extrabold text-[#697487]">
          Descrição opcional
          <textarea
            className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#e5e8ef] px-3 py-2.5 text-[12px] outline-none focus:border-[#84d8ff]"
            placeholder="Descreva brevemente o conteúdo..."
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        <div className="mt-4">
          <p className="text-[11px] font-extrabold text-[#697487]">Cor de identificação</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {collectionColors.map((item, index) => (
              <button
                aria-label={`Selecionar cor ${item}`}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition ${
                  color === item ? "ring-2 ring-[#58a700] ring-offset-2" : ""
                }`}
                key={`${item}-${index}`}
                style={{ backgroundColor: item }}
                type="button"
                onClick={() => setColor(item)}
              >
                {color === item && <CheckCircle2 size={16} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="w-full rounded-xl bg-[#58cc02] px-4 py-2.5 text-[11px] font-extrabold text-white sm:w-auto"
            type="submit"
          >
            Criar
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function AddQuestionModal({
  subjects,
  onClose,
  onSubmit,
}: {
  subjects: Subject[];
  onClose: () => void;
  onSubmit: (question: Question) => void;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [hint, setHint] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [alternatives, setAlternatives] = useState(["", "", "", ""]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt || alternatives.some((alternative) => !alternative)) return;
    const id = `q-${Date.now()}`;
    onSubmit({
      id,
      subjectId,
      prompt,
      hint,
      alternatives: alternatives.map((text, index) => ({
        id: `${id}-${index}`,
        label: ["A", "B", "C", "D"][index],
        text,
        rationale:
          index === correctIndex
            ? "Esta é a alternativa definida como correta."
            : "Esta alternativa não atende ao critério central da questão.",
        isCorrect: index === correctIndex,
      })),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2f5f00]/45 p-3 sm:p-4">
      <form
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6"
        onSubmit={submit}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#58a700]">Biblioteca</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#303a4f]">Nova questão</h2>
          </div>
          <button
            aria-label="Fechar formulário"
            className="rounded-lg p-1.5 text-[#929baa] hover:bg-[#f2f3f7]"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-5 text-[11px] font-extrabold text-[#697487]">
          Matéria
          <StyledSelect
            value={subjectId}
            options={subjects.map((subject) => ({
              value: subject.id,
              label: subject.name,
            }))}
            onChange={setSubjectId}
          />
        </div>
        <label className="mt-4 block text-[11px] font-extrabold text-[#697487]">
          Enunciado
          <textarea
            className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#e5e8ef] px-3 py-2.5 text-[12px] outline-none focus:border-[#84d8ff]"
            placeholder="Digite a pergunta..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-[11px] font-extrabold text-[#697487]">
          Dica opcional
          <input
            className="mt-2 w-full rounded-xl border border-[#e5e8ef] px-3 py-2.5 text-[12px] outline-none focus:border-[#84d8ff]"
            placeholder="Ajude sem entregar o gabarito..."
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
        </label>
        <div className="mt-4">
          <p className="text-[11px] font-extrabold text-[#697487]">Alternativas</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {alternatives.map((alternative, index) => (
              <label
                key={index}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                  correctIndex === index ? "border-[#84d8ff] bg-[#f2fbff]" : "border-[#e7e9ef]"
                }`}
              >
                <input
                  checked={correctIndex === index}
                  name="correct"
                  type="radio"
                  onChange={() => setCorrectIndex(index)}
                />
                <span className="text-[11px] font-extrabold text-[#1cb0f6]">{["A", "B", "C", "D"][index]}</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold outline-none"
                  placeholder={`Alternativa ${index + 1}`}
                  value={alternative}
                  onChange={(event) =>
                    setAlternatives((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                    )
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="w-full rounded-xl border border-[#e5e8ef] px-4 py-2.5 text-[11px] font-extrabold text-[#788294] sm:w-auto"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="w-full rounded-xl bg-[#58cc02] px-4 py-2.5 text-[11px] font-extrabold text-white sm:w-auto"
            type="submit"
          >
            Adicionar questão
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function StatsPage({ state }: { state: AppState }) {
  const totalReviews = state.logs.length;
  const correct = state.logs.filter((log) => log.correct).length;
  const retention = totalReviews ? Math.round((correct / totalReviews) * 100) : 0;
  const avgTime = totalReviews
    ? Math.round(state.logs.reduce((total, log) => total + log.responseTimeSeconds, 0) / totalReviews)
    : 0;
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const activityByDay = state.logs.reduce<Record<string, number>>((activity, log) => {
    const day = localDay(new Date(log.answeredAt));
    activity[day] = (activity[day] ?? 0) + 1;
    return activity;
  }, {});
  const activityDates = Object.keys(activityByDay);
  const today = new Date();
  const currentMonday = new Date(today);
  const weekDay = currentMonday.getDay();
  currentMonday.setDate(currentMonday.getDate() - (weekDay === 0 ? 6 : weekDay - 1));
  currentMonday.setHours(12, 0, 0, 0);
  const firstMonday = new Date(currentMonday);
  firstMonday.setDate(firstMonday.getDate() - 21);
  const heat = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(firstMonday);
    date.setDate(date.getDate() + index);
    const dateKey = localDay(date);
    return { date, dateKey, count: activityByDay[dateKey] ?? 0 };
  });
  const maxActivity = Math.max(0, ...heat.map((item) => item.count));
  const heatColors = ["#f0f1f5", "#e9f8dd", "#d7ffb8", "#a5ed6e", "#7dd438", "#58a700"];
  const getHeatLevel = (count: number) =>
    count && maxActivity ? Math.max(1, Math.ceil((count / maxActivity) * 5)) : 0;
  const longestStreak = calculateLongestStreak(activityDates);
  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Desempenho"
        title="Estatísticas de retenção"
        description="Acompanhe a evolução da memória e identifique onde seu esforço gera mais resultado."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard delay={0} icon={<Activity size={20} />} iconClass="bg-[#d7ffb8] text-[#58cc02]" title="Revisões totais" value={String(totalReviews)} detail="Histórico consolidado" />
        <MetricCard delay={55} icon={<Target size={20} />} iconClass="bg-[#e9f9f1] text-[#58a700]" title="Retenção global" value={`${retention}%`} detail="Acertos em todas as respostas" />
        <MetricCard delay={110} icon={<Clock3 size={20} />} iconClass="bg-[#eaf4ff] text-[#1cb0f6]" title="Tempo por questão" value={`${avgTime}s`} detail="Média de resposta" />
        <MetricCard delay={165} icon={<Flame size={20} />} iconClass="bg-[#fff2de] text-[#ff9600]" title="Ofensiva" value={formatDays(calculateStreak(activityDates))} detail="Dias consecutivos com atividade" />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <AnimatedCard delay={220} className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-extrabold text-[#354055]">Retenção por matéria</h2>
          <p className="mt-1 text-[11px] font-semibold text-[#99a2b0]">Acertos versus erros em todas as respostas registradas</p>
          <div className="mt-5 space-y-4">
            {state.subjects.map((subject) => {
              const value = getSubjectRetention(state, subject.id);
              const logCount = state.logs.filter((log) => log.subjectId === subject.id).length;
              return (
                <div key={subject.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold text-[#596477]">{subject.name}</span>
                    <span className="text-[11px] font-extrabold text-[#7e8898]">{value}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf0f4]">
                      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: subject.color }} />
                    </div>
                    <span className="w-20 text-right text-[10px] font-bold text-[#a0a8b6]">{logCount} revisões</span>
                  </div>
                </div>
              );
            })}
          </div>
        </AnimatedCard>
        <AnimatedCard delay={275} className="rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-extrabold text-[#354055]">Consistência</h2>
          <p className="mt-1 text-[11px] font-semibold text-[#99a2b0]">Atividade nas últimas 4 semanas</p>
          <div className="mt-5 flex gap-2">
            <div className="grid grid-rows-7 gap-1.5 pt-0.5">
              {days.map((day) => <span key={day} className="h-4 text-[9px] font-bold text-[#a0a8b5]">{day}</span>)}
            </div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1.5">
              {heat.map((item) => (
                <div
                  key={item.dateKey}
                  aria-label={`${item.date.toLocaleDateString("pt-BR")}: ${item.count} ${
                    item.count === 1 ? "revisão" : "revisões"
                  }`}
                  className="h-4 rounded-[4px]"
                  style={{
                    backgroundColor: heatColors[getHeatLevel(item.count)],
                  }}
                  title={`${item.date.toLocaleDateString("pt-BR")}: ${item.count} ${
                    item.count === 1 ? "revisão" : "revisões"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-1.5 text-[9px] font-bold text-[#a0a8b5]">
            <span>Menos</span>
            {heatColors.map((color) => (
              <span key={color} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} />
            ))}
            <span>Mais</span>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-[#fafafa] px-3 py-3">
            <span className="text-[11px] font-extrabold text-[#737e8f]">Melhor sequência</span>
            <span className="text-[13px] font-extrabold text-[#58a700]">
              {longestStreak} {longestStreak === 1 ? "dia" : "dias"}
            </span>
          </div>
        </AnimatedCard>
      </section>
    </div>
  );
}

function VulnerabilitiesPage({ state, onStudy }: { state: AppState; onStudy: () => void }) {
  const vulnerabilities = state.questions.filter(
    (question) => (state.progress[question.id]?.mistakes ?? 0) >= 3,
  );

  const exportReport = () => {
    const report = vulnerabilities
      .map((question) => {
        const logs = state.logs.filter((log) => log.questionId === question.id && !log.correct);
        const wrongAnswers = logs
          .map((log) => question.alternatives.find((alternative) => alternative.id === log.selectedAlternativeId)?.text)
          .filter(Boolean)
          .join(", ");
        return `${question.prompt}\nErros: ${state.progress[question.id].mistakes}\nAlternativas escolhidas: ${wrongAnswers || "Sem histórico detalhado"}\n`;
      })
      .join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brainsrs-vulnerabilidades.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Caderno de erros inteligente"
        title="Vulnerabilidades"
        description="Questões com falhas recorrentes são agrupadas para revisão isolada e análise conceitual."
        actions={
          <>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-[11px] font-extrabold text-[#6f798b] sm:w-auto"
              onClick={exportReport}
            >
              <FileText size={15} /> Exportar relatório
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#58cc02] px-3 py-2.5 text-[11px] font-extrabold text-white sm:w-auto"
              onClick={onStudy}
            >
              <GraduationCap size={15} /> Estudar gargalos
            </button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard delay={0} icon={<ShieldAlert size={20} />} iconClass="bg-[#fff0f1] text-[#ff4b4b]" title="Questões críticas" value={String(vulnerabilities.length)} detail="Acima do limite de erros" />
        <MetricCard delay={55} icon={<RotateCcw size={20} />} iconClass="bg-[#fff2de] text-[#ff9600]" title="Falhas mapeadas" value={String(vulnerabilities.reduce((total, question) => total + state.progress[question.id].mistakes, 0))} detail="Histórico acumulado" />
        <MetricCard delay={110} icon={<Target size={20} />} iconClass="bg-[#d7ffb8] text-[#58cc02]" title="Foco sugerido" value={vulnerabilities.length ? "Questões críticas" : "Estável"} detail="Baseado no histórico de erros" />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {vulnerabilities.map((question) => {
            const subject = state.subjects.find((item) => item.id === question.subjectId);
            const progress = state.progress[question.id];
            return (
              <div key={question.id} className="rounded-[18px] border border-[#e5e5e5] bg-white p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f1] text-[#ff4b4b]">
                    <AlertTriangle size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#e9f8dd] px-2 py-1 text-[9px] font-extrabold text-[#1cb0f6]">{subject?.name}</span>
                      <span className="rounded-full bg-[#fff4e4] px-2 py-1 text-[9px] font-extrabold text-[#c87d17]">{progress.mistakes} erros</span>
                    </div>
                    <p className="mt-2 text-[12px] font-extrabold leading-5 text-[#4e596b]">{question.prompt}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <AnimatedCard delay={165} className="h-fit rounded-[20px] bg-[#1cb0f6] p-4 text-white shadow-[0_10px_22px_rgba(43,38,101,0.16)] sm:p-5">
          <div className="flex items-center gap-2 text-[13px] font-extrabold">
            <Sparkles size={18} className="text-[#ffc800]" /> Plano de contingência
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[#e8f7ff]">
            Revise primeiro as questões com mais erros e retorne aos conceitos associados em sessões curtas e isoladas.
          </p>
          <p className="mt-4 rounded-xl bg-white/[0.08] p-3 text-[11px] font-semibold leading-5 text-[#ffffff]">
            Use o relatório exportado para identificar padrões e selecione “Estudar gargalos” para iniciar uma sessão direcionada.
          </p>
        </AnimatedCard>
      </section>
    </div>
  );
}

function SettingsPage({
  settings,
  user,
  onSave,
}: {
  settings: SrsSettings;
  user: AuthUser;
  onSave: (settings: SrsSettings) => void;
}) {
  const [activeTab, setActiveTab] = useState<"review" | "account">("review");
  const [values, setValues] = useState(() => ({
    cooldownMinMinutes: String(settings.cooldownMinMinutes),
    cooldownMaxMinutes: String(settings.cooldownMaxMinutes),
    firstReviewDays: String(settings.firstReviewDays),
    reviewMultiplier: String(settings.reviewMultiplier),
  }));
  const parsedSettings: SrsSettings = {
    cooldownMinMinutes: Number(values.cooldownMinMinutes),
    cooldownMaxMinutes: Number(values.cooldownMaxMinutes),
    firstReviewDays: Number(values.firstReviewDays),
    reviewMultiplier: Number(values.reviewMultiplier),
  };
  const preview = Array.from({ length: 5 }, (_, index) =>
    parsedSettings.firstReviewDays * parsedSettings.reviewMultiplier ** index,
  );
  const update = (field: keyof SrsSettings, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(parsedSettings);
  };
  const formatPreviewDays = (days: number) =>
    Number.isFinite(days)
      ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(days)} ${
          days === 1 ? "dia" : "dias"
        }`
      : "—";

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Preferências do algoritmo"
        title="Configurações de revisão"
        description="Ajuste quando uma questão volta para a fila após erros e acertos. As alterações valem para as próximas respostas."
      />
      <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[#e5e5e5] bg-white p-1 sm:w-fit">
        <button
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-extrabold transition ${
            activeTab === "review" ? "bg-[#e9f8dd] text-[#58a700]" : "text-[#8490a0] hover:bg-[#fafafa]"
          }`}
          type="button"
          onClick={() => setActiveTab("review")}
        >
          <RotateCcw size={14} /> Revisão
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-extrabold transition ${
            activeTab === "account" ? "bg-[#e9f8dd] text-[#58a700]" : "text-[#8490a0] hover:bg-[#fafafa]"
          }`}
          type="button"
          onClick={() => setActiveTab("account")}
        >
          <UserRound size={14} /> Minha conta
        </button>
      </div>
      {activeTab === "review" ? (
      <form className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]" onSubmit={submit}>
        <section className="animate-card-in rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-[15px] font-extrabold text-[#354055]">Repetição espaçada</h2>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#99a2b0]">
              Defina o intervalo de retorno das questões sem precisar alterar o código.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SettingsField
              label="Cooldown mínimo após erro"
              description="Menor tempo para uma questão errada retornar."
              min="1"
              max="1440"
              step="1"
              suffix="min"
              value={values.cooldownMinMinutes}
              onChange={(value) => update("cooldownMinMinutes", value)}
            />
            <SettingsField
              label="Cooldown máximo após erro"
              description="Maior tempo possível para o retorno após erro."
              min="1"
              max="1440"
              step="1"
              suffix="min"
              value={values.cooldownMaxMinutes}
              onChange={(value) => update("cooldownMaxMinutes", value)}
            />
            <SettingsField
              label="Intervalo após primeiro acerto"
              description="Prazo inicial antes da próxima revisão normal."
              min="0.1"
              max="365"
              step="0.1"
              suffix="dias"
              value={values.firstReviewDays}
              onChange={(value) => update("firstReviewDays", value)}
            />
            <SettingsField
              label="Multiplicador dos próximos acertos"
              description="Expande progressivamente os intervalos seguintes."
              min="1"
              max="10"
              step="0.05"
              suffix="x"
              value={values.reviewMultiplier}
              onChange={(value) => update("reviewMultiplier", value)}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              className="w-full rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-5 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white transition hover:bg-[#61d808] active:translate-y-0.5 active:border-b-2 sm:w-auto"
              type="submit"
            >
              Salvar configurações
            </button>
          </div>
        </section>
        <aside className="animate-card-in h-fit rounded-[20px] border border-[#e5e5e5] bg-white p-4 [--card-delay:70ms] sm:p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d7ffb8] text-[#58a700]">
            <RotateCcw size={21} />
          </div>
          <h2 className="mt-4 text-[15px] font-extrabold text-[#354055]">Prévia dos intervalos</h2>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#99a2b0]">
            Estimativa após uma sequência de respostas corretas.
          </p>
          <div className="mt-4 space-y-2">
            {preview.map((days, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-xl bg-[#fafafa] px-3 py-2.5"
              >
                <span className="text-[11px] font-bold text-[#7b8594]">
                  {index + 1}º acerto
                </span>
                <span className="text-[12px] font-extrabold text-[#58a700]">
                  {formatPreviewDays(days)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-[#eef9ff] px-3 py-3 text-[10px] font-bold leading-5 text-[#357897]">
            O sistema ainda aplica uma pequena variação automática de aproximadamente 4% para evitar
            que todas as questões retornem ao mesmo tempo.
          </p>
        </aside>
      </form>
      ) : (
        <AccountSettings user={user} />
      )}
    </div>
  );
}

function AccountSettings({ user }: { user: AuthUser }) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();
  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <section className="animate-card-in rounded-[20px] border border-[#e5e5e5] bg-white p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d7ffb8] text-lg font-extrabold text-[#58a700]">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#58a700]">Perfil do estudante</p>
            <h2 className="mt-1 truncate text-lg font-extrabold text-[#354055]">{user.name}</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <AccountField icon={<UserRound size={16} />} label="Nome" value={user.name} />
          <AccountField icon={<Mail size={16} />} label="E-mail" value={user.email} />
          <AccountField
            icon={<ShieldAlert size={16} />}
            label="Plano atual"
            value={`Estudante ${user.plan === "pro" ? "Pro" : "Free"}`}
          />
          <AccountField icon={<LockKeyhole size={16} />} label="Senha" value="Protegida e armazenada com segurança" />
        </div>
      </section>
      <aside className="animate-card-in h-fit rounded-[20px] border border-[#e5e5e5] bg-white p-4 [--card-delay:70ms] sm:p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef9ff] text-[#1cb0f6]">
          <ShieldAlert size={21} />
        </div>
        <h2 className="mt-4 text-[15px] font-extrabold text-[#354055]">Conta protegida</h2>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#99a2b0]">
          Seus cadernos, questões, revisões e estatísticas são isolados dos demais usuários.
        </p>
        <div className="mt-4 rounded-xl bg-[#fafafa] px-3 py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[1px] text-[#a0a8b5]">Identificador da conta</p>
          <p className="mt-1 break-all text-[11px] font-bold text-[#687386]">{user.id}</p>
        </div>
        <p className="mt-4 rounded-xl bg-[#fff9ed] px-3 py-3 text-[10px] font-bold leading-5 text-[#a36b17]">
          A edição dos dados cadastrais será disponibilizada em uma próxima etapa.
        </p>
      </aside>
    </div>
  );
}

function AccountField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#eef0f4] bg-[#fafafa] p-3">
      <div className="flex items-center gap-2 text-[#58a700]">
        {icon}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#8993a2]">{label}</p>
      </div>
      <p className="mt-3 break-words text-[12px] font-extrabold leading-5 text-[#596477]">{value}</p>
    </div>
  );
}

function SettingsField({
  label,
  description,
  suffix,
  ...inputProps
}: {
  label: string;
  description: string;
  suffix: string;
  value: string;
  min: string;
  max: string;
  step: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-[#eef0f4] bg-[#fafafa] p-3">
      <span className="text-[11px] font-extrabold text-[#596477]">{label}</span>
      <span className="mt-1 block text-[10px] font-semibold leading-4 text-[#a0a8b5]">
        {description}
      </span>
      <span className="mt-3 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3">
        <input
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-extrabold text-[#4b4b4b] outline-none"
          type="number"
          {...inputProps}
          onChange={(event) => inputProps.onChange(event.target.value)}
        />
        <span className="text-[10px] font-extrabold uppercase text-[#97a0af]">{suffix}</span>
      </span>
    </label>
  );
}

function SimulationPage({
  state,
  initialSource,
  onExit,
  onFocusChange,
}: {
  state: AppState;
  initialSource: string;
  onExit: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const [source, setSource] = useState(() =>
    initialSource === "vulnerabilities" ||
    state.subjects.some((subject) => subject.id === initialSource)
      ? initialSource
      : state.subjects[0]?.id ?? "vulnerabilities",
  );
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [simulationRunSeed, setSimulationRunSeed] = useState("initial");

  const pool =
    source === "vulnerabilities"
      ? state.questions.filter((question) => state.progress[question.id]?.mistakes >= 3)
      : state.questions.filter((question) => question.subjectId === source);
  const activeQuestion = queue[index] ?? null;
  const displayedAlternatives = useMemo(
    () =>
      activeQuestion
        ? shuffleAlternatives(
            activeQuestion.alternatives,
            `${simulationRunSeed}:${activeQuestion.id}:${index}`,
          )
        : [],
    [activeQuestion, index, simulationRunSeed],
  );

  const start = () => {
    setQueue([...pool].sort(() => Math.random() - 0.5).slice(0, 20));
    setSimulationRunSeed(`${Date.now()}-${Math.random()}`);
    setIndex(0);
    setSelectedId(null);
    setHintOpen(false);
    setCorrect(0);
    onFocusChange(true);
  };

  if (!queue.length) {
    return (
      <div className="mx-auto flex min-h-[68vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[24px] border-2 border-b-4 border-[#e5e5e5] bg-white p-5 sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d7ffb8] text-[#58a700]">
            <GraduationCap size={27} />
          </div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[1.7px] text-[#58a700]">
            Prática sem impacto no SRS
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-[#3c3c3c]">
            Configure seu simulado rápido
          </h1>
          <p className="mt-2 text-[12px] font-semibold leading-6 text-[#777]">
            Escolha uma matéria ou use os gargalos identificados pelo caderno de erros.
          </p>
          <div className="mt-6 text-[11px] font-extrabold text-[#697487]">
            Conteúdo da sessão
            <StyledSelect
              value={source}
              options={[
                { value: "vulnerabilities", label: "Gargalos de retenção" },
                ...state.subjects.map((subject) => ({
                  value: subject.id,
                  label: subject.name,
                })),
              ]}
              onChange={setSource}
            />
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
            <div>
              <p className="text-[11px] font-extrabold text-[#667184]">Questões disponíveis</p>
              <p className="mt-1 text-[10px] font-bold text-[#a0a8b5]">
                Até 20 questões entram na sessão
              </p>
            </div>
            <span className="text-xl font-extrabold text-[#58a700]">{pool.length}</span>
          </div>
          <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row">
            <button
              className="w-full rounded-xl border-2 border-b-4 border-[#e5e5e5] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#777] sm:w-auto"
              onClick={onExit}
            >
              Voltar ao painel
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white transition hover:bg-[#61d808] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!pool.length}
              onClick={start}
            >
              <Zap size={15} /> Iniciar simulado
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = activeQuestion;
  if (!question) {
    return (
      <div className="mx-auto flex min-h-[68vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[24px] border-2 border-b-4 border-[#e5e5e5] bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d7ffb8] text-[#58a700]">
            <Trophy size={30} />
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-[#3c3c3c]">Simulado concluído</h1>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-[#777]">
            Você acertou {correct} de {queue.length} questões.
          </p>
          <button
            className="mt-6 rounded-xl border-b-4 border-[#46a302] bg-[#58cc02] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-white"
            onClick={onExit}
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }
  const subject = state.subjects.find((item) => item.id === question.subjectId);
  const selected = question.alternatives.find((alternative) => alternative.id === selectedId);
  const alternativesToDisplay = displayedAlternatives.length
    ? displayedAlternatives
    : question.alternatives;
  const next = () => {
    if (index === queue.length - 1) onFocusChange(false);
    setIndex((value) => value + 1);
    setSelectedId(null);
    setHintOpen(false);
  };
  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[980px]">
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            aria-label="Sair do simulado"
            className="rounded-xl p-1 text-[#afafaf] transition hover:bg-[#f3f3f3] hover:text-[#777]"
            onClick={onExit}
          >
            <X size={24} strokeWidth={3} />
          </button>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e5e5e5] sm:h-4">
            <div
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500"
              style={{ width: `${((index + (selectedId ? 1 : 0)) / queue.length) * 100}%` }}
            />
          </div>
          <div className="flex min-w-fit items-center gap-1 text-[12px] font-extrabold text-[#ff9600] sm:gap-1.5 sm:text-[14px]">
            <Flame size={18} fill="currentColor" />
            {index + 1}/{queue.length}
          </div>
        </div>
        <div className="mx-auto max-w-[760px] pb-40 pt-8 sm:pb-36 sm:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e9f8dd] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#58a700]">
              {subject?.name}
            </span>
            <span className="rounded-full bg-[#f3f3f3] px-3 py-1.5 text-[11px] font-extrabold text-[#8c8c8c]">
              Modo simulado
            </span>
          </div>
          <p className="mt-8 text-[14px] font-extrabold uppercase tracking-[0.8px] text-[#777]">
            Selecione a resposta correta
          </p>
          <h1 className="mt-3 text-[20px] font-extrabold leading-8 tracking-[-0.4px] text-[#3c3c3c] sm:text-[28px] sm:leading-10">
            {question.prompt}
          </h1>
          <button
            className="mt-5 flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 py-2 text-[12px] font-extrabold text-[#777] transition hover:bg-[#f7f7f7]"
            onClick={() => setHintOpen((open) => !open)}
          >
            <Lightbulb size={16} className="text-[#ffc800]" />
            {hintOpen ? "Ocultar dica" : "Mostrar dica"}
            <ChevronDown size={14} className={`transition ${hintOpen ? "rotate-180" : ""}`} />
          </button>
          {hintOpen && (
            <p className="mt-3 rounded-2xl border-2 border-[#ffe58a] bg-[#fffbea] px-4 py-3 text-[13px] font-semibold leading-6 text-[#806d28]">
              {question.hint}
            </p>
          )}
          <div className="mt-8 grid gap-3">
            {alternativesToDisplay.map((alternative, alternativeIndex) => (
              <div key={alternative.id}>
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 px-3 py-3.5 text-left transition active:translate-y-0.5 active:border-b-2 sm:gap-4 sm:px-4 sm:py-4 ${
                    selectedId
                      ? alternative.isCorrect
                        ? "border-[#58cc02] bg-[#f1ffe7] text-[#46a302]"
                        : selectedId === alternative.id
                          ? "border-[#ff4b4b] bg-[#fff0f0] text-[#ea2b2b]"
                          : "border-[#e5e5e5] bg-white text-[#4b4b4b]"
                      : "border-[#e5e5e5] bg-white text-[#4b4b4b] hover:border-[#1cb0f6] hover:bg-[#f2fbff]"
                  }`}
                  onClick={() => {
                    if (selectedId) return;
                    setSelectedId(alternative.id);
                    if (alternative.isCorrect) setCorrect((value) => value + 1);
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-[12px] font-extrabold opacity-75 sm:h-8 sm:w-8 sm:text-[13px]">
                    {answerLabels[alternativeIndex] ?? alternative.label}
                  </span>
                  <span className="flex-1 text-[14px] font-extrabold leading-6 sm:text-[15px]">
                    {alternative.text}
                  </span>
                  {selectedId && alternative.isCorrect && <CheckCircle2 size={22} className="shrink-0" />}
                  {selectedId === alternative.id && !alternative.isCorrect && <XCircle size={22} className="shrink-0" />}
                </button>
                {selectedId === alternative.id && (
                  <p className="animate-slide-up px-2 pt-3 text-[12px] font-semibold leading-5 text-[#777]">
                    {alternative.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {selected && (
        <div
          className={`animate-feedback-in fixed bottom-0 left-0 right-0 z-40 border-t-2 ${
            selected.isCorrect
              ? "border-[#a5ed6e] bg-[#d7ffb8]"
              : "border-[#ffc1c1] bg-[#ffdfe0]"
          }`}
        >
          <div className="mx-auto flex max-w-[980px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70 ${
                  selected.isCorrect ? "text-[#58a700]" : "text-[#ea2b2b]"
                }`}
              >
                {selected.isCorrect ? <CheckCircle2 size={27} /> : <XCircle size={27} />}
              </div>
              <div>
                <p className={`text-[18px] font-extrabold ${selected.isCorrect ? "text-[#58a700]" : "text-[#ea2b2b]"}`}>
                  {selected.isCorrect ? "Muito bem!" : "Quase lá!"}
                </p>
                <p className={`mt-0.5 text-[12px] font-bold ${selected.isCorrect ? "text-[#6da83e]" : "text-[#cf5d5d]"}`}>
                  Este modo não altera seu calendário de revisão.
                </p>
              </div>
            </div>
            <button
              className={`flex w-full items-center justify-center gap-2 rounded-xl border-b-4 px-7 py-3 text-[13px] font-extrabold uppercase tracking-[0.6px] text-white transition active:translate-y-0.5 active:border-b-2 sm:w-auto ${
                selected.isCorrect
                  ? "border-[#46a302] bg-[#58cc02] hover:bg-[#61d808]"
                  : "border-[#d83333] bg-[#ff4b4b] hover:bg-[#ff5b5b]"
              }`}
              onClick={next}
            >
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


