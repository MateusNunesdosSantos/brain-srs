import { exampleContent, origin } from "./test-helpers.mjs";

const runId = Date.now();
const email = `backend-${runId}@example.com`;
const existingNotebookId = `nb-existing-before-import-${runId}`;
const registration = await fetch(`${origin}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Teste Backend", email, password: "123456" }),
});
if (!registration.ok) throw new Error(`Registration failed: ${registration.status}`);
const cookie = registration.headers.get("set-cookie").split(";")[0];
const headers = { "Content-Type": "application/json", Cookie: cookie };
const post = async (payload, expectedStatus = 200) => {
  const response = await fetch(`${origin}/api/actions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
};
const getState = async () => {
  const response = await fetch(`${origin}/api/state`, { headers: { Cookie: cookie } });
  return (await response.json()).state;
};

await post({ type: "reset" }, 400);
await post(
  {
    type: "import",
    confirmReplace: true,
    content: { notebooks: [], subjects: [], questions: [{ id: "invalid" }] },
  },
  400,
);
await post({
  type: "addNotebook",
  notebook: {
    id: existingNotebookId,
    name: "Caderno Existente",
    description: "Conteúdo criado antes da importação.",
    color: "#58cc02",
  },
});
await post({ type: "import", confirmReplace: true, content: exampleContent });

let state = await getState();
if (!state.notebooks.some((notebook) => notebook.id === existingNotebookId)) {
  throw new Error("Import removed existing notebook.");
}
if (state.notebooks.length < 2) {
  throw new Error(`Import should merge content, received ${state.notebooks.length} notebooks.`);
}
const question = state.questions[0];
const correct = question.alternatives.find((alternative) => alternative.isCorrect);
await post(
  {
    type: "answer",
    reviewSessionId: "invalid",
    requestId: "outside-session",
    questionId: question.id,
    selectedAlternativeId: correct.id,
    responseTimeSeconds: 8,
  },
  400,
);

const started = await post({ type: "startReview", questionIds: [question.id] });
const reviewSessionId = started.result.reviewSessionId;
const answer = {
  type: "answer",
  reviewSessionId,
  requestId: `answer-${Date.now()}`,
  questionId: question.id,
  selectedAlternativeId: correct.id,
  responseTimeSeconds: 8,
};
await post(answer);
const retry = await post(answer);
if (!retry.result.duplicate) throw new Error("Idempotent retry was not detected.");
state = await getState();
if (state.activeReviewSession !== null) throw new Error("Review session was not completed.");
if (state.logs.length !== 1) throw new Error("Retry created a duplicate review log.");

console.log("Backend validation passed: schemas -> protected reset -> merged import -> review session -> idempotent retry");
