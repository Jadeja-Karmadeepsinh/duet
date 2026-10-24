import { pgTable, text, integer, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_sessions_profile_id').on(table.profileId),
  index('idx_sessions_token_hash').on(table.tokenHash),
]);

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  plannedDurationSeconds: integer('planned_duration_seconds'),
  category: text('category'),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_tasks_profile_id').on(table.profileId),
  index('idx_tasks_category').on(table.category),
]);

export const workSessions = pgTable('work_sessions', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  snapshotTitle: text('snapshot_title').notNull(),
  snapshotCategory: text('snapshot_category'),
  snapshotPlannedDurationSeconds: integer('snapshot_planned_duration_seconds'),
  mode: text('mode').notNull(), // 'countdown' | 'stopwatch'
  status: text('status').notNull(), // 'running' | 'paused' | 'awaiting_decision' | 'completed' | 'stopped'
  targetDurationSeconds: integer('target_duration_seconds'),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_work_sessions_profile_id').on(table.profileId),
  index('idx_work_sessions_status').on(table.status),
]);

export const workSegments = pgTable('work_segments', {
  id: text('id').primaryKey(),
  workSessionId: text('work_session_id').notNull().references(() => workSessions.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }), // null = active
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_work_segments_session').on(table.workSessionId),
  index('idx_work_segments_profile').on(table.profileId),
  index('idx_work_segments_active').on(table.endedAt),
]);

export const taskCompletions = pgTable('task_completions', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  workSessionId: text('work_session_id').notNull().unique().references(() => workSessions.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }).notNull(),
  completedDateAsiaKolkata: text('completed_date_asia_kolkata').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_task_completions_profile_date').on(table.profileId, table.completedDateAsiaKolkata),
]);

export const leaderboardSnapshots = pgTable('leaderboard_snapshots', {
  id: text('id').primaryKey(),
  snapshotDateAsiaKolkata: text('snapshot_date_asia_kolkata').notNull(), // YYYY-MM-DD
  slot: text('slot').notNull(), // '10:00' | '18:00' | '22:00'
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  todayFocusSeconds: integer('today_focus_seconds').notNull().default(0),
  todayCompletionsCount: integer('today_completions_count').notNull().default(0),
  sevenDayFocusSeconds: integer('seven_day_focus_seconds').notNull().default(0),
  sevenDayCompletionsCount: integer('seven_day_completions_count').notNull().default(0),
  capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'date' }).notNull(),
  isDelayed: boolean('is_delayed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_leaderboard_unique_slot').on(table.snapshotDateAsiaKolkata, table.slot, table.profileId),
  index('idx_leaderboard_date_slot').on(table.snapshotDateAsiaKolkata, table.slot),
]);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type WorkSegment = typeof workSegments.$inferSelect;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type LeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect;
