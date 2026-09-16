import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { ActorProfileResponseDto } from './dtos';
import {
  ActorProfileRecord,
  ActorProfileRepository,
} from './repositories/actor-profile.repository';

@Injectable()
export class ActorProfileService {
  constructor(private readonly repository: ActorProfileRepository) {}

  async findForUser(userId: string): Promise<ActorProfileResponseDto[]> {
    return (await this.repository.findForUser(userId)).map(this.toResponse);
  }

  async activate(id: string, userId: string): Promise<ActorProfileResponseDto> {
    const actor = await this.repository.setDefault(id, userId);
    if (!actor) {
      throw new ForbiddenException(
        'Actor profile is unavailable for this account',
      );
    }
    RequestContext.setActorId(actor.id);
    return this.toResponse(actor);
  }

  private readonly toResponse = (
    actor: ActorProfileRecord,
  ): ActorProfileResponseDto => ({
    id: actor.id,
    roleId: actor.roleId,
    roleCode: actor.role.systemRole?.systemCode ?? actor.role.customCode!,
    label: actor.label,
    memberId: actor.memberId,
    clientContactId: actor.clientContactId,
    isDefault: actor.isDefault,
    isActive: actor.isActive,
  });
}
