import { Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';

export type WorkRequestScope = {
  tenantWide?: boolean;
  clientId?: string;
  companyId?: string;
  divisionId?: string;
  teamId?: string;
};
export type WorkRequestParentScope = {
  clientId: string;
  companyId: string | null;
  divisionId: string | null;
  teamId: string | null;
};
@Injectable()
export class WorkRequestResourceScopeProvider {
  constructor(private readonly scopes: ObjectScopeProvider) {}
  scopeFor(actor: SessionActor): WorkRequestScope {
    const scope = this.scopes.resolve(actor);
    if (scope.tenantWide) return { tenantWide: true };
    if (scope.isSystemRole === false && scope.customScope === 'team') {
      if (!scope.boundTeamId) throw denied();
      return { teamId: scope.boundTeamId };
    }
    if (scope.isSystemRole === false && scope.customScope === 'division') {
      if (
        !scope.member?.active ||
        !scope.member.companyActive ||
        !scope.member.divisionActive
      )
        throw denied();
      return { divisionId: scope.member.divisionId };
    }
    if (scope.clientContact?.active && scope.clientContact.clientActive)
      return { clientId: scope.clientContact.clientId };
    if (scope.member?.active && scope.member.companyActive)
      return { companyId: scope.member.companyId };
    throw denied();
  }
  assert(actor: SessionActor, parent: WorkRequestParentScope): void {
    const scope = this.scopes.resolve(actor);
    if (scope.isSystemRole === false && scope.customScope === 'team') {
      if (!scope.boundTeamId || parent.teamId !== scope.boundTeamId)
        throw denied();
      return;
    }
    if (scope.isSystemRole === false && scope.customScope === 'division') {
      if (
        !scope.member?.active ||
        !scope.member.companyActive ||
        !scope.member.divisionActive ||
        parent.divisionId !== scope.member.divisionId
      )
        throw denied();
      return;
    }
    this.scopes.assertCanAccess(actor, {
      anyOf: [
        { kind: 'client', clientId: parent.clientId },
        ...(parent.companyId
          ? [{ kind: 'memberCompany', companyId: parent.companyId } as const]
          : []),
      ],
      // The parent was read through the current RequestContext tenant. Within
      // that tenant, tenant_super_admin has tenant-wide object scope; custom
      // Division and Team branches above remain more restrictive.
      allowTenantAdmin: true,
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
