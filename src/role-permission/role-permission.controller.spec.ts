import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';

const roleId = '10000000-0000-4000-8000-000000000004';
const userId = '20000000-0000-4000-8000-000000000001';

describe('RolePermissionController HTTP API', () => {
  let app: INestApplication<App>;
  let authenticated = true;
  let systemAdmin = true;
  const service = {
    findRoles: jest.fn(),
    findRole: jest.fn(),
    findPermissions: jest.fn(),
    findPermission: jest.fn(),
    setRolePermissions: jest.fn(),
    findUserRoles: jest.fn(),
    assignUserRole: jest.fn(),
    revokeUserRole: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RolePermissionController],
      providers: [{ provide: RolePermissionService, useValue: service }],
    })
      .overrideGuard(TenantContextGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthenticatedGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!authenticated)
            throw new UnauthorizedException('Authentication required');
          context.switchToHttp().getRequest<{ user?: { id: string } }>().user =
            {
              id: 'admin-user-id',
            };
          return true;
        },
      })
      .overrideGuard(SystemAdminGuard)
      .useValue({
        canActivate: () => {
          if (!systemAdmin)
            throw new ForbiddenException(
              'System administrator access required',
            );
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    authenticated = true;
    systemAdmin = true;
    jest.clearAllMocks();
  });

  afterAll(async () => app?.close());

  it('rejects unauthenticated administration requests', async () => {
    authenticated = false;

    await request(app.getHttpServer()).get('/roles').expect(401);
  });

  it('rejects authenticated non-system-administrators', async () => {
    systemAdmin = false;

    await request(app.getHttpServer()).get('/roles').expect(403);
  });

  it('lists roles and gets one role without exposing Prime Consultant', async () => {
    const role = { id: roleId, code: 'division_lead', permissions: [] };
    service.findRoles.mockResolvedValue([role]);
    service.findRole.mockResolvedValue(role);

    const list = await request(app.getHttpServer()).get('/roles').expect(200);
    const one = await request(app.getHttpServer())
      .get(`/roles/${roleId}`)
      .expect(200);

    expect(list.body).toEqual([role]);
    expect(one.body).toEqual(role);
    expect(JSON.stringify(list.body)).not.toContain('prime_consultant');
  });

  it('lists only permissions returned by the visible-permission query', async () => {
    const visible = {
      id: '60000000-0000-4000-8000-000000000001',
      code: WorkflowActionCode.ADD_COMPANY,
      isUserVisible: true,
    };
    service.findPermissions.mockResolvedValue([visible]);

    const response = await request(app.getHttpServer())
      .get('/permissions')
      .expect(200);

    expect(response.body).toEqual([visible]);
    expect(service.findPermissions).toHaveBeenCalledTimes(1);
  });

  it('performs full replacement and supports an empty permission set', async () => {
    service.setRolePermissions.mockResolvedValue({
      id: roleId,
      code: 'division_lead',
      permissions: [],
    });

    await request(app.getHttpServer())
      .put(`/roles/${roleId}/permissions`)
      .send({ permissionCodes: [] })
      .expect(200);

    expect(service.setRolePermissions).toHaveBeenCalledWith(roleId, {
      permissionCodes: [],
    });
  });

  it('rejects invalid and duplicate permission input', async () => {
    await request(app.getHttpServer())
      .put(`/roles/${roleId}/permissions`)
      .send({ permissionCodes: ['NOT_A_PERMISSION'] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/roles/${roleId}/permissions`)
      .send({
        permissionCodes: [
          WorkflowActionCode.ADD_PROJECT,
          WorkflowActionCode.ADD_PROJECT,
        ],
      })
      .expect(400);

    expect(service.setRolePermissions).not.toHaveBeenCalled();
  });

  it('assigns, lists, and revokes an existing user role', async () => {
    const assignment = { id: 'assignment-id', userId, roleId };
    service.assignUserRole.mockResolvedValue(assignment);
    service.findUserRoles.mockResolvedValue([assignment]);
    service.revokeUserRole.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .send({ roleId })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/users/${userId}/roles`)
      .expect(200, [assignment]);
    await request(app.getHttpServer())
      .delete(`/users/${userId}/roles/${roleId}`)
      .expect(204);

    expect(service.assignUserRole).toHaveBeenCalledWith(
      userId,
      { roleId },
      'admin-user-id',
    );
    expect(service.revokeUserRole).toHaveBeenCalledWith(
      userId,
      roleId,
      'admin-user-id',
    );
  });

  it('surfaces duplicate assignment and final-administrator conflicts', async () => {
    service.assignUserRole.mockRejectedValue(
      new ConflictException('The user already has this role'),
    );
    service.revokeUserRole.mockRejectedValue(
      new ConflictException(
        'The tenant must retain at least one active system administrator',
      ),
    );

    await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .send({ roleId })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/users/${userId}/roles/${roleId}`)
      .expect(409);
  });

  it('does not expose the removed PATCH endpoints', async () => {
    await request(app.getHttpServer())
      .patch(`/roles/${roleId}`)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .patch('/permissions/60000000-0000-4000-8000-000000000001')
      .send({})
      .expect(404);
  });

  it('documents permission replacement as PUT-only full replacement', () => {
    const document = SwaggerModule.createDocument(app, {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
    });
    const rolePath = document.paths['/roles/{id}/permissions'];

    expect(rolePath?.put?.description).toContain('full replacement');
    expect(document.paths['/roles/{id}']?.patch).toBeUndefined();
    expect(document.paths['/permissions/{id}']?.patch).toBeUndefined();
  });
});
