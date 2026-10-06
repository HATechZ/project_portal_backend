import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../generated/prisma/client';

export const FINAL_PERMISSIONS_KEY = 'final_permissions';
export const FinalPermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(FINAL_PERMISSIONS_KEY, permissions);
