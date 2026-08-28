import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionActor } from './session.types';

type AuthenticatedActorRequest = Request & { actor: SessionActor };

export const ActiveActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionActor =>
    context.switchToHttp().getRequest<AuthenticatedActorRequest>().actor,
);
