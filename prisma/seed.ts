import { runSeed } from './seed/main';

void runSeed().catch((error: unknown) => {
  console.error('Database seeding failed', error);
  process.exitCode = 1;
});
