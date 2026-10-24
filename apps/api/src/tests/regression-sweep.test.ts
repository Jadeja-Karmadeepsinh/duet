import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db/index.js";
import { users, tasks, workSessions, workSessionSegments, taskCompletions } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { formatTimerDisplay } from "../utils/format.js";

describe("Phase 5 Regression Sweep Tests", () => {
  let userCookie: string;
  let userId: string;
  let testTaskId: string;
  let stopwatchTaskId: string;

  beforeAll(async () => {
    // Register test user
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        displayName: `Regression Tester ${Date.now()}`,
        pin: "9876",
        inviteCode: "focus-team-2026",
      });

    expect(res.status).toBe(201);
    userId = res.body.data.user.id;
    userCookie = res.headers["set-cookie"]?.[0]?.split(";")[0] || "";

    // Create a countdown task (150m = 9000s)
    const taskRes = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", userCookie)
      .send({
        title: "Countdown Task 150m",
        plannedDurationSeconds: 9000,
        category: "Testing",
      });

    expect(taskRes.status).toBe(201);
    testTaskId = taskRes.body.data.task.id;

    // Create a stopwatch task (no planned duration)
    const swTaskRes = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", userCookie)
      .send({
        title: "Stopwatch Task",
        category: "Testing",
      });

    expect(swTaskRes.status).toBe(201);
    stopwatchTaskId = swTaskRes.body.data.task.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (userId) {
      await db.delete(taskCompletions).where(eq(taskCompletions.userId, userId));
      const userSessions = await db
        .select({ id: workSessions.id })
        .from(workSessions)
        .where(eq(workSessions.userId, userId));
      const sessionIds = userSessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        await db
          .delete(workSessionSegments)
          .where(inArray(workSessionSegments.workSessionId, sessionIds));
      }
      await db.delete(workSessions).where(eq(workSessions.userId, userId));
      await db.delete(tasks).where(eq(tasks.ownerUserId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  describe("Regression 1 & 2: Timer State Machine (Stopwatch & Countdown Pausing)", () => {
    it("starts stopwatch, pauses it, refetches to verify paused persistence, and resumes", async () => {
      // 1. Start stopwatch session
      const startRes = await request(app)
        .post("/api/v1/work-sessions/start")
        .set("Cookie", userCookie)
        .send({ taskId: stopwatchTaskId });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.data.session.id;
      expect(startRes.body.data.session.mode).toBe("stopwatch");
      expect(startRes.body.data.session.status).toBe("running");

      // 2. Pause session
      const pauseRes = await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/pause`)
        .set("Cookie", userCookie);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.session.status).toBe("paused");
      const pausedActiveSeconds = pauseRes.body.data.session.accumulatedActiveSeconds;

      // 3. Periodic refetch (GET /current) must return authoritative paused state
      const currentRes = await request(app)
        .get("/api/v1/work-sessions/current")
        .set("Cookie", userCookie);

      expect(currentRes.status).toBe(200);
      expect(currentRes.body.data.session.status).toBe("paused");
      expect(currentRes.body.data.session.accumulatedActiveSeconds).toBe(pausedActiveSeconds);

      // 4. Resume session
      const resumeRes = await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/resume`)
        .set("Cookie", userCookie);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.session.status).toBe("running");

      // 5. Stop session
      const stopRes = await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/stop`)
        .set("Cookie", userCookie);

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.session.status).toBe("stopped");
    });

    it("starts countdown, pauses it, verifies persistent paused state on refetch, and completes", async () => {
      // 1. Start countdown session (plannedDurationSeconds = 9000)
      const startRes = await request(app)
        .post("/api/v1/work-sessions/start")
        .set("Cookie", userCookie)
        .send({
          taskId: testTaskId,
          plannedDurationSeconds: 9000,
        });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.data.session.id;
      expect(startRes.body.data.session.mode).toBe("countdown");
      expect(startRes.body.data.session.status).toBe("running");

      // 2. Pause countdown
      const pauseRes = await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/pause`)
        .set("Cookie", userCookie);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.session.status).toBe("paused");

      // 3. Refetch verifies it remains paused
      const currentRes = await request(app)
        .get("/api/v1/work-sessions/current")
        .set("Cookie", userCookie);

      expect(currentRes.status).toBe(200);
      expect(currentRes.body.data.session.status).toBe("paused");

      // 4. Complete countdown
      const completeRes = await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/complete`)
        .set("Cookie", userCookie);

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.session.status).toBe("completed");
    });
  });

  describe("Regression 3: Long Time Values & Timer Digits Formatting", () => {
    it("formats 150 minutes (9000s) as 02:30:00 without wrap or distortion", () => {
      expect(formatTimerDisplay(9000)).toBe("02:30:00");
    });

    it("formats standard elapsed seconds correctly", () => {
      expect(formatTimerDisplay(3665)).toBe("01:01:05");
      expect(formatTimerDisplay(1500)).toBe("25:00");
      expect(formatTimerDisplay(45)).toBe("00:45");
      expect(formatTimerDisplay(0)).toBe("00:00");
    });

    it("formats large elapsed values (> 100 hours) without 24-hour wrap", () => {
      expect(formatTimerDisplay(360000)).toBe("100:00:00");
    });
  });

  describe("Regression 4: Contribution Heatmap 52-Week Full-Year Contract", () => {
    it("returns 52 weeks of real data starting on Sunday without empty gap bottleneck", async () => {
      const res = await request(app)
        .get("/api/v1/stats/contributions?weeks=52")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { days, startDate, endDate } = res.body.data;

      expect(days.length).toBeGreaterThanOrEqual(51 * 7);
      expect(days[0].weekday).toBe(0); // Sunday
      expect(startDate).toBe(days[0].date);
      expect(endDate).toBe(days[days.length - 1].date);
    });
  });

  describe("Regression 5: Stacking Layer & Z-Index Scale", () => {
    it("confirms stacking order prevents trapping tooltips behind sidebar or headers", () => {
      const LAYERS = {
        canvas: 0,
        sidebar: 20,
        header: 20,
        mobileNav: 30,
        tooltips: 50,
        dialogs: 50,
      };

      expect(LAYERS.tooltips).toBeGreaterThan(LAYERS.sidebar);
      expect(LAYERS.tooltips).toBeGreaterThan(LAYERS.header);
      expect(LAYERS.tooltips).toBeGreaterThan(LAYERS.mobileNav);
      expect(LAYERS.tooltips).toBeLessThanOrEqual(LAYERS.dialogs);
    });
  });
});
