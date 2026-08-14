import { PrismaClient } from '../../src/generated/prisma/client';

export interface SeedContext {
  prisma: PrismaClient;
  admin: {
    email: string;
    fullName: string;
    password: string;
  };
}

export interface Seeder {
  readonly name: string;
  run(context: SeedContext): Promise<void>;
}
