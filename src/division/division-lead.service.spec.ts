import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { ActorRoleCode } from '../generated/prisma/client';
import { DivisionController } from './division.controller';
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

function serviceWithLeadRepository(leadRepository = { assign: jest.fn() }) {
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
