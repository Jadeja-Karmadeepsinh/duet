import { leaderboardService } from '../services/leaderboard.service.js';
import { getAsiaKolkataDateString, getSlotScheduledUtc, type LeaderboardSlot } from '../utils/timezone.js';

async function main() {
  console.log('='.repeat(60));
  console.log('📸 Focus Tracker: Manual Snapshot Tool (Local Dev / CLI)');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];
  const slotArg = args.find((a) => a.startsWith('--slot='))?.split('=')[1] as LeaderboardSlot | undefined;

  try {
    if (dateArg && slotArg) {
      console.log(`Targeting explicit slot: ${dateArg} @ ${slotArg} IST...`);
      const scheduledUtc = getSlotScheduledUtc(dateArg, slotArg);
      const run = await leaderboardService.captureSnapshot(dateArg, slotArg, scheduledUtc);
      console.log(`✅ Snapshot captured successfully!`);
      console.log(`   Run ID:       ${run.id}`);
      console.log(`   Local Date:   ${run.localDate}`);
      console.log(`   Slot:         ${run.slot}`);
      console.log(`   Delayed:      ${run.isDelayed}`);
      console.log(`   Captured At:  ${run.capturedAt.toISOString()}`);
    } else {
      console.log('Processing all due / missing snapshot slots...');
      const results = await leaderboardService.processDueSnapshots();
      console.log(`✅ Processed ${results.length} slot check(s):`);
      for (const res of results) {
        const icon = res.status === 'created' ? '✨' : res.status === 'already_exists' ? '✓' : '❌';
        console.log(`   ${icon} ${res.date} @ ${res.slot}: ${res.status} (runId: ${res.runId || 'none'})`);
        if (res.error) {
          console.log(`      Error: ${res.error}`);
        }
      }
    }

    console.log('='.repeat(60));
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed to run snapshot:', err?.message || err);
    process.exit(1);
  }
}

main();
