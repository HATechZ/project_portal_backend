import { ForbiddenException, Injectable } from '@nestjs/common';
import { ActorRoleCode } from '../../generated/prisma/client';
import { SessionActor } from '../repositories';

export enum ActorScopeKind {
  TenantAdmin = 'tenant_admin',
  Member = 'member',
  ClientContact = 'client_contact',
  RoleOnly = 'role_only',
  Ambiguous = 'ambiguous',
}

export type ObjectScopeRequirement =
  | { kind: 'actorProfile'; actorProfileId: string }
  | { kind: 'member'; memberId: string }
  | { kind: 'memberCompany'; companyId: string }
  | { kind: 'memberDivision'; divisionId: string }
  | { kind: 'clientContact'; clientContactId: string }
  | { kind: 'client'; clientId: string }
  | { kind: 'clientCompany'; companyId: string };

export interface ObjectScopeCheck {
  anyOf?: ObjectScopeRequirement[];
  allOf?: ObjectScopeRequirement[];
  allowTenantAdmin?: boolean;
}

export interface ObjectScopeDecision {
  allowed: boolean;
  reason: string;
}

export interface ActorScopeContext {
  actorProfileId: string;
  roleId: string;
  roleCode: ActorRoleCode;
  kind: ActorScopeKind;
  tenantWide: boolean;
  member: {
    id: string;
    companyId: string;
    divisionId: string;
    active: boolean;
    companyActive: boolean;
    divisionActive: boolean;
  } | null;
  clientContact: {
    id: string;
    clientId: string;
    clientCompanyId: string | null;
    active: boolean;
    clientActive: boolean;
    clientCompanyActive: boolean | null;
  } | null;
}

@Injectable()
export class ObjectScopeProvider {
  resolve(actor: SessionActor): ActorScopeContext {
    const tenantWide = actor.role.code === ActorRoleCode.system_admin;
    const member = actor.member
      ? {
          id: actor.member.id,
          companyId: actor.member.companyId,
          divisionId: actor.member.divisionId,
          active: actor.member.isActive,
          companyActive: actor.member.company.isActive,
          divisionActive: actor.member.division.isActive,
        }
      : null;
    const clientContact = actor.clientContact
      ? {
          id: actor.clientContact.id,
          clientId: actor.clientContact.clientId,
          clientCompanyId: actor.clientContact.client.companyId,
          active: actor.clientContact.isActive,
          clientActive: actor.clientContact.client.isActive,
          clientCompanyActive:
            actor.clientContact.client.company?.isActive ?? null,
        }
      : null;

    return {
      actorProfileId: actor.id,
      roleId: actor.roleId,
      roleCode: actor.role.code,
      kind: this.kind(tenantWide, member, clientContact),
      tenantWide,
      member,
      clientContact,
    };
  }

  hasTenantWideScope(actor: SessionActor | ActorScopeContext): boolean {
    return 'tenantWide' in actor
      ? actor.tenantWide
      : actor.role.code === ActorRoleCode.system_admin;
  }

  canAccess(
    actor: SessionActor | ActorScopeContext,
    check: ObjectScopeCheck,
  ): ObjectScopeDecision {
    const scope = 'tenantWide' in actor ? actor : this.resolve(actor);
    if (check.allowTenantAdmin !== false && scope.tenantWide) {
      return { allowed: true, reason: 'tenant-wide administrator scope' };
    }
    if (scope.kind === ActorScopeKind.Ambiguous) {
      return { allowed: false, reason: 'ambiguous actor identity' };
    }

    const allOf = check.allOf ?? [];
    if (allOf.length > 0 && !allOf.every((rule) => this.matches(scope, rule))) {
      return { allowed: false, reason: 'required object scope was not met' };
    }

    const anyOf = check.anyOf ?? [];
    if (anyOf.length > 0 && !anyOf.some((rule) => this.matches(scope, rule))) {
      return { allowed: false, reason: 'no matching object scope was found' };
    }

    if (allOf.length === 0 && anyOf.length === 0) {
      return { allowed: false, reason: 'object scope requirement is empty' };
    }

    return { allowed: true, reason: 'object scope matched' };
  }

  assertCanAccess(
    actor: SessionActor | ActorScopeContext,
    check: ObjectScopeCheck,
  ): void {
    const decision = this.canAccess(actor, check);
    if (!decision.allowed) throw new ForbiddenException(decision.reason);
  }

  private kind(
    tenantWide: boolean,
    member: ActorScopeContext['member'],
    clientContact: ActorScopeContext['clientContact'],
  ): ActorScopeKind {
    if (tenantWide) return ActorScopeKind.TenantAdmin;
    if (member && clientContact) return ActorScopeKind.Ambiguous;
    if (member) return ActorScopeKind.Member;
    if (clientContact) return ActorScopeKind.ClientContact;
    return ActorScopeKind.RoleOnly;
  }

  private matches(
    scope: ActorScopeContext,
    requirement: ObjectScopeRequirement,
  ): boolean {
    if (requirement.kind === 'actorProfile') {
      return scope.actorProfileId === requirement.actorProfileId;
    }
    if (scope.kind === ActorScopeKind.Member) {
      return this.matchesMember(scope, requirement);
    }
    if (scope.kind === ActorScopeKind.ClientContact) {
      return this.matchesClientContact(scope, requirement);
    }
    return false;
  }

  private matchesMember(
    scope: ActorScopeContext,
    requirement: ObjectScopeRequirement,
  ): boolean {
    const member = scope.member;
    if (!member?.active) return false;
    if (requirement.kind === 'member')
      return member.id === requirement.memberId;
    if (requirement.kind === 'memberCompany') {
      return member.companyActive && member.companyId === requirement.companyId;
    }
    if (requirement.kind === 'memberDivision') {
      return (
        member.divisionActive && member.divisionId === requirement.divisionId
      );
    }
    return false;
  }

  private matchesClientContact(
    scope: ActorScopeContext,
    requirement: ObjectScopeRequirement,
  ): boolean {
    const contact = scope.clientContact;
    if (!contact?.active) return false;
    if (requirement.kind === 'clientContact') {
      return contact.id === requirement.clientContactId;
    }
    if (requirement.kind === 'client') {
      return contact.clientActive && contact.clientId === requirement.clientId;
    }
    if (requirement.kind === 'clientCompany') {
      return (
        contact.clientCompanyActive === true &&
        contact.clientCompanyId === requirement.companyId
      );
    }
    return false;
  }
}
