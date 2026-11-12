import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UnitOfWorkService } from './unit-of-work.service';
import { RESPONSIBILITY_HISTORY } from '../../contracts/work-request-responsibility-history.port';
import { ResponsibilityHistoryAdapter } from './responsibility-history.adapter';
import { RESPONSIBILITY_PROFILE_RESOLVER } from '../../contracts/responsibility-profile-resolver.port';
import { ResponsibilityProfileResolver } from './responsibility-profile.resolver';

@Global()
@Module({
  providers: [
    PrismaService,
    UnitOfWorkService,
    { provide: RESPONSIBILITY_HISTORY, useClass: ResponsibilityHistoryAdapter },
    {
      provide: RESPONSIBILITY_PROFILE_RESOLVER,
      useClass: ResponsibilityProfileResolver,
    },
  ],
  exports: [
    PrismaService,
    UnitOfWorkService,
    RESPONSIBILITY_HISTORY,
    RESPONSIBILITY_PROFILE_RESOLVER,
  ],
})
export class PrismaModule {}
