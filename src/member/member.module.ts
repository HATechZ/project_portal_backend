import { Module } from '@nestjs/common';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
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
  ],
})
export class MemberModule {}
