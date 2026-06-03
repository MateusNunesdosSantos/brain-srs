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
};

export type Subject = {
  id: string;
  notebookId: string;
  name: string;
  description: string;
  color: string;
};

export type Question = {
  id: string;
  subjectId: string;
  prompt: string;
  hint: string;
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
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro";
  onboardingCompleted: boolean;
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

export type PageId =
  | "dashboard"
  | "review"
  | "library"
  | "stats"
  | "vulnerabilities"
  | "simulation"
  | "settings";
