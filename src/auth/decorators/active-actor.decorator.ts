import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionActor } from '../repositories';

type AuthenticatedActorRequest = Request & { actor: SessionActor };

export const ActiveActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionActor =>
    context.switchToHttp().getRequest<AuthenticatedActorRequest>().actor,
);
