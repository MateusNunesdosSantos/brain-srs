import { existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AppAction, ContentImport } from "@/lib/actions";
import { seedState } from "@/lib/seed";
import {
  Alternative,
  ActiveReviewSession,
  AppState,
  AuthUser,
  CooldownItem,
  Notebook,
  Progress,
  Question,
  ReviewLog,
  ReviewState,
  SrsSettings,
  Subject,
} from "@/lib/types";

type Row = Record<string, unknown>;

const dataDirectory = join(process.cwd(), "data");
const databasePath = join(dataDirectory, "brainsrs.sqlite");
const backupsDirectory = join(dataDirectory, "backups");
const targetSchemaVersion = 2;
const testUserId = "user-mateus-test";
export const sessionCookieName = "brainsrs_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

declare global {
  var brainSrsDatabase: DatabaseSync | undefined;
}

mkdirSync(dataDirectory, { recursive: true });

const database = globalThis.brainSrsDatabase ?? new DatabaseSync(databasePath);
globalThis.brainSrsDatabase = database;

database.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    hint TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alternatives (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS progress (
    question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    difficulty REAL NOT NULL,
    stability REAL NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('new', 'learning', 'review')),
    next_review TEXT NOT NULL,
    reviews INTEGER NOT NULL,
    mistakes INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS review_logs (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    answered_at TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    selected_alternative_id TEXT NOT NULL REFERENCES alternatives(id) ON DELETE CASCADE,
    response_time_seconds INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cooldown (
    question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    available_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS completed_dates (
    date TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS srs_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cooldown_min_minutes INTEGER NOT NULL,
    cooldown_max_minutes INTEGER NOT NULL,
    first_review_days REAL NOT NULL,
    review_multiplier REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_subjects_notebook ON subjects(notebook_id);
  CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
  CREATE INDEX IF NOT EXISTS idx_alternatives_question ON alternatives(question_id);
  CREATE INDEX IF NOT EXISTS idx_progress_next_review ON progress(next_review);
  CREATE INDEX IF NOT EXISTS idx_review_logs_question ON review_logs(question_id);
  CREATE INDEX IF NOT EXISTS idx_review_logs_subject ON review_logs(subject_id);
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS database_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiration ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS review_session_items (
    session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    answered_at TEXT,
    review_log_id TEXT,
    PRIMARY KEY (session_id, question_id)
  );

  CREATE INDEX IF NOT EXISTS idx_review_sessions_user ON review_sessions(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sessions_active_user
    ON review_sessions(user_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_review_session_items_question
    ON review_session_items(question_id);
`);

function passwordDigest(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function insertUser(
  id: string,
  name: string,
  email: string,
  password: string,
  plan: "free" | "pro" = "free",
  onboardingCompleted = false,
) {
  const salt = randomBytes(16).toString("hex");
  database
    .prepare(`
      INSERT INTO users (
        id, name, email, password_hash, password_salt, created_at, plan, onboarding_completed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      name,
      email.trim().toLowerCase(),
      passwordDigest(password, salt),
      salt,
      new Date().toISOString(),
      plan,
      onboardingCompleted ? 1 : 0,
    );
}

if (!database.prepare(`SELECT id FROM users WHERE id = ?`).get(testUserId)) {
  insertUser(testUserId, "Mateus", "mateusnunesmds@gmail.com", "123", "pro", true);
}

function hasColumn(table: string, column: string) {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as Row[]).some(
    (row) => String(row.name) === column,
  );
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function getSchemaVersion() {
  const row = database
    .prepare(`SELECT value FROM database_meta WHERE key = 'schema_version'`)
    .get() as Row | undefined;
  return row ? Number(row.value) : 0;
}

function setSchemaVersion(version: number) {
  database
    .prepare(`
      INSERT INTO database_meta (key, value) VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(String(version));
}

function backupBeforeSchemaMigration() {
  if (!existsSync(databasePath)) return;
  mkdirSync(backupsDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    backupsDirectory,
    `brainsrs-before-schema-v${targetSchemaVersion}-${timestamp}.sqlite`,
  );
  database.exec(`VACUUM INTO ${sqlString(backupPath)}`);
}

const schemaVersionBeforeMigration = getSchemaVersion();
if (schemaVersionBeforeMigration < targetSchemaVersion) {
  backupBeforeSchemaMigration();
}

if (!hasColumn("users", "plan")) {
  database.exec(`ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'`);
}
if (!hasColumn("users", "onboarding_completed")) {
  database.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0`);
}
database.prepare(`UPDATE users SET plan = 'pro', onboarding_completed = 1 WHERE id = ?`).run(testUserId);

if (!hasColumn("notebooks", "user_id")) {
  database.exec(`ALTER TABLE notebooks ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`);
}
database.prepare(`UPDATE notebooks SET user_id = ? WHERE user_id IS NULL`).run(testUserId);

if (!hasColumn("completed_dates", "user_id")) {
  database.exec(`
    ALTER TABLE completed_dates RENAME TO completed_dates_legacy;
    CREATE TABLE completed_dates (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (user_id, date)
    );
  `);
  database
    .prepare(`INSERT INTO completed_dates (user_id, date) SELECT ?, date FROM completed_dates_legacy`)
    .run(testUserId);
  database.exec(`DROP TABLE completed_dates_legacy`);
}

if (!hasColumn("srs_settings", "user_id")) {
  database.exec(`
    ALTER TABLE srs_settings RENAME TO srs_settings_legacy;
    CREATE TABLE srs_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cooldown_min_minutes INTEGER NOT NULL,
      cooldown_max_minutes INTEGER NOT NULL,
      first_review_days REAL NOT NULL,
      review_multiplier REAL NOT NULL
    );
  `);
  database
    .prepare(`
      INSERT INTO srs_settings (
        user_id, cooldown_min_minutes, cooldown_max_minutes,
        first_review_days, review_multiplier
      )
      SELECT ?, cooldown_min_minutes, cooldown_max_minutes, first_review_days, review_multiplier
      FROM srs_settings_legacy
      WHERE id = 1
    `)
    .run(testUserId);
  database.exec(`DROP TABLE srs_settings_legacy`);
}

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_notebooks_user ON notebooks(user_id);
`);

if (schemaVersionBeforeMigration < targetSchemaVersion) {
  setSchemaVersion(targetSchemaVersion);
}

const statements = {
  insertNotebook: database.prepare(`
    INSERT INTO notebooks (id, name, description, color, user_id) VALUES (?, ?, ?, ?, ?)
  `),
  insertSubject: database.prepare(`
    INSERT INTO subjects (id, notebook_id, name, description, color)
    SELECT ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM notebooks WHERE id = ? AND user_id = ?)
  `),
  insertQuestion: database.prepare(`
    INSERT INTO questions (id, subject_id, prompt, hint)
    SELECT ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM subjects
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      WHERE subjects.id = ? AND notebooks.user_id = ?
    )
  `),
  insertAlternative: database.prepare(`
    INSERT INTO alternatives (
      id, question_id, label, text, rationale, is_correct, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  upsertProgress: database.prepare(`
    INSERT INTO progress (
      question_id, difficulty, stability, state, next_review, reviews, mistakes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      difficulty = excluded.difficulty,
      stability = excluded.stability,
      state = excluded.state,
      next_review = excluded.next_review,
      reviews = excluded.reviews,
      mistakes = excluded.mistakes
  `),
  insertLog: database.prepare(`
    INSERT INTO review_logs (
      id, question_id, subject_id, answered_at, correct,
      selected_alternative_id, response_time_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  upsertCooldown: database.prepare(`
    INSERT INTO cooldown (question_id, available_at) VALUES (?, ?)
    ON CONFLICT(question_id) DO UPDATE SET available_at = excluded.available_at
  `),
  insertCompletedDate: database.prepare(`
    INSERT OR IGNORE INTO completed_dates (user_id, date) VALUES (?, ?)
  `),
  upsertSettings: database.prepare(`
    INSERT INTO srs_settings (
      user_id, cooldown_min_minutes, cooldown_max_minutes,
      first_review_days, review_multiplier
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      cooldown_min_minutes = excluded.cooldown_min_minutes,
      cooldown_max_minutes = excluded.cooldown_max_minutes,
      first_review_days = excluded.first_review_days,
      review_multiplier = excluded.review_multiplier
  `),
  deleteNotebook: database.prepare(`DELETE FROM notebooks WHERE id = ? AND user_id = ?`),
  deleteSubject: database.prepare(`
    DELETE FROM subjects
    WHERE id = ?
      AND EXISTS (
        SELECT 1 FROM notebooks WHERE notebooks.id = subjects.notebook_id AND notebooks.user_id = ?
      )
  `),
  deleteQuestion: database.prepare(`
    DELETE FROM questions
    WHERE id = ?
      AND EXISTS (
        SELECT 1
        FROM subjects
        INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
        WHERE subjects.id = questions.subject_id AND notebooks.user_id = ?
      )
  `),
};

const defaultSettings: SrsSettings = {
  cooldownMinMinutes: 10,
  cooldownMaxMinutes: 15,
  firstReviewDays: 1.4,
  reviewMultiplier: 2.05,
};

function inTransaction<T>(callback: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function clearUserData(userId: string) {
  database.prepare(`DELETE FROM review_sessions WHERE user_id = ?`).run(userId);
  database.prepare(`DELETE FROM completed_dates WHERE user_id = ?`).run(userId);
  database.prepare(`DELETE FROM notebooks WHERE user_id = ?`).run(userId);
}

function insertNotebook(userId: string, notebook: Notebook) {
  statements.insertNotebook.run(
    notebook.id,
    notebook.name,
    notebook.description,
    notebook.color,
    userId,
  );
}

function insertSubject(userId: string, subject: Subject) {
  const result = statements.insertSubject.run(
    subject.id,
    subject.notebookId,
    subject.name,
    subject.description,
    subject.color,
    subject.notebookId,
    userId,
  );
  if (!result.changes) throw new Error("Caderno não encontrado.");
}

function insertQuestion(userId: string, question: Question) {
  const result = statements.insertQuestion.run(
    question.id,
    question.subjectId,
    question.prompt,
    question.hint,
    question.subjectId,
    userId,
  );
  if (!result.changes) throw new Error("Matéria não encontrada.");
  question.alternatives.forEach((alternative, index) => {
    statements.insertAlternative.run(
      alternative.id,
      question.id,
      alternative.label,
      alternative.text,
      alternative.rationale,
      alternative.isCorrect ? 1 : 0,
      index,
    );
  });
}

function upsertProgress(progress: Progress) {
  statements.upsertProgress.run(
    progress.questionId,
    progress.difficulty,
    progress.stability,
    progress.state,
    progress.nextReview,
    progress.reviews,
    progress.mistakes,
  );
}

function validateSettings(settings: SrsSettings) {
  if (
    !Number.isInteger(settings.cooldownMinMinutes) ||
    !Number.isInteger(settings.cooldownMaxMinutes) ||
    settings.cooldownMinMinutes < 1 ||
    settings.cooldownMaxMinutes > 1440 ||
    settings.cooldownMinMinutes > settings.cooldownMaxMinutes
  ) {
    throw new Error("Defina um cooldown válido entre 1 e 1440 minutos.");
  }
  if (
    !Number.isFinite(settings.firstReviewDays) ||
    settings.firstReviewDays < 0.1 ||
    settings.firstReviewDays > 365
  ) {
    throw new Error("Defina o primeiro intervalo entre 0,1 e 365 dias.");
  }
  if (
    !Number.isFinite(settings.reviewMultiplier) ||
    settings.reviewMultiplier < 1 ||
    settings.reviewMultiplier > 10
  ) {
    throw new Error("Defina o multiplicador entre 1 e 10.");
  }
}

function saveSettings(userId: string, settings: SrsSettings) {
  validateSettings(settings);
  statements.upsertSettings.run(
    userId,
    settings.cooldownMinMinutes,
    settings.cooldownMaxMinutes,
    settings.firstReviewDays,
    settings.reviewMultiplier,
  );
}

function getSettings(userId: string): SrsSettings {
  const row = database.prepare(`SELECT * FROM srs_settings WHERE user_id = ?`).get(userId) as
    | Row
    | undefined;
  if (!row) return defaultSettings;
  return {
    cooldownMinMinutes: Number(row.cooldown_min_minutes),
    cooldownMaxMinutes: Number(row.cooldown_max_minutes),
    firstReviewDays: Number(row.first_review_days),
    reviewMultiplier: Number(row.review_multiplier),
  };
}

function writeState(userId: string, state: AppState) {
  clearUserData(userId);
  saveSettings(userId, state.settings);
  state.notebooks.forEach((notebook) => insertNotebook(userId, notebook));
  state.subjects.forEach((subject) => insertSubject(userId, subject));
  state.questions.forEach((question) => insertQuestion(userId, question));
  Object.values(state.progress).forEach(upsertProgress);
  state.logs.forEach((log) => {
    statements.insertLog.run(
      log.id,
      log.questionId,
      log.subjectId,
      log.answeredAt,
      log.correct ? 1 : 0,
      log.selectedAlternativeId,
      log.responseTimeSeconds,
    );
  });
  state.cooldown.forEach((item) => {
    statements.upsertCooldown.run(item.questionId, item.availableAt);
  });
  state.completedDates.forEach((date) => {
    statements.insertCompletedDate.run(userId, date);
  });
}

function initialProgress(questionId: string): Progress {
  return {
    questionId,
    difficulty: 5,
    stability: 0.7,
    state: "new",
    nextReview: new Date().toISOString(),
    reviews: 0,
    mistakes: 0,
  };
}

function scopeImportedContent(content: ContentImport): ContentImport {
  const notebookIds = new Map(content.notebooks.map((notebook) => [notebook.id, randomUUID()]));
  const subjectIds = new Map(content.subjects.map((subject) => [subject.id, randomUUID()]));
  const questionIds = new Map(content.questions.map((question) => [question.id, randomUUID()]));
  return {
    notebooks: content.notebooks.map((notebook) => ({ ...notebook, id: notebookIds.get(notebook.id)! })),
    subjects: content.subjects.map((subject) => ({
      ...subject,
      id: subjectIds.get(subject.id)!,
      notebookId: notebookIds.get(subject.notebookId) ?? "",
    })),
    questions: content.questions.map((question) => ({
      ...question,
      id: questionIds.get(question.id)!,
      subjectId: subjectIds.get(question.subjectId) ?? "",
      alternatives: question.alternatives.map((alternative) => ({ ...alternative, id: randomUUID() })),
    })),
  };
}

function replaceContent(userId: string, content: ContentImport) {
  const scopedContent = scopeImportedContent(content);
  const initializedProgress = scopedContent.questions.reduce<Record<string, Progress>>(
    (progress, question) => {
      progress[question.id] = initialProgress(question.id);
      return progress;
    },
    {},
  );
  writeState(userId, {
    ...scopedContent,
    progress: initializedProgress,
    logs: [],
    cooldown: [],
    completedDates: [],
    settings: getSettings(userId),
    activeReviewSession: null,
  });
}

function addQuestion(userId: string, question: Question) {
  insertQuestion(userId, question);
  upsertProgress(initialProgress(question.id));
}

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function abandonActiveReviewSessions(userId: string) {
  database
    .prepare(`
      UPDATE review_sessions
      SET status = 'abandoned', completed_at = ?
      WHERE user_id = ? AND status = 'active'
    `)
    .run(new Date().toISOString(), userId);
}

function startReviewSession(userId: string, questionIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)];
  if (uniqueQuestionIds.length !== questionIds.length) {
    throw new Error("A fila de revisão contém questões duplicadas.");
  }

  const now = new Date().toISOString();
  const eligibleQuestion = database.prepare(`
    SELECT questions.id
    FROM questions
    INNER JOIN subjects ON subjects.id = questions.subject_id
    INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
    INNER JOIN progress ON progress.question_id = questions.id
    LEFT JOIN cooldown ON cooldown.question_id = questions.id
    WHERE questions.id = ?
      AND notebooks.user_id = ?
      AND progress.next_review <= ?
      AND (cooldown.available_at IS NULL OR cooldown.available_at <= ?)
  `);
  uniqueQuestionIds.forEach((questionId) => {
    if (!eligibleQuestion.get(questionId, userId, now, now)) {
      throw new Error("A fila contém uma questão indisponível para revisão.");
    }
  });

  abandonActiveReviewSessions(userId);
  const reviewSessionId = randomUUID();
  database
    .prepare(`
      INSERT INTO review_sessions (id, user_id, status, created_at)
      VALUES (?, ?, 'active', ?)
    `)
    .run(reviewSessionId, userId, now);
  const insertItem = database.prepare(`
    INSERT INTO review_session_items (session_id, question_id, position)
    VALUES (?, ?, ?)
  `);
  uniqueQuestionIds.forEach((questionId, position) => {
    insertItem.run(reviewSessionId, questionId, position);
  });
  return { reviewSessionId };
}

function registerAnswer(userId: string, action: Extract<AppAction, { type: "answer" }>) {
  const existingLog = database
    .prepare(`SELECT id FROM review_logs WHERE id = ?`)
    .get(action.requestId);
  if (existingLog) {
    return { duplicate: true, cooldownMinutes: null };
  }

  const selected = database
    .prepare(`
      SELECT
        alternatives.id,
        alternatives.is_correct,
        questions.subject_id,
        review_session_items.answered_at
      FROM alternatives
      INNER JOIN questions ON questions.id = alternatives.question_id
      INNER JOIN subjects ON subjects.id = questions.subject_id
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      INNER JOIN review_session_items ON review_session_items.question_id = questions.id
      INNER JOIN review_sessions ON review_sessions.id = review_session_items.session_id
      WHERE alternatives.id = ?
        AND questions.id = ?
        AND notebooks.user_id = ?
        AND review_sessions.id = ?
        AND review_sessions.user_id = ?
        AND review_sessions.status = 'active'
    `)
    .get(
      action.selectedAlternativeId,
      action.questionId,
      userId,
      action.reviewSessionId,
      userId,
    ) as Row | undefined;
  const previous = database
    .prepare(`
      SELECT progress.*
      FROM progress
      INNER JOIN questions ON questions.id = progress.question_id
      INNER JOIN subjects ON subjects.id = questions.subject_id
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      WHERE progress.question_id = ? AND notebooks.user_id = ?
    `)
    .get(action.questionId, userId) as Row | undefined;

  if (!selected || !previous) {
    throw new Error("Questão ou alternativa inválida.");
  }

  if (selected.answered_at) {
    throw new Error("Esta questão já foi respondida nesta sessão.");
  }

  const correct = Boolean(selected.is_correct);
  const settings = getSettings(userId);
  const cooldownMinutes =
    settings.cooldownMinMinutes +
    Math.floor(Math.random() * (settings.cooldownMaxMinutes - settings.cooldownMinMinutes + 1));
  const previousStability = Number(previous.stability);
  const previousReviews = Number(previous.reviews);
  const stability = correct
    ? previousReviews
      ? Math.max(settings.firstReviewDays, previousStability * settings.reviewMultiplier)
      : settings.firstReviewDays
    : 0.4;
  const jitter = 0.96 + Math.random() * 0.08;
  const nextReview = new Date(
    Date.now() +
      (correct
        ? stability * jitter * 24 * 60 * 60 * 1000
        : cooldownMinutes * 60 * 1000),
  ).toISOString();

  upsertProgress({
    questionId: action.questionId,
    difficulty: Math.min(
      10,
      Math.max(1, Number(previous.difficulty) + (correct ? -0.12 : 0.85)),
    ),
    stability,
    state: correct ? "review" : "learning",
    nextReview,
    reviews: previousReviews + 1,
    mistakes: Number(previous.mistakes) + (correct ? 0 : 1),
  });

  statements.insertLog.run(
    action.requestId,
    action.questionId,
    String(selected.subject_id),
    new Date().toISOString(),
    correct ? 1 : 0,
    action.selectedAlternativeId,
    action.responseTimeSeconds,
  );
  database
    .prepare(`
      UPDATE review_session_items
      SET answered_at = ?, review_log_id = ?
      WHERE session_id = ? AND question_id = ? AND answered_at IS NULL
    `)
    .run(new Date().toISOString(), action.requestId, action.reviewSessionId, action.questionId);

  if (correct) {
    database.prepare(`DELETE FROM cooldown WHERE question_id = ?`).run(action.questionId);
  } else {
    statements.upsertCooldown.run(action.questionId, nextReview);
  }

  const pending = database
    .prepare(`
      SELECT COUNT(*) AS total
      FROM review_session_items
      WHERE session_id = ? AND answered_at IS NULL
    `)
    .get(action.reviewSessionId) as Row;
  const completed = Number(pending.total) === 0;
  if (completed) completeReviewSession(userId, action.reviewSessionId);

  return { correct, cooldownMinutes: correct ? null : cooldownMinutes, completed };
}

function completeReviewSession(userId: string, reviewSessionId: string) {
  const session = database
    .prepare(`
      SELECT
        review_sessions.id,
        SUM(CASE WHEN review_session_items.answered_at IS NULL THEN 1 ELSE 0 END) AS unanswered
      FROM review_sessions
      INNER JOIN review_session_items ON review_session_items.session_id = review_sessions.id
      WHERE review_sessions.id = ?
        AND review_sessions.user_id = ?
        AND review_sessions.status = 'active'
      GROUP BY review_sessions.id
    `)
    .get(reviewSessionId, userId) as Row | undefined;
  if (!session) throw new Error("Sessão de revisão ativa não encontrada.");
  if (Number(session.unanswered) > 0) {
    throw new Error("Responda todas as questões antes de concluir a revisão.");
  }
  database
    .prepare(`
      UPDATE review_sessions
      SET status = 'completed', completed_at = ?
      WHERE id = ? AND user_id = ? AND status = 'active'
    `)
    .run(new Date().toISOString(), reviewSessionId, userId);
  statements.insertCompletedDate.run(userId, localDay());
  return {};
}

function abandonReviewSession(userId: string, reviewSessionId: string) {
  database
    .prepare(`
      UPDATE review_sessions
      SET status = 'abandoned', completed_at = ?
      WHERE id = ? AND user_id = ? AND status = 'active'
    `)
    .run(new Date().toISOString(), reviewSessionId, userId);
  return {};
}

function initializeDatabase() {
  inTransaction(() => {
    saveSettings(testUserId, getSettings(testUserId));
    const initialized = database.prepare(`SELECT value FROM database_meta WHERE key = 'initialized'`).get();
    if (!initialized) {
      const row = database
        .prepare(`SELECT COUNT(*) AS total FROM notebooks WHERE user_id = ?`)
        .get(testUserId) as Row;
      if (Number(row.total) === 0) {
        writeState(testUserId, seedState);
      }
      database.prepare(`INSERT INTO database_meta (key, value) VALUES ('initialized', ?)`).run(new Date().toISOString());
    }
  });
}

function toNotebook(row: Row): Notebook {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    color: String(row.color),
  };
}

function toSubject(row: Row): Subject {
  return {
    id: String(row.id),
    notebookId: String(row.notebook_id),
    name: String(row.name),
    description: String(row.description),
    color: String(row.color),
  };
}

function toProgress(row: Row): Progress {
  return {
    questionId: String(row.question_id),
    difficulty: Number(row.difficulty),
    stability: Number(row.stability),
    state: String(row.state) as ReviewState,
    nextReview: String(row.next_review),
    reviews: Number(row.reviews),
    mistakes: Number(row.mistakes),
  };
}

function toLog(row: Row): ReviewLog {
  return {
    id: String(row.id),
    questionId: String(row.question_id),
    subjectId: String(row.subject_id),
    answeredAt: String(row.answered_at),
    correct: Boolean(row.correct),
    selectedAlternativeId: String(row.selected_alternative_id),
    responseTimeSeconds: Number(row.response_time_seconds),
  };
}

initializeDatabase();

function getProgress(userId: string) {
  return (database.prepare(`
    SELECT progress.*
    FROM progress
    INNER JOIN questions ON questions.id = progress.question_id
    INNER JOIN subjects ON subjects.id = questions.subject_id
    INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
    WHERE notebooks.user_id = ?
  `).all(userId) as Row[]).reduce<Record<string, Progress>>((grouped, row) => {
    const item = toProgress(row);
    grouped[item.questionId] = item;
    return grouped;
  }, {});
}

function getLogs(userId: string) {
  return (database.prepare(`
    SELECT review_logs.*
    FROM review_logs
    INNER JOIN questions ON questions.id = review_logs.question_id
    INNER JOIN subjects ON subjects.id = questions.subject_id
    INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
    WHERE notebooks.user_id = ?
    ORDER BY review_logs.answered_at
  `).all(userId) as Row[]).map(toLog);
}

function getCooldown(userId: string) {
  return (
    database.prepare(`
      SELECT cooldown.*
      FROM cooldown
      INNER JOIN questions ON questions.id = cooldown.question_id
      INNER JOIN subjects ON subjects.id = questions.subject_id
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      WHERE notebooks.user_id = ?
      ORDER BY cooldown.available_at
    `).all(userId) as Row[]
  ).map<CooldownItem>((row) => ({
    questionId: String(row.question_id),
    availableAt: String(row.available_at),
  }));
}

function getCompletedDates(userId: string) {
  return (
    database.prepare(`SELECT date FROM completed_dates WHERE user_id = ? ORDER BY date`).all(userId) as Row[]
  ).map((row) => String(row.date));
}

function getActiveReviewSession(userId: string): ActiveReviewSession | null {
  const activeSessionRow = database
    .prepare(`
      SELECT id
      FROM review_sessions
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(userId) as Row | undefined;
  if (!activeSessionRow) return null;
  return {
    id: String(activeSessionRow.id),
    ...(database
      .prepare(`
        SELECT question_id, answered_at
        FROM review_session_items
        WHERE session_id = ?
        ORDER BY position
      `)
      .all(String(activeSessionRow.id)) as Row[]).reduce<
      Pick<ActiveReviewSession, "questionIds" | "answeredQuestionIds">
    >(
      (session, row) => {
        const questionId = String(row.question_id);
        session.questionIds.push(questionId);
        if (row.answered_at) session.answeredQuestionIds.push(questionId);
        return session;
      },
      { questionIds: [], answeredQuestionIds: [] },
    ),
  };
}

function getReviewRuntimeState(userId: string): Partial<AppState> {
  return {
    progress: getProgress(userId),
    logs: getLogs(userId),
    cooldown: getCooldown(userId),
    completedDates: getCompletedDates(userId),
    settings: getSettings(userId),
    activeReviewSession: getActiveReviewSession(userId),
  };
}

export function getAppState(userId: string): AppState {
  const notebooks = (database.prepare(`SELECT * FROM notebooks WHERE user_id = ? ORDER BY rowid`).all(userId) as Row[]).map(
    toNotebook,
  );
  const subjects = (database.prepare(`
    SELECT subjects.*
    FROM subjects
    INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
    WHERE notebooks.user_id = ?
    ORDER BY subjects.rowid
  `).all(userId) as Row[]).map(
    toSubject,
  );
  const alternativeRows = database
    .prepare(`
      SELECT alternatives.*
      FROM alternatives
      INNER JOIN questions ON questions.id = alternatives.question_id
      INNER JOIN subjects ON subjects.id = questions.subject_id
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      WHERE notebooks.user_id = ?
      ORDER BY alternatives.question_id, alternatives.position
    `)
    .all(userId) as Row[];
  const alternativesByQuestion = alternativeRows.reduce<Record<string, Alternative[]>>(
    (grouped, row) => {
      const questionId = String(row.question_id);
      grouped[questionId] ??= [];
      grouped[questionId].push({
        id: String(row.id),
        label: String(row.label),
        text: String(row.text),
        rationale: String(row.rationale),
        isCorrect: Boolean(row.is_correct),
      });
      return grouped;
    },
    {},
  );
  const questions = (
    database.prepare(`
      SELECT questions.*
      FROM questions
      INNER JOIN subjects ON subjects.id = questions.subject_id
      INNER JOIN notebooks ON notebooks.id = subjects.notebook_id
      WHERE notebooks.user_id = ?
      ORDER BY questions.rowid
    `).all(userId) as Row[]
  ).map<Question>((row) => ({
    id: String(row.id),
    subjectId: String(row.subject_id),
    prompt: String(row.prompt),
    hint: String(row.hint),
    alternatives: alternativesByQuestion[String(row.id)] ?? [],
  }));
  const progress = getProgress(userId);
  const logs = getLogs(userId);
  const cooldown = getCooldown(userId);
  const completedDates = getCompletedDates(userId);
  const settings = getSettings(userId);
  const activeReviewSession = getActiveReviewSession(userId);

  return {
    notebooks,
    subjects,
    questions,
    progress,
    logs,
    cooldown,
    completedDates,
    settings,
    activeReviewSession,
  };
}

export function executeAction(userId: string, action: AppAction) {
  const result = inTransaction(() => {
    switch (action.type) {
      case "import":
        replaceContent(userId, action.content);
        return {};
      case "addNotebook":
        insertNotebook(userId, action.notebook);
        return {};
      case "addSubject":
        insertSubject(userId, action.subject);
        return {};
      case "addQuestion":
        addQuestion(userId, action.question);
        return {};
      case "deleteNotebook":
        abandonActiveReviewSessions(userId);
        if (!statements.deleteNotebook.run(action.notebookId, userId).changes) {
          throw new Error("Caderno não encontrado.");
        }
        return {};
      case "deleteSubject":
        abandonActiveReviewSessions(userId);
        if (!statements.deleteSubject.run(action.subjectId, userId).changes) {
          throw new Error("Matéria não encontrada.");
        }
        return {};
      case "deleteQuestion":
        abandonActiveReviewSessions(userId);
        if (!statements.deleteQuestion.run(action.questionId, userId).changes) {
          throw new Error("Questão não encontrada.");
        }
        return {};
      case "saveSettings":
        saveSettings(userId, action.settings);
        return {};
      case "startReview":
        return startReviewSession(userId, action.questionIds);
      case "answer":
        return registerAnswer(userId, action);
      case "completeReview":
        return completeReviewSession(userId, action.reviewSessionId);
      case "abandonReview":
        return abandonReviewSession(userId, action.reviewSessionId);
      default:
        throw new Error("Ação inválida.");
    }
  });

  const fullStateActions = new Set<AppAction["type"]>([
    "import",
    "addNotebook",
    "addSubject",
    "addQuestion",
    "deleteNotebook",
    "deleteSubject",
    "deleteQuestion",
  ]);

  return {
    state: fullStateActions.has(action.type) ? getAppState(userId) : getReviewRuntimeState(userId),
    result,
  };
}

function toAuthUser(row: Row): AuthUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    plan: String(row.plan) === "pro" ? "pro" : "free",
    onboardingCompleted: Boolean(row.onboarding_completed),
  };
}

function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionDurationMs);
  database
    .prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .run(id, userId, createdAt.toISOString(), expiresAt.toISOString());
  return { id, expiresAt };
}

export function getUserBySession(sessionId: string | undefined): AuthUser | null {
  if (!sessionId) return null;
  database.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(new Date().toISOString());
  const row = database
    .prepare(`
      SELECT users.*
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.expires_at > ?
    `)
    .get(sessionId, new Date().toISOString()) as Row | undefined;
  return row ? toAuthUser(row) : null;
}

export function loginUser(email: string, password: string) {
  const row = database
    .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
    .get(email.trim()) as Row | undefined;
  if (!row) throw new Error("E-mail ou senha inválidos.");
  const expected = Buffer.from(String(row.password_hash), "hex");
  const received = Buffer.from(passwordDigest(password, String(row.password_salt)), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("E-mail ou senha inválidos.");
  }
  const user = toAuthUser(row);
  return { user, session: createSession(user.id), state: getAppState(user.id) };
}

export function registerUser(name: string, email: string, password: string) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedName.length < 2) throw new Error("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Informe um e-mail válido.");
  }
  if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  const userId = randomUUID();
  try {
    inTransaction(() => {
      insertUser(userId, normalizedName, normalizedEmail, password);
      saveSettings(userId, defaultSettings);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw new Error("Já existe uma conta com este e-mail.");
    }
    throw error;
  }
  const user: AuthUser = {
    id: userId,
    name: normalizedName,
    email: normalizedEmail,
    plan: "free",
    onboardingCompleted: false,
  };
  return { user, session: createSession(userId), state: getAppState(userId) };
}

export function logoutSession(sessionId: string | undefined) {
  if (sessionId) database.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export function completeOnboarding(userId: string) {
  database.prepare(`UPDATE users SET onboarding_completed = 1 WHERE id = ?`).run(userId);
  const row = database.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Row | undefined;
  if (!row) throw new Error("Usuário não encontrado.");
  return toAuthUser(row);
}
