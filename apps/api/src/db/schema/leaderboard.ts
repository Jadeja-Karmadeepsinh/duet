import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const leaderboardSnapshotRuns = pgTable('leaderboard_snapshot_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  localDate: text('local_date').notNull(), // YYYY-MM-DD for Asia/Kolkata
  slot: text('slot', { enum: ['10:00', '18:00', '22:00'] }).notNull(),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  isDelayed: boolean('is_delayed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_leaderboard_runs_date_slot').on(table.localDate, table.slot),
]);

export const leaderboardSnapshotEntries = pgTable('leaderboard_snapshot_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  snapshotRunId: uuid('snapshot_run_id').notNull().references(() => leaderboardSnapshotRuns.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  displayNameSnapshot: text('display_name_snapshot').notNull(),
  focusSecondsToday: integer('focus_seconds_today').default(0).notNull(),
  completedTasksToday: integer('completed_tasks_today').default(0).notNull(),
  focusSecondsLast7Days: integer('focus_seconds_last_7_days').default(0).notNull(),
  completedTasksLast7Days: integer('completed_tasks_last_7_days').default(0).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  check('entry_focus_today_nonneg', sql`${table.focusSecondsToday} >= 0`),
  check('entry_tasks_today_nonneg', sql`${table.completedTasksToday} >= 0`),
  check('entry_focus_7d_nonneg', sql`${table.focusSecondsLast7Days} >= 0`),
  check('entry_tasks_7d_nonneg', sql`${table.completedTasksLast7Days} >= 0`),
  uniqueIndex('idx_leaderboard_entry_run_user').on(table.snapshotRunId, table.userId),
]);

export type LeaderboardSnapshotRun = typeof leaderboardSnapshotRuns.$inferSelect;
export type NewLeaderboardSnapshotRun = typeof leaderboardSnapshotRuns.$inferInsert;
export type LeaderboardSnapshotEntry = typeof leaderboardSnapshotEntries.$inferSelect;
export type NewLeaderboardSnapshotEntry = typeof leaderboardSnapshotEntries.$inferInsert;
