import { CronJob } from 'cron';
import { leaderboardService } from './leaderboard.service.js';
import {
  ASIA_KOLKATA_TIMEZONE,
  getAsiaKolkataDateString,
  getSlotScheduledUtc,
  type LeaderboardSlot,
} from '../utils/timezone.js';

export class SchedulerService {
  private jobs: CronJob[] = [];
  private isRunning = false;

  /**
   * Initializes in-process cron jobs in Asia/Kolkata timezone.
   * Catches up on any due slots on startup and sets up scheduled checkpoints.
   */
  async initScheduler(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log(`[Scheduler] Initializing in-process scheduler (${ASIA_KOLKATA_TIMEZONE})...`);

    // 1. Startup check: catch up on any missed/due slots
    try {
      const initialResults = await leaderboardService.processDueSnapshots();
      const created = initialResults.filter((r) => r.status === 'created');
      if (created.length > 0) {
        console.log(
          `[Scheduler] Startup catchup created ${created.length} missed snapshot(s):`,
          created.map((c) => `${c.date} @ ${c.slot}`)
        );
      }
    } catch (err: any) {
      console.error('[Scheduler] Error during startup catchup:', err?.message || err);
    }

    // 2. Schedule checkpoints: 10:00, 18:00, and 22:00 IST
    const checkpointSlots: Array<{ cronTime: string; slot: LeaderboardSlot }> = [
      { cronTime: '0 10 * * *', slot: '10:00' },
      { cronTime: '0 18 * * *', slot: '18:00' },
      { cronTime: '0 22 * * *', slot: '22:00' },
    ];

    for (const cp of checkpointSlots) {
      const job = CronJob.from({
        cronTime: cp.cronTime,
        onTick: async () => {
          const now = new Date();
          const todayDate = getAsiaKolkataDateString(now);
          const scheduledUtc = getSlotScheduledUtc(todayDate, cp.slot);
          console.log(`[Scheduler] Checkpoint triggered: ${todayDate} @ ${cp.slot} IST`);
          try {
            const run = await leaderboardService.captureSnapshot(todayDate, cp.slot, scheduledUtc, {
              captureTime: now,
            });
            console.log(`[Scheduler] Snapshot captured successfully: runId=${run.id}`);
          } catch (err: any) {
            console.error(`[Scheduler] Failed to capture snapshot for ${todayDate} @ ${cp.slot}:`, err?.message || err);
          }
        },
        start: true,
        timeZone: ASIA_KOLKATA_TIMEZONE,
      });

      this.jobs.push(job);
    }

    // 3. Periodic catchup job running every 15 minutes to guarantee missing slots are captured
    const catchupJob = CronJob.from({
      cronTime: '*/15 * * * *',
      onTick: async () => {
        try {
          const results = await leaderboardService.processDueSnapshots();
          const created = results.filter((r) => r.status === 'created');
          if (created.length > 0) {
            console.log(
              `[Scheduler] Periodic catchup created ${created.length} missing snapshot(s):`,
              created.map((c) => `${c.date} @ ${c.slot}`)
            );
          }
        } catch (err: any) {
          console.error('[Scheduler] Error during periodic catchup:', err?.message || err);
        }
      },
      start: true,
      timeZone: ASIA_KOLKATA_TIMEZONE,
    });

    this.jobs.push(catchupJob);
    this.isRunning = true;
    console.log('[Scheduler] In-process scheduler active (checkpoints at 10:00, 18:00, 22:00 IST).');
  }

  /**
   * Stops all active cron jobs (useful for clean test teardown).
   */
  stopScheduler(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    this.isRunning = false;
  }
}

export const schedulerService = new SchedulerService();
