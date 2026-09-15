import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { ALLOW_ACTOR_ROLES_KEY } from '../common/security/allow-actor-roles.decorator';
import { PERMISSIONS_KEY } from '../common/security/permissions.decorator';
import { ActorRoleCode, WorkflowActionCode } from '../generated/prisma/client';
import { DivisionController } from './division.controller';
import { DivisionLeadController } from './division-lead.controller';
import { DivisionService } from './division.service';

const company = { id: 'company-1' };
const assignment = {
  division: { id: 'division-1', name: 'Projects', abbr: 'PRJ' },
  member: {
    id: 'member-1',
    name: 'Lead User',
    email: 'lead@example.com',
    userId: 'user-1',
  },
  roleCode: ActorRoleCode.division_lead,
  userRoleActive: true,
  actorProfileLinked: true,
};

function serviceWithLeadRepository(
  leadRepository: Record<string, jest.Mock> = {
    assign: jest.fn(),
    revoke: jest.fn(),
    findActiveLead: jest.fn(),
  },
) {
  const repository = {
    findScopedCompany: jest.fn().mockResolvedValue(company),
    findAll: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findDivisionType: jest.fn(),
    findDeleteBlockers: jest.fn(),
  };
  return {
    service: new DivisionService(repository as never, leadRepository as never),
    repository,
    leadRepository,
  };
}

describe('Division Lead assignment', () => {
  it('assigns an eligible same-Division Member as Division Lead', async () => {
    const { service, leadRepository } = serviceWithLeadRepository({
      assign: jest.fn().mockResolvedValue(assignment),
    });

    await expect(
      service.assignLead(
        'division-1',
        { memberId: 'member-1' },
        'system-admin-user',
      ),
    ).resolves.toMatchObject({
      division: { id: 'division-1' },
      member: { id: 'member-1', userId: 'user-1' },
      roleCode: ActorRoleCode.division_lead,
      userRoleActive: true,
      actorProfileLinked: true,
    });
    expect(leadRepository.assign).toHaveBeenCalledWith({
      companyId: company.id,
      divisionId: 'division-1',
      memberId: 'member-1',
      assignedByUserId: 'system-admin-user',
    });
  });

  it('denies wrong-Division or cross-Company Members through scoped lookup', async () => {
    const { service } = serviceWithLeadRepository({
      assign: jest.fn().mockRejectedValue(
        new AppException({
          code: AppErrorCode.NotFound,
          status: 404,
          message: 'Member was not found in this Division',
        }),
      ),
    });

    await expect(
      service.assignLead('division-1', { memberId: 'member-2' }, 'admin'),
    ).rejects.toMatchObject({ code: AppErrorCode.NotFound });
  });

  it('requires pre-existing User access for the Member', async () => {
    const { service } = serviceWithLeadRepository({
      assign: jest.fn().mockRejectedValue(
        new AppException({
          code: AppErrorCode.Conflict,
          status: 409,
          message:
            'Member must be linked to a User before assigning Division Lead',
        }),
      ),
    });

    await expect(
      service.assignLead('division-1', { memberId: 'member-1' }, 'admin'),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('keeps the route system_admin guarded', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, DivisionController) ??
      []) as unknown[];
    expect(guards).toContain(SystemAdminGuard);
  });
});

describe('Division Lead route authorization', () => {
  const leadRoutes = ['assignLead', 'findLead', 'revokeLead'] as const;

  // Typed as `object` so eslint's unbound-method rule does not fire: these are
  // metadata targets, never called.
  const routeHandler = (name: string): object =>
    (DivisionLeadController.prototype as unknown as Record<string, object>)[
      name
    ];

  it('requires ASSIGN_LEADER on the lead controller', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DivisionLeadController),
    ).toEqual([WorkflowActionCode.ASSIGN_LEADER]);
  });

  it('admits division_head on the lead controller', () => {
    expect(
      Reflect.getMetadata(ALLOW_ACTOR_ROLES_KEY, DivisionLeadController),
    ).toEqual([ActorRoleCode.division_head]);
  });

  it.each(leadRoutes)('defines %s on the lead controller', (route) => {
    expect(typeof routeHandler(route)).toBe('function');
  });

  it('leaves Division CRUD on ADD_DIVISION, admitting system_admin only', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DivisionController)).toEqual([
      WorkflowActionCode.ADD_DIVISION,
    ]);
    // The widening decorator must not have leaked onto the CRUD controller.
    expect(
      Reflect.getMetadata(ALLOW_ACTOR_ROLES_KEY, DivisionController),
    ).toBeUndefined();
  });
});

describe('Division Lead service orchestration', () => {
  it('returns null rather than throwing for a Lead-less Division', async () => {
    const { service, repository, leadRepository } = serviceWithLeadRepository({
      assign: jest.fn(),
      revoke: jest.fn(),
      findActiveLead: jest.fn().mockResolvedValue(null),
    });
    repository.findById.mockResolvedValue({ id: 'division-1' });

    await expect(service.findLead('division-1')).resolves.toBeNull();
    expect(leadRepository.findActiveLead).toHaveBeenCalledWith(
      'division-1',
      company.id,
    );
  });

  it('revokes through the repository for a scoped Division', async () => {
    const { service, repository, leadRepository } = serviceWithLeadRepository({
      assign: jest.fn(),
      revoke: jest.fn().mockResolvedValue({
        member: { id: 'member-1', name: 'Lead', email: 'lead@example.com' },
        assignedAt: new Date('2026-02-02T00:00:00Z'),
        assignedByUserId: 'admin-1',
      }),
      findActiveLead: jest.fn(),
    });
    repository.findById.mockResolvedValue({ id: 'division-1' });

    await expect(
      service.revokeLead('division-1', 'admin-2'),
    ).resolves.toMatchObject({ member: { id: 'member-1' } });
    expect(leadRepository.revoke).toHaveBeenCalledWith({
      companyId: company.id,
      divisionId: 'division-1',
      revokedByUserId: 'admin-2',
    });
  });
});
