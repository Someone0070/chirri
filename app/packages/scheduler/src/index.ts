import 'dotenv/config';

console.log('🐦 Chirri Scheduler started');

// TODO: Implement scheduler
// - Enqueue URL checks based on next_check_at
// - Create monthly check_results partitions
// - Drop expired check_results partitions
// - Refresh domain_user_counts
// - Source check scheduling

// Placeholder: Keep process alive
setInterval(() => {
  // Scheduler tick
}, 60_000);

process.on('SIGTERM', () => {
  console.log('Scheduler shutting down...');
  process.exit(0);
});
