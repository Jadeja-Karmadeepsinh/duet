import { Router, type Request, type Response } from 'express';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks } from '../db/schema/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type ListTasksQuery,
} from '../schemas/task.js';
import { NotFoundError, asyncHandler } from '../utils/errors.js';

export const taskRouter = Router();

// Protect all task endpoints with authentication
taskRouter.use(requireAuth);

/**
 * GET /api/v1/tasks
 * List tasks owned by the authenticated profile.
 * Query: status = 'active' | 'archived' | 'all' (default: 'active')
 */
taskRouter.get(
  '/',
  validateQuery(listTasksQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = req.query as unknown as ListTasksQuery;
    const statusFilter = query.status || 'active';

    const conditions = [eq(tasks.ownerUserId, userId)];

    if (statusFilter === 'active') {
      conditions.push(eq(tasks.status, 'active'));
    } else if (statusFilter === 'archived') {
      conditions.push(eq(tasks.status, 'archived'));
    }

    const taskList = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt));

    res.status(200).json({
      success: true,
      data: {
        tasks: taskList,
      },
    });
  })
);

/**
 * GET /api/v1/tasks/:id
 * Retrieve a specific task by ID.
 * Returns 404 if the task does not exist or belongs to another user.
 */
taskRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const taskId = String(req.params.id);

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .limit(1);

    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    res.status(200).json({
      success: true,
      data: {
        task,
      },
    });
  })
);

/**
 * POST /api/v1/tasks
 * Create a new reusable task template for the authenticated profile.
 */
taskRouter.post(
  '/',
  validateBody(createTaskSchema),
  asyncHandler(async (req: Request<{}, {}, CreateTaskInput>, res: Response) => {
    const userId = req.user!.id;
    const { title, description, plannedDurationSeconds, category } = req.body;

    const [newTask] = await db
      .insert(tasks)
      .values({
        ownerUserId: userId,
        title,
        description: description || null,
        plannedDurationSeconds: plannedDurationSeconds || null,
        category: category || null,
        status: 'active',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        task: newTask,
      },
    });
  })
);

/**
 * PATCH /api/v1/tasks/:id
 * Update an existing task owned by the authenticated profile.
 * Returns 404 if not found or not owned.
 */
taskRouter.patch(
  '/:id',
  validateBody(updateTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const taskId = String(req.params.id);

    // 1. Verify existence and ownership
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError('Task not found.');
    }

    // 2. Prepare update values
    const now = new Date();
    const updateData: Partial<typeof tasks.$inferInsert> = {
      updatedAt: now,
    };

    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.plannedDurationSeconds !== undefined) {
      updateData.plannedDurationSeconds = req.body.plannedDurationSeconds;
    }
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
      if (req.body.status === 'archived') {
        updateData.archivedAt = now;
      } else if (req.body.status === 'active') {
        updateData.archivedAt = null;
      }
    }

    // 3. Apply update
    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .returning();

    res.status(200).json({
      success: true,
      data: {
        task: updatedTask,
      },
    });
  })
);

/**
 * DELETE /api/v1/tasks/:id
 * Soft-archive a task. Preserves historical work sessions and completions.
 * Returns 404 if not found or not owned.
 */
taskRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const taskId = String(req.params.id);

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError('Task not found.');
    }

    const now = new Date();
    const [archivedTask] = await db
      .update(tasks)
      .set({
        status: 'archived',
        archivedAt: now,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .returning();

    res.status(200).json({
      success: true,
      data: {
        message: 'Task archived successfully.',
        task: archivedTask,
      },
    });
  })
);

/**
 * POST /api/v1/tasks/:id/unarchive
 * Unarchive a previously archived task.
 */
taskRouter.post(
  '/:id/unarchive',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const taskId = String(req.params.id);

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError('Task not found.');
    }

    const now = new Date();
    const [unarchivedTask] = await db
      .update(tasks)
      .set({
        status: 'active',
        archivedAt: null,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .returning();

    res.status(200).json({
      success: true,
      data: {
        message: 'Task unarchived successfully.',
        task: unarchivedTask,
      },
    });
  })
);
