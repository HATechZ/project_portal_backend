import { Module } from '@nestjs/common';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberScopeProvider } from './providers';
import {
  MemberAccessRepository,
  MemberOnboardingRepository,
  MemberRelationsRepository,
  MemberRemovalRepository,
  MemberRepository,
} from './repositories';

@Module({
  controllers: [MemberController],
  providers: [
    MemberService,
    MemberRepository,
    MemberAccessRepository,
    MemberOnboardingRepository,
    MemberRelationsRepository,
    MemberRemovalRepository,
    MemberScopeProvider,
  ],
})
export class MemberModule {}
