import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { PermissionCode } from '../generated/prisma/client';
import { TeamController } from './team.controller';

describe('Team Lead removal route authorization', () => {
  it('uses the same explicit permission guard as Team Lead assignment', () => {
    const controller = TeamController.prototype as unknown as Record<
      string,
      object
    >;

    expect(Reflect.getMetadata(GUARDS_METADATA, TeamController)).toContain(
      FinalPermissionsGuard,
    );
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, controller.assignLead),
    ).toEqual([PermissionCode.UPDATE_TEAM]);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, controller.removeLead),
    ).toEqual([PermissionCode.UPDATE_TEAM]);
  });
});
