import { pgTable, uuid, text, integer, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  plannedDurationSeconds: integer('planned_duration_seconds'),
  category: text('category'),
  status: text('status', { enum: ['active', 'archived'] }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  check('planned_duration_positive_check', sql`${table.plannedDurationSeconds} IS NULL OR ${table.plannedDurationSeconds} > 0`),
  index('idx_tasks_owner_status').on(table.ownerUserId, table.status),
  index('idx_tasks_owner_updated_at').on(table.ownerUserId, table.updatedAt),
]);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
