import { describe, it, expect } from 'vitest';
import {
  calculateSessionMetrics,
  STALE_RUNNING_THRESHOLD_SECONDS,
} from '../services/timer.service.js';
import { formatTimerDisplay } from '../utils/format.js';

describe('Timer Domain Logic - Pure Function Unit Tests', () => {
  const baseDate = new Date('2026-10-24T10:00:00.000Z');

  describe('Stopwatch Calculations', () => {
    it('calculates elapsed time correctly for an open segment', () => {
      const session = {
        mode: 'stopwatch' as const,
        status: 'running' as const,
        targetDurationSeconds: null,
        trackedSeconds: 120, // 2 minutes from earlier segments
      };
      // 45 seconds elapsed in current open segment
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - 45 * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.elapsedSeconds).toBe(165);
      expect(metrics.remainingSeconds).toBeNull();
      expect(metrics.isExpired).toBe(false);
      expect(metrics.activeSegmentSeconds).toBe(45);
      expect(metrics.staleRunningWarning).toBe(false);
    });

    it('calculates elapsed time correctly when stopwatch is paused', () => {
      const session = {
        mode: 'stopwatch' as const,
        status: 'paused' as const,
        targetDurationSeconds: null,
        trackedSeconds: 300,
      };

      const metrics = calculateSessionMetrics(session, null, baseDate);
      expect(metrics.elapsedSeconds).toBe(300);
      expect(metrics.remainingSeconds).toBeNull();
      expect(metrics.isExpired).toBe(false);
      expect(metrics.activeSegmentSeconds).toBe(0);
    });
  });

  describe('Countdown Calculations & Zero-Crossing', () => {
    it('calculates remaining and elapsed time mid-countdown', () => {
      const targetDurationSeconds = 1500; // 25 minutes
      const session = {
        mode: 'countdown' as const,
        status: 'running' as const,
        targetDurationSeconds,
        trackedSeconds: 300, // 5 minutes previously tracked
      };
      // 200 seconds in current open segment
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - 200 * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.elapsedSeconds).toBe(500);
      expect(metrics.remainingSeconds).toBe(1000);
      expect(metrics.isExpired).toBe(false);
    });

    it('detects exact zero crossing', () => {
      const targetDurationSeconds = 1500;
      const session = {
        mode: 'countdown' as const,
        status: 'running' as const,
        targetDurationSeconds,
        trackedSeconds: 500,
      };
      // 1000 seconds in segment = exactly 1500s total
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - 1000 * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.elapsedSeconds).toBe(1500);
      expect(metrics.remainingSeconds).toBe(0);
      expect(metrics.isExpired).toBe(true);
    });

    it('caps elapsed at targetDurationSeconds when segment extends past zero (laptop asleep / delay)', () => {
      const targetDurationSeconds = 1500;
      const session = {
        mode: 'countdown' as const,
        status: 'running' as const,
        targetDurationSeconds,
        trackedSeconds: 500,
      };
      // 2000 seconds passed since segment started (overshot by 1000s)
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - 2000 * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.elapsedSeconds).toBe(1500); // capped at target
      expect(metrics.remainingSeconds).toBe(0);
      expect(metrics.isExpired).toBe(true);
    });

    it('calculates metrics for awaiting_decision session', () => {
      const targetDurationSeconds = 1500;
      const session = {
        mode: 'countdown' as const,
        status: 'awaiting_decision' as const,
        targetDurationSeconds,
        trackedSeconds: 1500,
      };

      const metrics = calculateSessionMetrics(session, null, baseDate);
      expect(metrics.elapsedSeconds).toBe(1500);
      expect(metrics.remainingSeconds).toBe(0);
      expect(metrics.isExpired).toBe(true);
      expect(metrics.activeSegmentSeconds).toBe(0);
      expect(metrics.staleRunningWarning).toBe(false);
    });
  });

  describe('Stale Running Session Warning', () => {
    it('flags stale warning when active running segment exceeds 12 hours', () => {
      const targetDurationSeconds = 86400;
      const session = {
        mode: 'countdown' as const,
        status: 'running' as const,
        targetDurationSeconds,
        trackedSeconds: 0,
      };
      // 12 hours + 10 seconds
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - (STALE_RUNNING_THRESHOLD_SECONDS + 10) * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.staleRunningWarning).toBe(true);
      expect(metrics.activeSegmentSeconds).toBe(STALE_RUNNING_THRESHOLD_SECONDS + 10);
    });

    it('does not flag stale warning when running segment is under 12 hours', () => {
      const session = {
        mode: 'stopwatch' as const,
        status: 'running' as const,
        targetDurationSeconds: null,
        trackedSeconds: 0,
      };
      // 11 hours 59 minutes
      const openSegment = {
        startedAt: new Date(baseDate.getTime() - (STALE_RUNNING_THRESHOLD_SECONDS - 60) * 1000),
      };

      const metrics = calculateSessionMetrics(session, openSegment, baseDate);
      expect(metrics.staleRunningWarning).toBe(false);
    });
  });

  describe('Duration Formatting (formatTimerDisplay)', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatTimerDisplay(0)).toBe('00:00');
    });

    it('formats 45 seconds as 00:45', () => {
      expect(formatTimerDisplay(45)).toBe('00:45');
    });

    it('formats 59:59 (3599 seconds) as 59:59', () => {
      expect(formatTimerDisplay(3599)).toBe('59:59');
    });

    it('formats 60:00 (3600 seconds = 1 hour) as 01:00:00', () => {
      expect(formatTimerDisplay(3600)).toBe('01:00:00');
    });

    it('formats 90 minutes (5400 seconds) as 01:30:00', () => {
      expect(formatTimerDisplay(5400)).toBe('01:30:00');
    });

    it('formats 150 minutes (9000 seconds) as 02:30:00', () => {
      expect(formatTimerDisplay(9000)).toBe('02:30:00');
    });

    it('formats 24 hours (86400 seconds) without wrapping as 24:00:00', () => {
      expect(formatTimerDisplay(86400)).toBe('24:00:00');
    });

    it('formats 27 hours (97200 seconds) without wrapping as 27:00:00', () => {
      expect(formatTimerDisplay(97200)).toBe('27:00:00');
    });

    it('formats 99 hours (356400 seconds) as 99:00:00', () => {
      expect(formatTimerDisplay(356400)).toBe('99:00:00');
    });

    it('formats 100 hours (360000 seconds) without truncating as 100:00:00', () => {
      expect(formatTimerDisplay(360000)).toBe('100:00:00');
    });

    it('handles negative, NaN, null, and undefined values defensively as 00:00', () => {
      expect(formatTimerDisplay(-50)).toBe('00:00');
      expect(formatTimerDisplay(NaN)).toBe('00:00');
      expect(formatTimerDisplay(null)).toBe('00:00');
      expect(formatTimerDisplay(undefined)).toBe('00:00');
    });
  });

  describe('Paused Elapsed Time Calculations & Immunity to Clock Ticks', () => {
    it('freezes elapsed and remaining time when countdown is paused', () => {
      const targetDurationSeconds = 1500;
      const session = {
        mode: 'countdown' as const,
        status: 'paused' as const,
        targetDurationSeconds,
        trackedSeconds: 600, // 10 minutes tracked before pause
      };

      const metricsAtPause = calculateSessionMetrics(session, null, baseDate);
      expect(metricsAtPause.elapsedSeconds).toBe(600);
      expect(metricsAtPause.remainingSeconds).toBe(900);
      expect(metricsAtPause.isExpired).toBe(false);
      expect(metricsAtPause.activeSegmentSeconds).toBe(0);

      // Advance clock by 10 seconds, 60 seconds, and 2 hours: paused values must remain strictly unchanged
      const tick10s = new Date(baseDate.getTime() + 10 * 1000);
      const tick60s = new Date(baseDate.getTime() + 60 * 1000);
      const tick2hr = new Date(baseDate.getTime() + 7200 * 1000);

      const metricsAfter10s = calculateSessionMetrics(session, null, tick10s);
      expect(metricsAfter10s.elapsedSeconds).toBe(600);
      expect(metricsAfter10s.remainingSeconds).toBe(900);

      const metricsAfter60s = calculateSessionMetrics(session, null, tick60s);
      expect(metricsAfter60s.elapsedSeconds).toBe(600);
      expect(metricsAfter60s.remainingSeconds).toBe(900);

      const metricsAfter2hr = calculateSessionMetrics(session, null, tick2hr);
      expect(metricsAfter2hr.elapsedSeconds).toBe(600);
      expect(metricsAfter2hr.remainingSeconds).toBe(900);
    });

    it('resumes tracking from accumulated trackedSeconds when session is resumed', () => {
      const targetDurationSeconds = 1500;
      // Resumed session: status is running, trackedSeconds is preserved from earlier pause, open segment starts at now
      const session = {
        mode: 'countdown' as const,
        status: 'running' as const,
        targetDurationSeconds,
        trackedSeconds: 600,
      };
      // 15 seconds into the newly resumed segment
      const resumeStartedAt = new Date(baseDate.getTime());
      const nowAfterResume = new Date(baseDate.getTime() + 15 * 1000);
      const openSegment = { startedAt: resumeStartedAt };

      const metrics = calculateSessionMetrics(session, openSegment, nowAfterResume);
      expect(metrics.elapsedSeconds).toBe(615); // 600 tracked + 15 active
      expect(metrics.remainingSeconds).toBe(885);
      expect(metrics.activeSegmentSeconds).toBe(15);
    });
  });

  describe('Race Condition & Stale Cache Overwrite Guard', () => {
    it('rejects stale pre-pause response when cache holds newer paused state', () => {
      // Simulation of frontend state reconciliation logic:
      const t0 = new Date('2026-10-24T10:00:00.000Z');
      const t1 = new Date('2026-10-24T10:00:02.000Z'); // Pause occurred at T1

      // 1. Mutation sets cache to paused at t1
      let currentSession = {
        id: 'sess-1',
        status: 'paused',
        trackedSeconds: 120,
        updatedAt: t1.toISOString(),
      };
      let latestUpdatedAt = new Date(currentSession.updatedAt).getTime();

      // 2. Slow GET /current initiated at t0 arrives at t2 (t2 > t1) with t0 timestamp and status 'running'
      const staleIncomingResponse = {
        id: 'sess-1',
        status: 'running',
        trackedSeconds: 118,
        updatedAt: t0.toISOString(),
      };

      const incomingTime = new Date(staleIncomingResponse.updatedAt).getTime();
      let stateWasOverwritten = false;

      // Guard rule: discard incoming if incomingTime < latestUpdatedAt
      if (incomingTime >= latestUpdatedAt) {
        currentSession = staleIncomingResponse;
        latestUpdatedAt = incomingTime;
        stateWasOverwritten = true;
      }

      // Verifications:
      expect(stateWasOverwritten).toBe(false);
      expect(currentSession.status).toBe('paused');
      expect(currentSession.trackedSeconds).toBe(120);
    });
  });
});
