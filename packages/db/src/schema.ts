// packages/db/src/schema.ts
import { boolean, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Data model per AGENTS.md §11. Topologies stored as versioned JSON:
// every topology_json carries { schema_version, ... } and migrations
// must preserve historical attempts.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  githubId: text("github_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conceptsProgress = pgTable("concepts_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  concept: text("concept").notNull(),
  stageCompleted: text("stage_completed").array().notNull().default([]),
  mastery: real("mastery").notNull().default(0),
  lastReviewed: timestamp("last_reviewed"),
  nextDue: timestamp("next_due"),
});

export const predictions = pgTable("predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  lab: text("lab").notNull(),
  predicted: real("predicted").notNull(),
  actual: real("actual").notNull(),
  error: real("error").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  problem: text("problem").notNull(),
  phase: text("phase").notNull(),
  topologyJson: jsonb("topology_json").notNull(),
  transcript: jsonb("transcript"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
});

export const verdicts = pgTable("verdicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .references(() => attempts.id)
    .notNull(),
  verdictId: text("verdict_id").notNull(),
  passed: boolean("passed").notNull(),
  observed: real("observed"),
  threshold: real("threshold"),
});

export const grades = pgTable("grades", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .references(() => attempts.id)
    .notNull(),
  dimension: text("dimension").notNull(),
  score: real("score").notNull(),
  grader: text("grader").notNull(),
  rubricVersion: text("rubric_version").notNull(),
  modelVersion: text("model_version"),
});

export const reviewItems = pgTable("review_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  sourceVerdict: text("source_verdict").notNull(),
  fsrsState: jsonb("fsrs_state").notNull(),
  dueAt: timestamp("due_at").notNull(),
});
