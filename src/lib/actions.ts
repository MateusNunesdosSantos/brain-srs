import { AppState, Notebook, Question, SrsSettings, Subject } from "@/lib/types";

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
