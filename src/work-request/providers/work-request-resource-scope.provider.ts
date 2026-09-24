import { Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';

export type WorkRequestScope = {
  tenantWide?: boolean;
  clientId?: string;
  companyId?: string;
};
export type WorkRequestParentScope = {
  clientId: string;
  companyId: string | null;
};
@Injectable()
export class WorkRequestResourceScopeProvider {
  constructor(private readonly scopes: ObjectScopeProvider) {}
  scopeFor(actor: SessionActor): WorkRequestScope {
    const scope = this.scopes.resolve(actor);
    if (scope.tenantWide) return { tenantWide: true };
    if (scope.clientContact?.active && scope.clientContact.clientActive)
      return { clientId: scope.clientContact.clientId };
    if (scope.member?.active && scope.member.companyActive)
      return { companyId: scope.member.companyId };
    throw denied();
  }
  assert(actor: SessionActor, parent: WorkRequestParentScope): void {
    this.scopes.assertCanAccess(actor, {
      anyOf: [
        { kind: 'client', clientId: parent.clientId },
        ...(parent.companyId
          ? [{ kind: 'memberCompany', companyId: parent.companyId } as const]
          : []),
      ],
      allowTenantAdmin: false,
    });
  }
}
function denied() {
  return new AppException({
    code: AppErrorCode.OutOfScope,
    status: 403,
    message: "You don't have access to this resource.",
  });
}
