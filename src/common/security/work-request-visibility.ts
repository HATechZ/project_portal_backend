import {
  Prisma,
  WorkRequestV1AssignmentLevelCode as Level,
} from '../../generated/prisma/client';
import type { SessionActor } from './session.types';
import { hasTenantWideInternalAuthority } from './tenant-internal-operations';

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
  const responsibility = activeAssignmentMember(member.id);

  switch (actor.role.customScope) {
    case 'division': {
      const divisionIds = member.divisionLeadsByMemberId.map(
        ({ divisionId }) => divisionId,
      );
      return divisionIds.length
        ? {
            OR: [
              responsibility,
              activeAssignment(Level.DIVISION, {
                divisionId: { in: divisionIds },
              }),
            ],
          }
        : responsibility;
    }
    case 'team':
      return {
        OR: [
          responsibility,
          activeAssignment(Level.TEAM, {
            team: { is: { isActive: true, leadMemberId: member.id } },
          }),
        ],
      };
    case 'member':
      return responsibility;
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
  if (
    assignments.some((assignment) =>
      active(assignment, Level.MEMBER) ||
      active(assignment, Level.CHECKING) ||
      active(assignment, Level.APPROVAL) ||
      active(assignment, Level.FINAL_REVIEW) ||
      active(assignment, Level.EXTERNAL_REVIEW)
        ? assignment.memberId === member.id
        : false,
    )
  )
    return true;
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
      (assignment) =>
        active(assignment, Level.MEMBER) && assignment.memberId === member.id,
    );
  return false;
}

export function hasCompanyWorkRequestScope(actor: SessionActor): boolean {
  return (
    actor.role.customScope === 'company' ||
    hasTenantWideInternalAuthority(actor)
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

function activeAssignmentMember(
  memberId: string,
): Prisma.WorkRequestV1WhereInput {
  return {
    assignments: {
      some: {
        level: {
          in: [
            Level.MEMBER,
            Level.CHECKING,
            Level.APPROVAL,
            Level.FINAL_REVIEW,
            Level.EXTERNAL_REVIEW,
          ],
        },
        memberId,
        unassignedAt: null,
        replacedAt: null,
      },
    },
  };
}

function never(): Prisma.WorkRequestV1WhereInput {
  return { id: { in: [] } };
}

function active(assignment: Assignment, level: Level): boolean {
  return assignment.level === level;
}
