/* eslint-disable @typescript-eslint/unbound-method -- Nest metadata is read from prototype methods. */
import { PATH_METADATA } from '@nestjs/common/constants';
import { PermissionCode } from '../generated/prisma/client';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { BidController } from './bid.controller';

describe('Bid creation document-code selector', () => {
  it('publishes a static creation route protected by CREATE_BID', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        BidController.prototype.creationDocumentCodes,
      ),
    ).toBe('creation/available-document-codes');
    expect(
      Reflect.getMetadata(
        FINAL_PERMISSIONS_KEY,
        BidController.prototype.creationDocumentCodes,
      ),
    ).toEqual([PermissionCode.CREATE_BID]);
  });

  it('blocks a user without CREATE_BID before the selector can disclose codes', async () => {
    const guard = new FinalPermissionsGuard({
      getAllAndOverride: jest.fn().mockReturnValue([PermissionCode.CREATE_BID]),
    } as never);
    const context = {
      getHandler: () => BidController.prototype.creationDocumentCodes,
      getClass: () => BidController,
      switchToHttp: () => ({
        getRequest: () => ({
          actor: {
            isActive: true,
            role: {
              isActive: true,
              customScope: 'company',
              rolePermissions: [
                {
                  revokedAt: null,
                  permission: {
                    code: PermissionCode.VIEW_DOCUMENT_CODES,
                    scopeCompatibilities: [{ scope: 'company' }],
                  },
                },
              ],
            },
          },
        }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing required explicit permission',
    );
  });
});
