import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { tasks } from './tasks.js';

export const workSessions = pgTable('work_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  mode: text('mode', { enum: ['countdown', 'stopwatch'] }).notNull(),
  status: text('status', { enum: ['running', 'paused', 'awaiting_decision', 'completed', 'stopped'] }).notNull(),
  targetDurationSeconds: integer('target_duration_seconds'),
  trackedSeconds: integer('tracked_seconds').default(0).notNull(),
  taskTitleSnapshot: text('task_title_snapshot').notNull(),
  categorySnapshot: text('category_snapshot'),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  check('tracked_seconds_nonnegative', sql`${table.trackedSeconds} >= 0`),
  check('countdown_target_positive', sql`${table.mode} != 'countdown' OR (${table.targetDurationSeconds} IS NOT NULL AND ${table.targetDurationSeconds} > 0)`),
  uniqueIndex('idx_work_sessions_single_running').on(table.userId).where(sql`${table.status} = 'running'`),
  index('idx_work_sessions_user_status').on(table.userId, table.status),
  index('idx_work_sessions_task_id').on(table.taskId),
]);

export const workSessionSegments = pgTable('work_session_segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  workSessionId: uuid('work_session_id').notNull().references(() => workSessions.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_segments_single_open').on(table.workSessionId).where(sql`${table.endedAt} IS NULL`),
  index('idx_segments_session_started_at').on(table.workSessionId, table.startedAt),
]);

export type WorkSession = typeof workSessions.$inferSelect;
export type NewWorkSession = typeof workSessions.$inferInsert;
export type WorkSessionSegment = typeof workSessionSegments.$inferSelect;
export type NewWorkSessionSegment = typeof workSessionSegments.$inferInsert;
