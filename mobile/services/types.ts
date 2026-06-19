export type ReviewState = "new" | "learning" | "review";

export type Alternative = {
  id: string;
  label: string;
  text: string;
  rationale: string;
  isCorrect: boolean;
};

export type Notebook = {
  id: string;
  name: string;
  description: string;
  color: string;
  sourceCatalogPackId?: string | null;
  sourceCatalogVersion?: number | null;
};

export type Subject = {
  id: string;
  notebookId: string;
  name: string;
  description: string;
  color: string;
  sourceCatalogPackId?: string | null;
  sourceCatalogSubjectId?: string | null;
};

export type Question = {
  id: string;
  subjectId: string;
  prompt: string;
  hint: string;
  sourceCatalogPackId?: string | null;
  sourceCatalogQuestionId?: string | null;
  sourceCatalogVersion?: number | null;
  alternatives: Alternative[];
};

export type Progress = {
  questionId: string;
  difficulty: number;
  stability: number;
  state: ReviewState;
  nextReview: string;
  reviews: number;
  mistakes: number;
};

export type ReviewLog = {
  id: string;
  questionId: string;
  subjectId: string;
  answeredAt: string;
  correct: boolean;
  selectedAlternativeId: string;
  responseTimeSeconds: number;
};

export type CooldownItem = {
  questionId: string;
  availableAt: string;
};

export type ActiveReviewSession = {
  id: string;
  questionIds: string[];
  answeredQuestionIds: string[];
};

export type SrsSettings = {
  cooldownMinMinutes: number;
  cooldownMaxMinutes: number;
  firstReviewDays: number;
  reviewMultiplier: number;
  soundEnabled: boolean;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro";
  adminRole: "support" | "admin" | "owner" | null;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  xp: number;
  weeklyXp: number;
  streak: number;
  photoUrl?: string | null;
};

export type AppState = {
  notebooks: Notebook[];
  subjects: Subject[];
  questions: Question[];
  progress: Record<string, Progress>;
  logs: ReviewLog[];
  cooldown: CooldownItem[];
  completedDates: string[];
  settings: SrsSettings;
  activeReviewSession: ActiveReviewSession | null;
};

export type ContentImport = Pick<AppState, "notebooks" | "subjects" | "questions">;

export type AppAction =
  | { type: "import"; content: ContentImport; confirmReplace: true }
  | { type: "addNotebook"; notebook: Notebook }
  | { type: "addSubject"; subject: Subject }
  | { type: "addQuestion"; question: Question }
  | { type: "deleteNotebook"; notebookId: string }
  | { type: "deleteSubject"; subjectId: string }
  | { type: "deleteQuestion"; questionId: string }
  | { type: "saveSettings"; settings: SrsSettings }
  | { type: "startReview"; questionIds: string[] }
  | {
      type: "answer";
      reviewSessionId: string;
      requestId: string;
      questionId: string;
      selectedAlternativeId: string;
      responseTimeSeconds: number;
    }
  | { type: "completeReview"; reviewSessionId: string }
  | { type: "abandonReview"; reviewSessionId: string };
