import { MemberEligibilityRepository } from './repositories/member-eligibility.repository';
import { MemberEligibilityController } from './member-eligibility.controller';
import { MemberEligibilityService } from './member-eligibility.service';
import { Module } from '@nestjs/common';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import {
  MemberAccessRepository,
  MemberExistingUserOnboardingRepository,
  MemberOnboardingRepository,
  MemberRelationsRepository,
  MemberRemovalRepository,
  MemberRepository,
} from './repositories';

@Module({
  controllers: [MemberEligibilityController, MemberController],
  providers: [
    MemberService,
    MemberEligibilityService,
    MemberEligibilityRepository,
    MemberRepository,
    MemberAccessRepository,
    MemberExistingUserOnboardingRepository,
    MemberOnboardingRepository,
    MemberRelationsRepository,
    MemberRemovalRepository,
  ],
})
export class MemberModule {}
