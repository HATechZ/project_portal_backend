import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { SessionActor } from '../../common/security/session.types';

/**
 * The client/client_contact compatibility tiers permit an external role to hold a
 * document permission. This feature-owned check supplies the separate exposure
 * rule: the profile's active ClientContact must belong to the Work Request parent.
 */
export function assertWorkRequestExternalClientAccess(
  actor: SessionActor,
  parent: { clientId: string } | null | undefined,
): void {
  if (
    actor.role.customScope !== 'client' &&
    actor.role.customScope !== 'client_contact'
  )
    return;

  const contact = actor.clientContact;
  if (
    !parent ||
    !contact?.isActive ||
    !contact.client.isActive ||
    contact.clientId !== parent.clientId
  )
    throw new AppException({
      code: AppErrorCode.Forbidden,
      status: HttpStatus.FORBIDDEN,
      message: 'Client portal access is not available for this resource.',
    });
}
