import { SetMetadata } from '@nestjs/common';
import { WorkflowActionCode } from '../../generated/prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: WorkflowActionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
