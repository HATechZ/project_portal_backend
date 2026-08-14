import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from '../repositories';

type AuthenticatedRequest = Request & { user: SessionUser };

export const ActiveUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
