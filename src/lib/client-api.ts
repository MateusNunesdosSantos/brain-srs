import { AppAction } from "@/lib/actions";
import { AppState, AuthUser } from "@/lib/types";

export type AuthPayload = { state: AppState; user: AuthUser };

export type ActionResult = {
  cooldownMinutes?: number | null;
  completed?: boolean;
  reviewSessionId?: string;
};

export type ActionPayload = {
  state?: Partial<AppState>;
  result?: ActionResult;
  error?: string;
};

export function mergeAppState(current: AppState, patch: Partial<AppState>): AppState {
  return {
    ...current,
    ...patch,
    notebooks: patch.notebooks ?? current.notebooks,
    subjects: patch.subjects ?? current.subjects,
    questions: patch.questions ?? current.questions,
    progress: patch.progress ?? current.progress,
    logs: patch.logs ?? current.logs,
    cooldown: patch.cooldown ?? current.cooldown,
    completedDates: patch.completedDates ?? current.completedDates,
    settings: patch.settings ?? current.settings,
    activeReviewSession:
      patch.activeReviewSession === undefined
        ? current.activeReviewSession
        : patch.activeReviewSession,
  };
}

export async function fetchState(signal?: AbortSignal) {
  const response = await fetch("/api/state", { signal });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Falha ao carregar dados.");
  return response.json() as Promise<AuthPayload>;
}

export async function postAction(action: AppAction) {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  const payload = (await response.json()) as ActionPayload;
  if (!response.ok || !payload.state) {
    const error = new Error(payload.error ?? "Falha ao salvar dados.") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return { state: payload.state, result: payload.result ?? {} };
}

export async function postAuth(mode: "login" | "register", body: unknown) {
  const response = await fetch(`/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Partial<AuthPayload> & { error?: string };
  if (!response.ok || !payload.state || !payload.user) {
    throw new Error(payload.error ?? "Não foi possível acessar sua conta.");
  }
  return { state: payload.state, user: payload.user };
}

export async function completeOnboardingRequest() {
  const response = await fetch("/api/auth/onboarding", { method: "POST" });
  const payload = (await response.json()) as { user?: AuthUser; error?: string };
  if (!response.ok || !payload.user) {
    throw new Error(payload.error ?? "Falha ao concluir apresentação.");
  }
  return payload.user;
}

export function logoutRequest() {
  return fetch("/api/auth/logout", { method: "POST" });
}
