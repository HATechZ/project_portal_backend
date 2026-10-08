import {
  Prisma,
  WorkRequestV1AssignmentLevelCode as Level,
} from '../../generated/prisma/client';
import type { SessionActor } from './session.types';

type Assignment = {
  level: Level;
  divisionId: string | null;
  teamId: string | null;
  memberId: string | null;
  team?: { leadMemberId: string | null; isActive: boolean } | null;
};

/** The one internal object-scope rule for Work Request reads and actions. */
export function workRequestVisibilityWhere(
  actor: SessionActor,
): Prisma.WorkRequestV1WhereInput {
  if (hasCompanyWorkRequestScope(actor)) return {};
  const member = actor.member;
  if (!member?.isActive || !member.company.isActive) return never();

  switch (actor.role.customScope) {
    case 'division': {
      const divisionIds = member.divisionLeadsByMemberId.map(
        ({ divisionId }) => divisionId,
      );
      return divisionIds.length
        ? activeAssignment(Level.DIVISION, { divisionId: { in: divisionIds } })
        : never();
    }
    case 'team':
      return activeAssignment(Level.TEAM, {
        team: { is: { isActive: true, leadMemberId: member.id } },
      });
    case 'member':
      return activeAssignment(Level.MEMBER, { memberId: member.id });
    default:
      return never();
  }
}

export function canAccessWorkRequest(
  actor: SessionActor,
  assignments: Assignment[],
): boolean {
  if (hasCompanyWorkRequestScope(actor)) return true;
  const member = actor.member;
  if (!member?.isActive || !member.company.isActive) return false;
  if (actor.role.customScope === 'division')
    return assignments.some(
      (assignment) =>
        active(assignment, Level.DIVISION) &&
        assignment.divisionId !== null &&
        member.divisionLeadsByMemberId.some(
          ({ divisionId }) => divisionId === assignment.divisionId,
        ),
    );
  if (actor.role.customScope === 'team')
    return assignments.some(
      (assignment) =>
        active(assignment, Level.TEAM) &&
        assignment.team?.isActive === true &&
        assignment.team.leadMemberId === member.id,
    );
  if (actor.role.customScope === 'member')
    return assignments.some(
      (assignment) => active(assignment, Level.MEMBER) && assignment.memberId === member.id,
    );
  return false;
}

export function hasCompanyWorkRequestScope(actor: SessionActor): boolean {
  return (
    actor.role.customScope === 'company' ||
    actor.role.systemRole?.systemCode === 'tenant_super_admin'
  );
}

/** Bid/Project visibility inherits the same related Work Request predicate. */
export function relatedWorkRequestVisibilityWhere(
  actor: SessionActor,
): Prisma.WorkRequestV1WhereInput | undefined {
  return hasCompanyWorkRequestScope(actor)
    ? undefined
    : workRequestVisibilityWhere(actor);
}

function activeAssignment(
  level: Level,
  target: Prisma.WorkRequestV1AssignmentWhereInput,
): Prisma.WorkRequestV1WhereInput {
  return {
    assignments: {
      some: { level, unassignedAt: null, replacedAt: null, ...target },
    },
  };
}

function never(): Prisma.WorkRequestV1WhereInput {
  return { id: { in: [] } };
}

function active(assignment: Assignment, level: Level): boolean {
  return assignment.level === level;
}
