import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const shortText = z.string().trim().max(160);
const description = z.string().trim().max(1000);
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "Use uma cor hexadecimal válida.");

const alternativeSchema = z.object({
  id,
  label: z.string().trim().min(1).max(8),
  text: z.string().trim().min(1).max(1000),
  rationale: z.string().trim().max(2000),
  isCorrect: z.boolean(),
});

export const notebookSchema = z.object({
  id,
  name: shortText.min(1),
  description,
  color,
});

export const subjectSchema = z.object({
  id,
  notebookId: id,
  name: shortText.min(1),
  description,
  color,
});

export const questionSchema = z
  .object({
    id,
    subjectId: id,
    prompt: z.string().trim().min(1).max(4000),
    hint: z.string().trim().max(2000),
    alternatives: z.array(alternativeSchema).min(2).max(8),
  })
  .superRefine((question, context) => {
    if (question.alternatives.filter((alternative) => alternative.isCorrect).length !== 1) {
      context.addIssue({
        code: "custom",
        message: "Cada questão deve possuir exatamente uma alternativa correta.",
        path: ["alternatives"],
      });
    }
    if (new Set(question.alternatives.map((alternative) => alternative.id)).size !== question.alternatives.length) {
      context.addIssue({
        code: "custom",
        message: "As alternativas da questão devem possuir identificadores únicos.",
        path: ["alternatives"],
      });
    }
  });

export const settingsSchema = z
  .object({
    cooldownMinMinutes: z.number().int().min(1).max(1440),
    cooldownMaxMinutes: z.number().int().min(1).max(1440),
    firstReviewDays: z.number().min(0.1).max(365),
    reviewMultiplier: z.number().min(1).max(10),
  })
  .refine((settings) => settings.cooldownMinMinutes <= settings.cooldownMaxMinutes, {
    message: "O cooldown mínimo não pode ser maior que o cooldown máximo.",
    path: ["cooldownMinMinutes"],
  });

export const contentImportSchema = z
  .object({
    notebooks: z.array(notebookSchema).max(500),
    subjects: z.array(subjectSchema).max(5000),
    questions: z.array(questionSchema).max(20000),
  })
  .superRefine((content, context) => {
    const notebookIds = new Set(content.notebooks.map((notebook) => notebook.id));
    const subjectIds = new Set(content.subjects.map((subject) => subject.id));
    const questionIds = new Set(content.questions.map((question) => question.id));
    const alternativeIds = content.questions.flatMap((question) =>
      question.alternatives.map((alternative) => alternative.id),
    );

    if (notebookIds.size !== content.notebooks.length) {
      context.addIssue({ code: "custom", message: "Existem cadernos duplicados.", path: ["notebooks"] });
    }
    if (subjectIds.size !== content.subjects.length) {
      context.addIssue({ code: "custom", message: "Existem matérias duplicadas.", path: ["subjects"] });
    }
    if (questionIds.size !== content.questions.length) {
      context.addIssue({ code: "custom", message: "Existem questões duplicadas.", path: ["questions"] });
    }
    if (new Set(alternativeIds).size !== alternativeIds.length) {
      context.addIssue({ code: "custom", message: "Existem alternativas duplicadas.", path: ["questions"] });
    }
    if (content.subjects.some((subject) => !notebookIds.has(subject.notebookId))) {
      context.addIssue({ code: "custom", message: "Uma matéria aponta para um caderno inexistente.", path: ["subjects"] });
    }
    if (content.questions.some((question) => !subjectIds.has(question.subjectId))) {
      context.addIssue({ code: "custom", message: "Uma questão aponta para uma matéria inexistente.", path: ["questions"] });
    }
  });

export const appActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("import"), content: contentImportSchema, confirmReplace: z.literal(true) }),
  z.object({ type: z.literal("addNotebook"), notebook: notebookSchema }),
  z.object({ type: z.literal("addSubject"), subject: subjectSchema }),
  z.object({ type: z.literal("addQuestion"), question: questionSchema }),
  z.object({ type: z.literal("deleteNotebook"), notebookId: id }),
  z.object({ type: z.literal("deleteSubject"), subjectId: id }),
  z.object({ type: z.literal("deleteQuestion"), questionId: id }),
  z.object({ type: z.literal("saveSettings"), settings: settingsSchema }),
  z.object({ type: z.literal("startReview"), questionIds: z.array(id).min(1).max(200) }),
  z.object({
    type: z.literal("answer"),
    reviewSessionId: id,
    requestId: id,
    questionId: id,
    selectedAlternativeId: id,
    responseTimeSeconds: z.number().int().min(0).max(86400),
  }),
  z.object({ type: z.literal("completeReview"), reviewSessionId: id }),
  z.object({ type: z.literal("abandonReview"), reviewSessionId: id }),
]);

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(256),
});

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
