import { describe, it, expect } from 'vitest';
import {
  calculateSessionMetrics,
  STALE_RUNNING_THRESHOLD_SECONDS,
} from '../services/timer.service.js';

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
});
