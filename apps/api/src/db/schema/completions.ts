import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { tasks } from './tasks.js';
import { workSessions } from './sessions.js';

export const taskCompletions = pgTable('task_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  workSessionId: uuid('work_session_id').notNull().unique().references(() => workSessions.id, { onDelete: 'cascade' }),
  taskTitleSnapshot: text('task_title_snapshot').notNull(),
  categorySnapshot: text('category_snapshot'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_task_completions_user_completed_at').on(table.userId, table.completedAt),
  index('idx_task_completions_task_id').on(table.taskId),
]);

export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type NewTaskCompletion = typeof taskCompletions.$inferInsert;
