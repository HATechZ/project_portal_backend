import { Module } from '@nestjs/common';
import { TeamMembershipRepository, TeamRepository } from './repositories';
import { TeamController } from './team.controller';
import { TeamMembershipController } from './team-membership.controller';
import { TeamMembershipService } from './team-membership.service';
import { TeamService } from './team.service';

@Module({
  controllers: [TeamController, TeamMembershipController],
  providers: [
    TeamService,
    TeamMembershipService,
    TeamRepository,
    TeamMembershipRepository,
  ],
})
export class TeamModule {}
