import { Module } from '@nestjs/common';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberScopeProvider } from './providers';
import {
  MemberAccessRepository,
  MemberRelationsRepository,
  MemberRepository,
} from './repositories';

@Module({
  controllers: [MemberController],
  providers: [
    MemberService,
    MemberRepository,
    MemberAccessRepository,
    MemberRelationsRepository,
    MemberScopeProvider,
  ],
})
export class MemberModule {}
